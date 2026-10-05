#!/usr/bin/env python3
# 鲁港通 - 栏目页发现工具：为山东政务云 CMS 来源实测「政策文件/通知公告」栏目的真实 URL。
#
# 纪律依据：项目规定「不编造 URL，每个发现入口必须服务器实测后才写进 sources.yaml」。
#
# 背景（实测取证 diag-colpages.log，2026-09-09）：各厅局首页链出的栏目页占比 15%~90%
# （教育厅首页 35 个栏目页只夹 4 篇真文章），50 篇/轮的配额九成被列表页吃掉，故发现
# 入口必须从「网站首页」换成「具体栏目页」。
#
# 本工具走生产同款安全通道（fetch_url：白名单 + 强制 IPv4 + 大小限制）抓取首页，提取
# 带锚文本的链接，逐个实测候选栏目页内部的文档页产出量，输出可直接写进配置的入口清单。
# 锚文本必须先经 _decode_html 再匹配中文关键词：政务站 GB18030/UTF-8/BIG5 编码混杂，
# shell grep 在 GB18030 页面上会漏判（首轮 shell 取证即因此拿到过错误数字）。
#
# 用法（服务器容器内）：
#   docker compose run --rm lugang-osg python -u tools/probe_columns.py [--only code1,code2]
#   # 实测人工提供的候选入口（不读 sources.yaml 配置，白名单规则仍随来源走）：
#   docker compose run --rm lugang-osg python -u tools/probe_columns.py \
#       --only jinan_gov --urls https://www.jinan.gov.cn/col/col85343/index.html
from __future__ import annotations

import argparse
import pathlib
import sys
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin

# 鲁港通 - 允许从项目根导入 app 包（容器内 WORKDIR=/app，脚本在 /app/tools/）
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.ingest.discover import _decode_html, is_column_page, is_listing_page  # noqa: E402
from app.ingest.pipeline import SyncStats, _fetch_with_retry, _rules_for_source  # noqa: E402
from app.models import Source  # noqa: E402
from app.security.fetcher import fetch_url  # noqa: E402

# 鲁港通 - 栏目页判定统一走 discover.is_column_page（与生产管线共用同一正则，
# 避免工具与管线两处判定再次分叉——本轮就是因为分叉才漏掉了生产管线的形态过滤）。

# 鲁港通 - 采集范围关键词（用户 2026-09-09 决策：政策文件 + 通知公告）。
# 政务站栏目名实测写法多样，故用宽松关键词命中后人工复核，不做自动写入。
_SCOPE_KEYWORDS = (
    "政策", "文件", "公文", "法规", "规章", "条例", "办法", "规定",
    "意见", "措施", "通知", "公告", "解读",
)

# 明确不属于政策语料的栏目（导航/服务/简介/招投标/学会等），命中即不打 ★
_OUT_OF_SCOPE = (
    "首页", "更多", "查看", "概况", "简介", "领导", "机构", "职能", "联系",
    "专题", "图片", "视频", "访谈", "调查", "征集", "信访", "人事", "招聘",
    "招标", "采购", "学会", "会计", "下载", "办事", "服务", "地图",
)

# 锚文本上限：栏目名实测只有 2~12 字，超长说明 <a> 未闭合而吞了后续页面文字
_MAX_ANCHOR_CHARS = 40


@dataclass(frozen=True)
class Link:
    """一个链接及其锚文本（栏目名只存在于锚文本里）。"""

    url: str
    text: str


class _LinkTextCollector(HTMLParser):
    """提取 <a href> 与其锚文本。

    鲁港通 - discover._LinkCollector 只取 href 不取文字，而换入口的判据恰恰是栏目名，
    故此处单独实现；锚文本内的嵌套标签（<span>/<em>）文字一并收集。
    """

    _SKIP_SCHEMES = ("javascript:", "mailto:", "tel:", "data:")

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[Link] = []
        self._href: str | None = None
        self._buf: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "a":
            # 鲁港通 - 嵌套 <a>（政务站模板常见）以外层为准，不重置缓冲
            if self._href is None:
                self._href = dict(attrs).get("href")
                self._buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._href is not None:
            self._flush()

    def handle_data(self, data: str) -> None:
        # 鲁港通 - 截断防吞页：政务站模板常见 <a> 不闭合，若一直累加会把整页
        # 导航文字当成栏目名，但链接本身仍是有效候选，故只限文字不丢 URL。
        if self._href is not None and sum(len(s) for s in self._buf) < _MAX_ANCHOR_CHARS:
            self._buf.append(data)

    def close(self) -> None:
        """文档结束时冲洗未闭合的 <a>（否则该栏目页候选会整个丢失）。"""
        super().close()
        if self._href is not None:
            self._flush()

    def _flush(self) -> None:
        text = " ".join("".join(self._buf).split())[:_MAX_ANCHOR_CHARS]
        self.links.append(Link(url=self._href.strip(), text=text))
        self._href = None
        self._buf = []


def collect_links(content: bytes, base_url: str) -> list[Link]:
    """提取页面全部链接（相对地址基于 base_url 拼接、去 fragment、按 URL 去重）。"""
    collector = _LinkTextCollector()
    try:
        collector.feed(_decode_html(content))
        collector.close()
    except Exception:  # noqa: BLE001 - 政务站编码混杂，解析失败按 0 链接处理
        return []

    out: list[Link] = []
    seen: set[str] = set()
    for link in collector.links:
        if not link.url or link.url.lower().startswith(_LinkTextCollector._SKIP_SCHEMES):
            continue
        absolute = urljoin(base_url, link.url).split("#", 1)[0]
        if not absolute or absolute in seen:
            continue
        seen.add(absolute)
        out.append(Link(url=absolute, text=link.text))
    return out


def in_scope(text: str) -> bool:
    """锚文本是否落在选定采集范围内（政策文件 + 通知公告）。"""
    if not text or any(k in text for k in _OUT_OF_SCOPE):
        return False
    return any(k in text for k in _SCOPE_KEYWORDS)


def probe_source(db, source: Source, settings, interval: float, max_cols: int,
                 entries: list[str] | None = None) -> None:
    """实测一个 listing 来源：入口链出的栏目页 → 逐个探其内部文档页产出量。

    entries 非空时直接用它当入口（人工提供的候选 URL，如用户指认的政府信息公开页），
    不读 sources.yaml 的 listing_urls；白名单规则仍从该来源的域名规则取，不绕过安全校验。
    """
    print(f"\n=== {source.code}（{source.name}）method={source.discovery_method} ===")
    if source.discovery_method != "listing":
        print("  非 listing 发现方式，无需换入口，跳过")
        return

    cfg = source.discovery_config or {}
    if entries is None:
        entries = [u for u in (cfg.get("listing_urls") or []) if isinstance(u, str) and u.strip()]
    if not entries:
        print("  未配置 listing_urls，跳过")
        return

    rules = _rules_for_source(db, source)
    stats = SyncStats()
    candidates: dict[str, str] = {}      # 栏目页 URL -> 锚文本（跨入口去重）

    for entry in entries:
        time.sleep(interval)
        result = _fetch_with_retry(entry, rules, settings, fetch_url, time.sleep, stats)
        if result is None:
            print(f"  入口抓取失败 {entry}: {stats.errors[-1] if stats.errors else '未知'}")
            continue
        links = collect_links(result.content, result.final_url)
        cols = [lk for lk in links if is_column_page(lk.url)]
        docs = [lk for lk in links if not is_listing_page(lk.url)]
        print(f"  入口 {entry}")
        print(f"    HTTP {result.http_status}  链接 {len(links)}  栏目页 {len(cols)}  文档页 {len(docs)}")
        for link in cols:
            candidates.setdefault(link.url, link.text)

    if not candidates:
        print("  未发现 /col/ 栏目页形态（非政务云 CMS），无需换入口")
        return

    # 逐个实测候选栏目页的内部文档页产出量：这是能否当发现入口的决定性判据
    # （实测 jinan_gov 的两个入口都是栏目页，但内部 art=0，换进去也采不到东西）
    ranked: list[tuple[int, str, str]] = []
    for url, text in list(candidates.items())[:max_cols]:
        time.sleep(interval)
        result = _fetch_with_retry(url, rules, settings, fetch_url, time.sleep, stats)
        if result is None:
            ranked.append((-1, text, url))
            continue
        links = collect_links(result.content, result.final_url)
        docs = {lk.url for lk in links if not is_listing_page(lk.url)}
        ranked.append((len(docs), text, url))

    ranked.sort(key=lambda item: (-item[0], item[1]))
    print(f"  栏目页候选（★=命中采集范围；docs=内部文档页数，-1=抓取失败）:")
    for count, text, url in ranked:
        mark = "★" if in_scope(text) else " "
        print(f"    {mark} docs={count:<4} {text[:22]:<22} {url}")


def main() -> int:
    ap = argparse.ArgumentParser(description="实测各来源的政策文件/通知公告栏目页 URL")
    ap.add_argument("--only", help="只探测指定来源 code（逗号分隔）")
    # 鲁港通 - 人工提供的候选入口（2026-09-09 用户指认济南有价值内容在政府信息公开页
    # col85343，而非原配置的济政发/济政办发）：截图只能证明浏览器能看到，不能证明
    # 静态 HTML 里有链接（该站部分列表靠 JS 渲染），必须实测后才可写入配置。
    ap.add_argument("--urls", help="直接实测指定入口 URL（逗号分隔），需配合 --only 指定来源")
    ap.add_argument("--interval", type=float, default=3.0, help="同源请求间隔秒数（默认 3）")
    ap.add_argument("--max-cols", type=int, default=40, help="单来源最多实测多少个栏目页")
    args = ap.parse_args()

    settings = get_settings()
    only = {c.strip() for c in args.only.split(",")} if args.only else None
    url_list = [u.strip() for u in args.urls.split(",") if u.strip()] if args.urls else None
    if url_list and not only:
        print("--urls 必须配合 --only 指定来源（白名单规则随来源走）")
        return 2

    db = SessionLocal()
    try:
        sources = db.execute(
            select(Source).where(Source.enabled.is_(True)).order_by(Source.code)
        ).scalars().all()
        targets = [
            s for s in sources
            if s.discovery_method == "listing" and (only is None or s.code in only)
        ]
        print(f"待探测 listing 来源 {len(targets)} 个，同源间隔 {args.interval}s")
        for src in targets:
            try:
                probe_source(db, src, settings, args.interval, args.max_cols, entries=url_list)
            except Exception as exc:  # noqa: BLE001 - 单来源失败不影响其余探测
                print(f"  !! {src.code} 探测异常: {exc}")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
