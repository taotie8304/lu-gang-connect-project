# 鲁港通 - 发现层（spec 第 8 节）：从各发现端点提取候选 URL。
# 所有解析器只做"提取"，不做网络请求、不做白名单校验（校验统一在 pipeline）。
from __future__ import annotations

import re
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit


@dataclass(frozen=True)
class DiscoveredItem:
    """一个候选链接及其可选元信息（RSS 条目带标题/发布时间）。"""

    url: str
    title: str | None = None
    published: str | None = None
    # 鲁港通 - api_json 发现方式：政务 JSON 接口（如海右人社政策通 portalList）的列表项
    # 直接内嵌政策全文；非空时 pipeline 跳过详情页抓取，直接用此 HTML 提取入库。
    body_html: str | None = None


# ---------------------------------------------------------------------------
# RSS / Atom（news.gov.hk topstories、data.gov.hk 每日更新源）
# ---------------------------------------------------------------------------

def parse_rss(content: bytes) -> list[DiscoveredItem]:
    """解析 RSS 2.0 / Atom，返回条目链接（feedparser 自动处理格式差异）。"""
    import feedparser

    feed = feedparser.parse(content)
    items: list[DiscoveredItem] = []
    for entry in feed.entries:
        link = entry.get("link")
        if not link:
            continue
        items.append(
            DiscoveredItem(
                url=link.strip(),
                title=(entry.get("title") or "").strip() or None,
                published=entry.get("published") or entry.get("updated"),
            )
        )
    return items


# ---------------------------------------------------------------------------
# sitemap.xml（investhk 4787 / edb 15497 / hkma 3.8MB；支持 sitemapindex 嵌套引用）
# ---------------------------------------------------------------------------

_SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def parse_sitemap(content: bytes, base_url: str) -> list[DiscoveredItem]:
    """解析 sitemap.xml / sitemapindex（index 只返回子 sitemap URL，由 pipeline 递归拉取）。"""
    import xml.etree.ElementTree as ET

    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        return []

    items: list[DiscoveredItem] = []
    # 鲁港通 - sitemapindex：loc 指向子 sitemap，同样返回（pipeline 会继续拉取解析）
    for loc in root.iter(f"{_SITEMAP_NS}loc"):
        url = (loc.text or "").strip()
        if url:
            items.append(DiscoveredItem(url=urljoin(base_url, url)))
    return items


def is_sitemap(content_type: str, content: bytes) -> bool:
    """判断响应是否为 sitemap（content-type 不可靠时嗅探根元素）。"""
    ct = (content_type or "").split(";", 1)[0].strip().lower()
    if ct in ("application/xml", "text/xml", "application/rss+xml", "application/atom+xml"):
        return True
    head = content[:512].lstrip()
    return head.startswith(b"<") and (b"<urlset" in head or b"<sitemapindex" in head)


# ---------------------------------------------------------------------------
# listing / 栏目页（info.gov.hk 公报列表、山东厅局首页、jinan /col/colXXX/）
# ---------------------------------------------------------------------------

class _LinkCollector(HTMLParser):
    """提取 <a href>；忽略锚点/javascript/data 链接。

    鲁港通 - 不再采集同页 <title>：实测山东政务站栏目页/首页的 <title> 是站点名
    （如「山东省商务厅」），把它当作发现项标题会让所有文章标题退化成站点名。
    文章标题统一由 extract 从文章页自身提取。
    """

    _SKIP_SCHEMES = ("javascript:", "mailto:", "tel:", "data:")

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.links.append(href.strip())


# 鲁港通 - 政务云 CMS（用友 jpaas）栏目页把文章列表嵌在 <script type="text/xml"><datastore>
# 的 <![CDATA[...]]> 里（实测 kjt/gxt/edu 三厅 col 页，2026-09-10）。HTMLParser 把 <script>
# 内容当原始文本、不解析其中的 <a href>，故须单独从这些 CDATA 片段补抽链接。
_XML_SCRIPT_RE = re.compile(r"<script[^>]*text/xml[^>]*>(.*?)</script>", re.IGNORECASE | re.DOTALL)
_CDATA_RE = re.compile(r"<!\[CDATA\[(.*?)\]\]>", re.DOTALL)
# 鲁港通 - jpaas CMS 内部端点路径前缀（dataproxy.jsp 分页 / search.jsp / visit.jsp 等），
# 是数据管线不是文档页，从 datastore 抽取时须排除，避免误抓或把动态端点存成“政策文档”。
_JPAAS_MODULE_PATH = "/module/"


def _extract_datastore_links(html: str) -> list[str]:
    """从 script type=text/xml 的 CDATA 片段提取 a href（jpaas 栏目文章列表）。

    鲁港通 - 每个 CDATA 片段是一段 HTML（li 包裹 a href=文章页），复用 _LinkCollector 解析，
    与常规链接走同一套 scheme 过滤；单片段畸形不影响其余，绝不打断整页发现。
    """
    links: list[str] = []
    for script_body in _XML_SCRIPT_RE.findall(html):
        for cdata in _CDATA_RE.findall(script_body):
            sub = _LinkCollector()
            try:
                sub.feed(cdata)
            except Exception:  # noqa: BLE001 - 单个 CDATA 片段畸形不影响其余
                continue
            for href in sub.links:
                if _JPAAS_MODULE_PATH in href:
                    continue
                links.append(href)
    return links


def parse_listing(content: bytes, base_url: str, *, max_links: int = 500) -> list[DiscoveredItem]:
    """从列表页 HTML 提取链接（相对地址基于 base_url 拼接；上限防超大门户页）。

    返回项不带 title（入口页标题不代表文章标题），由 pipeline 抓取文章页后提取。
    """
    collector = _LinkCollector()
    try:
        html = _decode_html(content)
        collector.feed(html)
    except Exception:  # noqa: BLE001 - 政府站编码混杂，解析失败按 0 链接处理
        return []

    # 鲁港通 - 常规 a href + 政务云 jpaas datastore CDATA 内的 a href 合并去重
    all_links = collector.links + _extract_datastore_links(html)

    items: list[DiscoveredItem] = []
    seen: set[str] = set()
    for href in all_links:
        if href.lower().startswith(_LinkCollector._SKIP_SCHEMES):
            continue
        absolute = urljoin(base_url, href)
        # 鲁港通 - 去掉 fragment（#xxx 不产生新内容）并去重
        absolute = absolute.split("#", 1)[0]
        if absolute and absolute not in seen:
            seen.add(absolute)
            items.append(DiscoveredItem(url=absolute))
        if len(items) >= max_links:
            break
    return items


# 鲁港通 - 栏目/列表/分页页形态黑名单（实测取证 2026-09-09，diag-colpages.log + probe-cols.log）：
# 两类形态：① 路径末段是 index.html / index_N.html（栏目页与翻页）；
# ② 路径正好终止于 /col/colNNNNN/（不带 index.html 的栏目页）。
# 第②类必须带 $ 锚点：实测济南市系（政府集约化平台）的文章页就嵌在栏目路径下，
# 形如 /col/col18309/art/2026/art_60aea502...html，若不加锚点会把 jinan_gov/jinan_hrss
# 的文章页全部误杀（一篇也采不到）；省级厅局文章页则是 /art/2026/8/25/art_10579_xxx.html。
# 用黑名单而非白名单：港府文章页形态各异且大量无扩展名（/eng/e-visa.html、
# /en/our-clients/<slug>/、/gia/general/202609/09/P2026090900732.htm），白名单会误杀。
_LISTING_PAGE_RE = re.compile(r"/index(?:_\d+)?\.s?html?$|/col/col\d+/$", re.IGNORECASE)

# 政务云 CMS 的栏目路径前缀（单独不足以判定列表页，需与 _LISTING_PAGE_RE 同时命中）
_COLUMN_PATH_RE = re.compile(r"/col/col\d+(?:/|$)", re.IGNORECASE)


def is_listing_page(url: str) -> bool:
    """判定 URL 是否为栏目/列表/分页页（不是可入库的文档页）。

    只按路径形态判定，不看内容：栏目页正文容器里是链接标题堆叠，实测 282~1930 字，
    足以越过 MIN_CONTENT_CHARS 入库门槛，必须在抓取前就挡掉。
    """
    return bool(_LISTING_PAGE_RE.search(urlsplit(url).path))


def is_column_page(url: str) -> bool:
    """是否为政务云 CMS 的栏目页（/col/colNNNNN/index.html）。

    必须同时满足「在 /col/ 栏目路径下」与「末段是 index 页」：实测济南市系的
    文章页也在 /col/ 下（/col/col18309/art/2026/art_<uuid>.html），只看 /col/ 会误杀。
    """
    path = urlsplit(url).path
    return bool(_COLUMN_PATH_RE.search(path)) and bool(_LISTING_PAGE_RE.search(path))


def _decode_html(content: bytes) -> str:
    """按 meta charset 或 BOM 解码 HTML（GB18030/UTF-8/BIG5 混杂是政务站常态）。

    鲁港通 - gb18030 必须单独列出：它是 gb2312/gbk 的超集，部分山东政务站直接声明
    charset=gb18030，若不识别就会退化成 UTF-8 解码得到乱码（正文入库与锚文本匹配双失败）。
    """
    if content.startswith(b"\xef\xbb\xbf"):
        return content.decode("utf-8-sig", errors="replace")
    head = content[:2048]
    for enc in (b"utf-8", b"UTF-8", b"gb18030", b"GB18030", b"gbk", b"GBK",
                b"gb2312", b"GB2312", b"big5", b"BIG5"):
        if enc in head:
            try:
                return content.decode(enc.decode("ascii"), errors="replace")
            except LookupError:
                break
    return content.decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# js_menu（TID 等 JS 动态站：栏目页是 JS 空壳，全站栏目树在静态 .js 菜单文件）
# ---------------------------------------------------------------------------

# 鲁港通 - 菜单文件的 var 声明；实测 TID 文件含 tc_topMenu / tc_topMenu_by_order /
# menuItems 多个 var，同一棵栏目树重复存放，逐个提取后由调用方按 URL 去重。
_JS_VAR_RE = re.compile(r"var\s+\w+\s*=\s*")


def _extract_js_objects(text: str) -> list[str]:
    """提取 JS 里所有 `var X = {...}` 对象字面量文本（括号配平 + 字符串感知）。

    鲁港通 - 实测 TID 菜单文件（2026-09-12）：对象字面量是 JSON 兼容格式，可直接
    json.loads；括号配平必须识别字符串内的引号与 `\\` 转义，否则标题/路径里的
    花括号会把提取带偏。未闭合/畸形的对象直接舍弃，绝不抛异常。
    """
    out: list[str] = []
    for m in _JS_VAR_RE.finditer(text):
        i = m.end()
        while i < len(text) and text[i] in " \t\r\n":
            i += 1
        if i >= len(text) or text[i] != "{":
            continue
        depth = 0
        in_str = False
        esc = False
        for j in range(i, len(text)):
            ch = text[j]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        out.append(text[i : j + 1])
                        break
    return out


def _walk_menu_paths(node, out: list[str]) -> None:
    """递归菜单树收集 [1] 位路径；元素第 6 位（[5]）是子节点字典。

    鲁港通 - TID 菜单节点格式：{"id":["标题","相对路径","","id","N",{子节点}]}。
    """
    if not isinstance(node, dict):
        return
    for val in node.values():
        if not isinstance(val, list) or len(val) < 2:
            continue
        path = val[1] if isinstance(val[1], str) else ""
        if path.strip():
            out.append(path.strip())
        if len(val) > 5 and isinstance(val[5], dict):
            _walk_menu_paths(val[5], out)


def parse_js_menu(content: bytes, cfg: dict) -> list[DiscoveredItem]:
    """解析静态 JS 菜单文件（如 TID tc_top_menu.js），提取白名单栏目下的文章页。

    鲁港通 - 实测 https://www.tid.gov.hk（probe2，2026-09-12）：栏目页是 JS 空壳
    （main_card_section 由 JS 填充，抓回来只有导航框架），但全站栏目树在
    /js/data/tc_top_menu.js 静态文件里，从菜单出发可枚举全部政策文章页。

    cfg（写入 sources.yaml 的 js_menu_config）：
      base_url          菜单内相对路径基准（如 https://www.tid.gov.hk/tc/）
      allow_prefixes    政策栏目白名单（相对路径前缀）；菜单里的「貿易通告」
                        「統計資料」等非政策栏目与站务页靠它排除
      exclude_prefixes  白名单栏目内仍需排除的子目录（实测 TID：陈旧 404 链接页、
                        宣传物料与宣讲视频等非政策内容）
      exclude_substrings 白名单栏目内按文件名片段排除（实测 TID：reference_links /
                        useful_links / mainland_link 等「相關網址」链接集合页散布在
                        多个目录下、无公共前缀，纯外链导航非政策内容）
    菜单标题是栏目名不是文章标题，故不带 title（由 extract 从文章页提取）。
    """
    import json

    text = content.decode("utf-8-sig", errors="replace")
    paths: list[str] = []
    for obj_text in _extract_js_objects(text):
        try:
            data = json.loads(obj_text)
        except ValueError:
            continue
        _walk_menu_paths(data, paths)

    base_url = cfg.get("base_url") or ""
    prefixes = [p for p in (cfg.get("allow_prefixes") or []) if isinstance(p, str) and p]
    excludes = [p for p in (cfg.get("exclude_prefixes") or []) if isinstance(p, str) and p]
    exclude_subs = [s for s in (cfg.get("exclude_substrings") or []) if isinstance(s, str) and s]

    items: list[DiscoveredItem] = []
    seen: set[str] = set()
    for path in paths:
        # 站外绝对链接（http(s)://）、查询串跳转（?page=link）与非 .html（PDF 等）排除
        if path.startswith(("http://", "https://")) or "?" in path:
            continue
        if not path.lower().endswith(".html"):
            continue
        if prefixes and not any(path.startswith(p) for p in prefixes):
            continue
        if excludes and any(path.startswith(p) for p in excludes):
            continue
        if exclude_subs and any(s in path for s in exclude_subs):
            continue
        url = urljoin(base_url, path)
        if url and url not in seen:
            seen.add(url)
            items.append(DiscoveredItem(url=url))
    return items


# ---------------------------------------------------------------------------
# fixed_url（施政报告等固定页：直接返回自身）
# ---------------------------------------------------------------------------

def parse_fixed(urls: list[str]) -> list[DiscoveredItem]:
    return [DiscoveredItem(url=u) for u in urls]


# ---------------------------------------------------------------------------
# api_json（政务 JSON 接口：海右人社政策通 portalList，列表项直接内嵌全文）
# ---------------------------------------------------------------------------

def parse_api_json(content: bytes, cfg: dict) -> list[DiscoveredItem]:
    """解析政务 JSON 列表接口，每条 row 组装成带内嵌正文的 DiscoveredItem。

    cfg（写入 sources.yaml 的 api_config.parse）：
      rows_path    列表数组取值路径（点分，默认 "rows"）
      id_field     唯一标识字段（默认 "id"），用于拼 canonical_url
      title_field  标题字段（如 "zcmc" 政策名称）
      url_template 含 {id} 占位的详情 URL 模板（实测真实、域名内、返回权威 JSON）
      body_fields  [[中文标签, 字段名], ...] 依序拼进正文；值本身可为 HTML 片段。
                   省略（不配）→ body_html=None，pipeline 转两段式：二次抓 url_template
                   详情页 + content_selector 提正文（济南市政府文件库 do-search 即此形态）。

    实测依据（recon-rc.log / rc_policyList.network-response）：portalList 返回
    {total, rows:[{id, zcmc, applicableObjects, applyCondition, zczc, ...}], code, msg}，
    rows 每条已含政策全文，无需再爬 SPA 详情页。解析失败一律按 0 条处理，绝不抛异常
    （政府接口偶发返回 500 HTML）。
    """
    import json

    try:
        payload = json.loads(content.decode("utf-8", errors="replace"))
    except (ValueError, TypeError):
        return []

    rows = payload
    for key in (cfg.get("rows_path") or "rows").split("."):
        if not isinstance(rows, dict):
            return []
        rows = rows.get(key)
    if not isinstance(rows, list):
        return []

    id_field = cfg.get("id_field") or "id"
    title_field = cfg.get("title_field")
    url_template = cfg.get("url_template") or ""
    body_fields = cfg.get("body_fields") or []
    if not url_template:
        return []

    items: list[DiscoveredItem] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        rid = row.get(id_field)
        # 无 id 无法构造稳定 canonical_url（去重/溯源均依赖它），跳过
        if rid is None or rid == "":
            continue
        title = None
        if title_field:
            title = (row.get(title_field) or "").strip() or None
        items.append(
            DiscoveredItem(
                url=url_template.format(id=rid),
                title=title,
                # 鲁港通 - 配了 body_fields → 内嵌全文单段式入库（海右 rc portalList）；
                # 未配 → body_html=None，触发 pipeline 二次抓详情页（济南文件库 do-search 两段式）。
                body_html=_compose_body_html(row, title_field, body_fields) if body_fields else None,
            )
        )
    return items


def _compose_body_html(row: dict, title_field: str | None, body_fields: list) -> str:
    """把标题与 body_fields 映射的字段拼成结构化 HTML（值本身可能已是 HTML 片段）。

    空字段跳过（省级政策常缺 publishTime/phone 等）；拼出的 HTML 交给 extract_html
    统一清洗成纯文本，与网页采集走同一条正文净化与入库路径。
    """
    parts: list[str] = []
    title = (row.get(title_field) or "").strip() if title_field else ""
    if title:
        parts.append(f"<h1>{title}</h1>")
    for entry in body_fields:
        if not isinstance(entry, (list, tuple)) or len(entry) != 2:
            continue
        label, key = entry
        val = row.get(key)
        if val is None or (isinstance(val, str) and not val.strip()):
            continue
        parts.append(f"<h2>{label}</h2><div>{val}</div>")
    return "".join(parts)
