#!/usr/bin/env python3
# 鲁港通 - 正文容器探测工具：为每个来源实测并建议 content_selector。
#
# 纪律依据：项目规定「不编造 CSS Selector，每个来源必须服务器实测后才配置」。
# 本工具走 OSG 生产同款安全通道（fetch_url：白名单 + 强制 IPv4 + 大小限制）抓取
# 真实文章页，统计各 id/class 容器子树的可见文字量，给出最内层正文容器建议，
# 并对比「配置前/配置后」的正文样本供人工核对。
#
# 用法（服务器容器内）：
#   docker compose run --rm lugang-osg python tools/probe_selectors.py [--only code1,code2]
from __future__ import annotations

import argparse
import pathlib
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field
from html.parser import HTMLParser
from urllib.parse import urlsplit

# 鲁港通 - 允许从项目根导入 app 包（容器内 WORKDIR=/app，脚本在 /app/tools/）
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.ingest.discover import (  # noqa: E402
    DiscoveredItem,
    _decode_html,
    parse_listing,
    parse_rss,
    parse_sitemap,
)
from app.ingest.extract import MIN_CONTENT_CHARS, extract_html  # noqa: E402
from app.ingest.pipeline import _entry_urls, _fetch_with_retry, _rules_for_source  # noqa: E402
from app.models import Source  # noqa: E402

_DROP_TAGS = frozenset(
    {"script", "style", "noscript", "iframe", "svg", "nav", "header", "footer", "form"}
)

# 鲁港通 - 正文容器最低占比：容器内文字量 / 全文字低于此值说明它只是局部区块
_MIN_RATIO = 0.5

# 单次文本块 ≥ 此长度视为正文句（实测导航项/栏目链接通常远短于此）
_LONG_TEXT_CHARS = 40

# 正文常见容器标签：其内文字计入「正文性文字」
_PARAGRAPH_TAGS = frozenset({"p", "td", "article", "blockquote"})

# 块级标签：按浏览器规则隐式闭合前一个 <p>（政务站大量 <p> 不写闭合标签）
_BLOCK_TAGS = frozenset({
    "div", "p", "table", "tr", "td", "th", "ul", "ol", "li", "dl", "dd", "dt",
    "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "aside", "hr",
    "blockquote", "pre", "figure", "figcaption",
})

# 明显非正文的容器名（导航/页脚/侧栏等），即使占比达标也不建议
_BAD_HINTS = (
    "nav", "menu", "header", "footer", "sidebar", "side", "crumb", "banner",
    "logo", "copyright", "friendlink", "topbar", "toolbar", "share", "related",
)


@dataclass
class ContainerReport:
    """一篇页面的容器统计结果。"""

    total_chars: int = 0
    body_total: int = 0                                            # 全文正文性文字（不重复计）
    counts: dict[str, int] = field(default_factory=dict)   # 容器 -> 全部可见文字
    body: dict[str, int] = field(default_factory=dict)     # 容器 -> 正文性文字
    depth: dict[str, int] = field(default_factory=dict)    # 容器 -> 最大栈深（平局时选更内层）
    occ: dict[str, int] = field(default_factory=dict)      # 容器 -> 起始标签出现次数


class _ContainerAnalyzer(HTMLParser):
    """统计每个 id/class 容器子树内的可见文字量，并区分正文与导航短文本。

    政府站 HTML 常有未闭合标签，栈会失衡；这里只求定位文字最集中的容器，
    不追求 DOM 精确性（结果由人工核对正文样本后才写入配置）。
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.total = 0
        self.body_total = 0
        self.counts: dict[str, int] = defaultdict(int)
        self.body: dict[str, int] = defaultdict(int)
        self.depth: dict[str, int] = {}
        self.occ: dict[str, int] = defaultdict(int)
        self._stack: list[list[str]] = []
        self._skip = 0
        self._para_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in _DROP_TAGS:
            self._skip += 1
            self._stack.append([])
            return
        if tag in _BLOCK_TAGS:
            # 鲁港通 - 块级标签隐式闭合前一个 <p>，避免未闭合 <p> 使全文误判为正文
            self._para_depth = 1 if tag in _PARAGRAPH_TAGS else 0
        keys = _container_keys(attrs)
        depth = len(self._stack)
        for key in keys:
            self.occ[key] += 1
            if depth > self.depth.get(key, 0):
                self.depth[key] = depth
        self._stack.append(keys)

    def handle_endtag(self, tag: str) -> None:
        if self._stack:
            self._stack.pop()
        if tag in _DROP_TAGS:
            if self._skip > 0:
                self._skip -= 1
        elif tag in _PARAGRAPH_TAGS and self._para_depth > 0:
            self._para_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip:
            return
        n = len(data.strip())
        if not n:
            return
        self.total += n
        is_body = self._para_depth > 0 or n >= _LONG_TEXT_CHARS
        if is_body:
            self.body_total += n
        for keys in self._stack:
            for key in keys:
                self.counts[key] += n
                if is_body:
                    self.body[key] += n

    def report(self) -> ContainerReport:
        return ContainerReport(
            total_chars=self.total,
            body_total=self.body_total,
            counts=dict(self.counts),
            body=dict(self.body),
            depth=dict(self.depth),
            occ=dict(self.occ),
        )


def _container_keys(attrs) -> list[str]:
    """从一个标签的属性提取容器标识：`#id` 与各 `.class`。"""
    keys: list[str] = []
    for name, value in attrs:
        if not value:
            continue
        low = value.strip().lower()
        if name == "id" and low:
            keys.append(f"#{low}")
        elif name == "class":
            for cls in low.split():
                if cls:
                    keys.append(f".{cls}")
    return keys


def _is_bad_key(key: str) -> bool:
    return any(bad in key for bad in _BAD_HINTS)


def suggest_selector(reports: list[ContainerReport]) -> tuple[str | None, dict]:
    """跨多篇文章求共识：至少半数文章达标的容器里取最内层（正文字数最小）。

    鲁港通 - 单篇判断会被特例页带偏（实测港府新闻网视频页建议了外层
    `.newsdetail-wrap`，内层 `.newsdetail-content` 才是干净正文）；多页共识 +
    取最内层可稳定命中真正文容器。

    返回 (selector, 详情字典)；无合适容器时 selector 为 None。
    """
    valid = [r for r in reports if r.total_chars > 0]
    if not valid:
        return None, {}
    n = len(valid)

    ratios: dict[str, list[float]] = defaultdict(list)
    body_sum: dict[str, int] = defaultdict(int)
    depth_max: dict[str, int] = {}
    for report in valid:
        for key, chars in report.body.items():
            ratios[key].append(chars / report.total_chars)
            body_sum[key] += chars
        for key, d in report.depth.items():
            if d > depth_max.get(key, 0):
                depth_max[key] = d

    def _hits(key: str) -> int:
        return sum(1 for r in ratios[key] if r >= _MIN_RATIO)

    stable = [k for k in ratios if _hits(k) * 2 >= n and not _is_bad_key(k)]
    basis = "body"
    if not stable:
        # 鲁港通 - 整页没有段落/长句（实测如 hk_wfsfaa 的 #page_bg，占比 86%
        # 却全是栏目短链接）说明探到的不是文章页，绝不能回退到全文统计，
        # 否则会把导航容器当作正文容器写进配置
        if sum(r.body_total for r in valid) == 0:
            return None, {"articles": n, "reason": "no_body_text"}
        # 回退：正文无明显段落结构的站点（如纯 div 裸文本）改用全部可见文字
        ratios = defaultdict(list)
        body_sum = defaultdict(int)
        for report in valid:
            for key, chars in report.counts.items():
                ratios[key].append(chars / report.total_chars)
                body_sum[key] += chars
        stable = [k for k in ratios if _hits(k) * 2 >= n and not _is_bad_key(k)]
        basis = "all_text"
    if not stable:
        return None, {"articles": n, "reason": "no_qualified_container"}

    # 鲁港通 - id 必须跨篇全命中：实测 TYPO3 会生成 #c1592898853517、VSB 建站系统
    # 生成 #vsb_content_1031_u81 这类每页唯一的动态 id，写进配置对下一篇文章无效
    usable = [k for k in stable if not k.startswith("#") or _hits(k) == n]
    if not usable:
        return None, {"articles": n, "reason": "only_dynamic_ids", "seen": sorted(stable)[:4]}

    # 鲁港通 - 平均每篇正文字数低于入库门槛的容器不是正文：实测某来源建议了
    # .mobile_all_over_search（2 篇共 97 字、占比 51%），那其实是搜索框
    sized = [k for k in usable if body_sum[k] / n >= MIN_CONTENT_CHARS]
    if not sized:
        return None, {
            "articles": n,
            "reason": "body_too_small",
            "seen": sorted(usable)[:4],
            "max_avg_chars": max(body_sum[k] for k in usable) // n,
        }

    # 鲁港通 - 提取器只取「第一个」命中容器的内容（见 extract._TextExtractor），
    # 而探测统计的是全部同名容器的文字总和：实测 Bootstrap 的 .col-md-12 在一页里
    # 出现多次，若配成选择器，入库正文只剩第一段，与探测报告的字数不符。
    # 故要求「出现该容器的篇」里恰好一次；某篇没有此容器（如图片型页）不影响。
    unique = [k for k in sized if all(r.occ.get(k, 0) == 1 for r in valid if r.occ.get(k, 0))]
    if not unique:
        return None, {
            "articles": n,
            "reason": "not_unique_per_page",
            "seen": sorted(sized)[:4],
            "occ": {k: max(r.occ.get(k, 0) for r in valid) for k in sorted(sized)[:4]},
        }

    # 鲁港通 - 外层 wrapper 与其内层正文容器的字数往往完全相同（实测山东 .article
    # 与 #zoom、港府 .newsdetail-wrap 与 .newsdetail-content）：文字自内向外冒泡。
    # 故先取字数最小（最内层），平局时用栈深选更深者，再平局时优先 id（页面内唯一）。
    # 不能像旧版那样「只要有 id 候选就忽略 class」：实测入境处 TYPO3 的 #element1
    # 是包住整页的 id，真正的正文在其内层 class 容器里。
    best = min(unique, key=lambda k: (body_sum[k], -depth_max.get(k, 0), not k.startswith("#")))
    return best, {
        "articles": n,
        "hits": _hits(best),
        "body_chars": body_sum[best],
        "avg_ratio": sum(ratios[best]) / len(ratios[best]),
        "basis": basis,
        "depth": depth_max.get(best, 0),
    }


def _body_chain(report: ContainerReport, limit: int = 10) -> list[tuple[str, int, int, int]]:
    """正文容器链：body 字数 ≥ 最大值 90% 的容器，按栈深升序（外层 → 内层）。

    鲁港通 - 文字自内向外冒泡，嵌套容器的 body 字数完全相同，故字数并列即嵌套
    关系；按栈深排序后最深的那个就是正文容器（前提是该页只出现一次）。

    返回 (容器, 正文字数, 栈深, 出现次数) 列表。
    """
    if not report.body:
        return []
    top = max(report.body.values())
    chain = [
        (key, chars, report.depth.get(key, 0), report.occ.get(key, 0))
        for key, chars in report.body.items()
        if chars * 10 >= top * 9
    ]
    chain.sort(key=lambda item: (item[2], item[0]))
    return chain[:limit]


def analyze_html(content: bytes) -> ContainerReport:
    analyzer = _ContainerAnalyzer()
    try:
        analyzer.feed(_decode_html(content))
    except Exception:  # noqa: BLE001 - 编码混杂时按已解析部分统计
        pass
    return analyzer.report()


# ---------------------------------------------------------------------------
# 单来源探测
# ---------------------------------------------------------------------------

# 列表页/接口页特征：这些链接不是文章页，探测时跳过
_NON_ARTICLE_HINTS = (
    "/col/", "index.html", "index.htm", ".jsp", ".do", ".action",
    "/search", "/was5/web/search", "javascript", "/module/",
)


def _in_allowlist(url: str, rules) -> bool:
    """域名/scheme/路径粗筛（不做 DNS 解析），避开必然被拒的跨域外链。

    鲁港通 - 实测山东财政厅首页的候选几乎全是 www.shandong.gov.cn / www.gov.cn
    跨域新闻链接，不过滤就会把探测配额浪费在它们上而探不到本域文章页。
    """
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    host = (parts.hostname or "").lower()
    scheme = (parts.scheme or "").lower()
    if scheme not in ("http", "https") or not host:
        return False
    path = parts.path or "/"
    for rule in rules:
        domain = (rule.hostname or "").lower()
        if host != domain and not (rule.allow_subdomains and host.endswith("." + domain)):
            continue
        if scheme == "http" and not rule.allow_http:
            continue
        if path.startswith(rule.path_prefix or "/"):
            return True
    return False


def _looks_like_article(url: str) -> bool:
    """判定链接是否像文章页（排除栏目页、接口页，兼容无扩展名的现代 URL）。"""
    lowered = url.lower()
    if any(hint in lowered for hint in _NON_ARTICLE_HINTS):
        return False
    path = urlsplit(lowered).path or "/"
    if path.endswith((".html", ".htm", ".shtml", ".jhtml")):
        return True
    # 鲁港通 - 实测 HKMA/InvestHK/data.gov.hk 的内容 URL 没有扩展名
    # （如 /eng/regulatory-resources/.../circulars/2000/01/xxx），
    # 要求路径至少 3 段可避开首页与一级栏目页
    return len([s for s in path.split("/") if s]) >= 3


def _pick_article_urls(items, entry_urls: set[str], rules=(), limit: int = 2) -> list[str]:
    """从发现结果里挑出最像文章页的链接（排除入口页、栏目页、接口页、跨域外链）。"""
    picked: list[str] = []
    for item in items:
        url = item.url
        if url.rstrip("/") in entry_urls:
            continue
        if rules and not _in_allowlist(url, rules):
            continue
        if not _looks_like_article(url):
            continue
        picked.append(url)
        if len(picked) >= limit:
            break
    return picked


def _discover_items(source, rules, settings, stats) -> tuple[list[DiscoveredItem], list[str]]:
    """按发现方式取候选链接（fixed_url 直接用配置，其余抓入口解析）。

    返回 (候选项, 已配置的入口 URL 列表)。异常只记录，不中断探测。
    """
    cfg = source.discovery_config or {}
    method = source.discovery_method

    if method == "fixed_url":
        # 鲁港通 - 固定地址来源的入口就是目标文档本身，无需抓列表页
        urls = [u for u in (cfg.get("fixed_urls") or []) if isinstance(u, str)]
        return [DiscoveredItem(url=u) for u in urls], urls

    if method == "rss":
        urls = cfg.get("feed_urls") or []
    elif method == "sitemap":
        urls = cfg.get("sitemap_urls") or []
    elif method == "api":
        urls = (cfg.get("api_config") or {}).get("update_rss") or []
    else:
        urls = cfg.get("listing_urls") or []
    if not urls:
        return [], []

    result = _fetch_with_retry(urls[0], rules, settings, _fetch, _sleep, stats)
    if result is None:
        return [], urls
    if method == "sitemap":
        return parse_sitemap(result.content, result.final_url), urls
    if method in ("rss", "api"):
        return parse_rss(result.content), urls
    return parse_listing(result.content, result.final_url), urls


# 鲁港通 - 探测走生产同款安全通道；间隔遵守同源 ≥10s 纪律
def _fetch(url, rules, settings):
    from app.security.fetcher import fetch_url

    return fetch_url(url, rules, settings)


def _sleep(seconds: float) -> None:
    time.sleep(seconds)


def probe_source(db, source: Source, settings, interval_s: float) -> None:
    """探测一个来源并打印建议（人工核对样本后再写入 sources.yaml）。"""
    from app.ingest.pipeline import SyncStats

    print(f"\n=== {source.code}（{source.name}）method={source.discovery_method} ===")
    stats = SyncStats()
    rules = _rules_for_source(db, source)
    entry_urls = _entry_urls(source)

    items, _entries = _discover_items(source, rules, settings, stats)
    if stats.errors:
        print(f"  发现阶段告警: {stats.errors[:2]}")
    if not items:
        print("  未发现任何链接，跳过")
        return

    if source.discovery_method == "fixed_url":
        article_urls = [item.url for item in items][:2]
    else:
        article_urls = _pick_article_urls(items, entry_urls, rules)
    if not article_urls:
        print(f"  发现 {len(items)} 条链接，但无符合文章页特征的候选，需人工确认")
        for item in items[:5]:
            print(f"    - {item.url[:90]}")
        return

    pages: list[tuple] = []
    for url in article_urls:
        result = _fetch_with_retry(url, rules, settings, _fetch, _sleep, stats)
        if result is None:
            print(f"  抓取失败: {url[:80]} ({stats.errors[-1:]})")
            continue
        if result.content_type != "text/html":
            print(f"  非 HTML（{result.content_type}）: {url[:80]}")
            continue
        report = analyze_html(result.content)
        pages.append((url, result, report))
        print(f"  文章: {url[:88]}")
        print(f"    HTTP {result.http_status}  全文可见字数 {report.total_chars}")
        _sleep(interval_s)

    if not pages:
        print("  无可分析的 HTML 页面")
        return

    selector, detail = suggest_selector([r for _, _, r in pages])
    if selector:
        print(f"  >>> 建议 content_selector: \"{selector}\"  "
              f"({detail['hits']}/{detail['articles']} 篇达标, "
              f"正文 {detail['body_chars']} 字, 平均占比 {detail['avg_ratio']:.0%}, "
              f"栈深 d{detail.get('depth', 0)}, 依据 {detail['basis']})")
    else:
        print(f"  >>> 无可用容器（原因: {detail.get('reason')}），需人工确认")
        if detail.get("seen"):
            extra = f"（平均每篇最多 {detail['max_avg_chars']} 字）" if detail.get("max_avg_chars") else ""
            occ = f" 出现次数 {detail['occ']}" if detail.get("occ") else ""
            print(f"    已排除的候选: {detail['seen']}{extra}{occ}")

    # 鲁港通 - 输出正文链（外层 → 内层）：实测部分来源的建议容器仍含面包屑
    # （山东 #barrierfree_container、入境处 #element1），需人工从链条里挑真正文容器。
    # 标注：BAD=导航类名称已排除，xN=该页出现 N 次（>1 不可用作选择器）
    for url, _, report in pages:
        print(f"    正文链 {url[-40:]}（全文 {report.total_chars} 字）:")
        for key, chars, depth, occ in _body_chain(report):
            flag = "BAD" if _is_bad_key(key) else (f"x{occ}" if occ > 1 else "")
            ratio = chars / max(report.total_chars, 1)
            print(f"      d{depth:<3} {key:<30} {chars:>6} 字 {ratio:>4.0%} {flag}")

    # 鲁港通 - 前后对比：人工核对噪声（面包屑/字号控件/视频控件）是否被剔除
    for url, result, _ in pages:
        before = extract_html(result.content, organization=source.organization)
        after = extract_html(
            result.content,
            content_selector=selector,
            organization=source.organization,
        )
        print(f"  对比 {url[-46:]}")
        print(f"    标题: {after.title or '(空)'}")
        print(f"    无选择器: {_preview(before.text)}")
        print(f"    用建议后: {_preview(after.text)}")


def _preview(text: str | None, limit: int = 90) -> str:
    flat = " ".join((text or "").split())
    return flat[:limit] + ("…" if len(flat) > limit else "")


def main() -> int:
    ap = argparse.ArgumentParser(description="实测各来源正文容器并建议 content_selector")
    ap.add_argument("--only", help="只探测指定来源 code（逗号分隔）")
    ap.add_argument("--include-configured", action="store_true",
                    help="同时探测已配置 content_selector 的来源（默认跳过）")
    ap.add_argument("--interval", type=float, default=None,
                    help="同源请求间隔秒数（默认取 settings.source_min_interval_s）")
    args = ap.parse_args()

    settings = get_settings()
    interval = args.interval if args.interval is not None else settings.source_min_interval_s
    only = {c.strip() for c in args.only.split(",")} if args.only else None

    db = SessionLocal()
    try:
        sources = db.execute(
            select(Source).where(Source.enabled.is_(True)).order_by(Source.code)
        ).scalars().all()
        targets = [
            s for s in sources
            if (only is None or s.code in only)
            and (args.include_configured
                 or not (s.discovery_config or {}).get("content_selector"))
        ]
        print(f"待探测来源 {len(targets)} 个（已配置选择器的 {len(sources) - len(targets)} 个跳过）")
        print(f"同源请求间隔 {interval}s，预计耗时约 "
              f"{len(targets) * 3 * interval / 60:.1f} 分钟")
        for src in targets:
            try:
                probe_source(db, src, settings, interval)
            except Exception as exc:  # noqa: BLE001 - 单来源失败不影响其余探测
                print(f"\n=== {src.code} 探测异常: {exc} ===")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
