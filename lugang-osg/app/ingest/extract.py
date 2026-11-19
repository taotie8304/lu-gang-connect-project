# 鲁港通 - 内容提取（spec 第 9 节）：HTML → title + 净化正文；PDF 只做元信息登记
# （正文提取留待 RAG 阶段按数据集类型细分，Phase 2 先保证 title/text 可检索）。
from __future__ import annotations

import re
from dataclasses import dataclass

from app.ingest.discover import _decode_html
from html.parser import HTMLParser

# 鲁港通 - 提取时丢弃的噪声标签（正文判断鲁港通用，非精确正文抽取）
_DROP_TAGS = frozenset(
    {"script", "style", "noscript", "iframe", "svg", "nav", "header", "footer", "form"}
)

_BLOCK_TAGS = frozenset(
    {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "td"}
)

# 鲁港通 - 无结束标签的 void 元素：不压栈，否则整页标签栈与容器边界会错位
_VOID_TAGS = frozenset(
    {"area", "base", "br", "col", "embed", "hr", "img", "input",
     "link", "meta", "param", "source", "track", "wbr"}
)

# 鲁港通 - 导航/菜单类 class/id 词元（2026-11-19 用户反馈：银行/证券站整屏导航
# 被当正文入库）：属性值按非字母数字切分后命中任一词元即整块剔除子树。
# 只做整词匹配，避免误伤 article-header 这类正文块；html/body/head/main 等
# 骨架标签豁免，防整页误杀。
_NOISE_ATTR_TOKENS = frozenset({
    "nav", "navbar", "navigation", "navlist", "topnav", "mainnav", "headnav",
    "subnav", "sidenav", "leftnav", "rightnav", "footnav",
    "menu", "submenu", "megamenu", "menubar", "dropdown",
    "breadcrumb", "breadcrumbs",
    "header", "footer", "topbar", "sidebar",
    "sitemap", "skip", "skiplink",
    "cookie", "cookies", "consent",
    "share", "sharing", "social",
    "search", "toolbar", "pagination", "pager", "paging",
    "related", "recommend", "recommendation",
    "copyright", "logo",
})
_NOISE_EXEMPT_TAGS = frozenset({"html", "body", "head", "main", "article", "section"})
_ATTR_TOKEN_RE = re.compile(r"[^a-z0-9]+")

# 鲁港通 - 实测正文长度门槛：山东栏目页/首页提取后仅 28~59 字（导航噪声），
# 真实文章页 900+ 字；低于此值视为非文章页，不入库（避免污染 RAG 语料）。
MIN_CONTENT_CHARS = 200


def _parse_selector(selector: str | None) -> tuple[str, str] | None:
    """解析极简选择器：`#id` 或 `.class`（实测政务站正文容器均为这两种）。

    不支持组合/层级选择器；返回 (属性名, 值) 或 None（未配置/不识别）。
    """
    if not selector:
        return None
    sel = selector.strip()
    if sel.startswith("#") and len(sel) > 1:
        return ("id", sel[1:].strip().lower())
    if sel.startswith(".") and len(sel) > 1:
        return ("class", sel[1:].strip().lower())
    return None


class _TextExtractor(HTMLParser):
    """提取 <title> 与净化正文：跳过噪声标签/噪声区块，压缩空白。

    鲁港通 - 配置了容器选择器时额外收集容器内正文（如山东政务站实测的 `#zoom`），
    可剔除面包屑、字号控件、相关报道等 UI 噪声；容器未命中则回退全文，
    避免站点改版导致正文为空。
    鲁港通 - keep_form（HKEAA 实测）：ASP.NET 站点把整个 body 包进 <form>，
    默认丢 form 会把整页正文清空；来源开启后 form 不再计入噪声标签。
    鲁港通 - 噪声区块（2026-11-19）：class/id 命中导航词元的元素整块剔除
    （覆盖 div 菜单、面包屑、页脚链接等非语义标签承载的导航）；同时统计链接
    文字占比，供上层拦截「整屏链接堆叠」的导航枢纽页。
    """

    def __init__(self, selector: tuple[str, str] | None = None, keep_form: bool = False) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.container_parts: list[str] = []
        self._selector = selector
        self._drop = _DROP_TAGS - {"form"} if keep_form else _DROP_TAGS
        self._in_title = False
        # 标签栈：(tag, suppressed, container)；suppressed 向下继承，container 标记容器根
        self._stack: list[tuple[str, bool, bool]] = []
        self._text_chars = 0
        self._link_chars = 0
        self._link_count = 0
        self._container_chars = 0
        self._container_link_chars = 0
        self._container_link_count = 0

    @property
    def _suppressed(self) -> bool:
        return bool(self._stack) and self._stack[-1][1]

    @property
    def _in_container(self) -> bool:
        return any(c for _, _, c in self._stack)

    def _newline(self) -> None:
        self.text_parts.append("\n")
        if self._in_container:
            self.container_parts.append("\n")

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in _VOID_TAGS:
            if not self._suppressed and tag in _BLOCK_TAGS:
                self._newline()
            return
        suppressed = (
            self._suppressed
            or tag in self._drop
            or _is_noise_element(tag, attrs)
        )
        container = (
            not suppressed
            and self._selector is not None
            and not self._in_container
            and _match_selector(tag, attrs, self._selector)
        )
        self._stack.append((tag, suppressed, container))
        if suppressed:
            return
        if tag == "title":
            self._in_title = True
            return
        if tag == "a":
            self._link_count += 1
            if self._in_container:
                self._container_link_count += 1
        if tag in _BLOCK_TAGS:
            self._newline()

    def handle_endtag(self, tag: str) -> None:
        if tag in _VOID_TAGS:
            return
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i][0] != tag:
                continue
            if tag == "title" and not self._stack[i][1]:
                self._in_title = False
            del self._stack[i:]
            return

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
            return
        stripped = data.strip()
        if not stripped or self._suppressed:
            return
        self.text_parts.append(data)
        chars = len(stripped)
        self._text_chars += chars
        in_link = any(t == "a" and not s for t, s, _ in self._stack)
        if in_link:
            self._link_chars += chars
        if self._in_container:
            self.container_parts.append(data)
            self._container_chars += chars
            if in_link:
                self._container_link_chars += chars

    @property
    def container_text(self) -> str | None:
        """容器内正文（未配置选择器或未命中容器时为 None）。"""
        if not self._selector or not self.container_parts:
            return None
        return _squeeze("".join(self.container_parts)) or None

    @property
    def link_text_ratio(self) -> float:
        """全文口径的链接文字占比（0~1）。"""
        return self._link_chars / self._text_chars if self._text_chars else 0.0

    @property
    def container_link_text_ratio(self) -> float:
        """容器口径的链接文字占比（0~1；无容器文本时为 0）。"""
        if not self._container_chars:
            return 0.0
        return self._container_link_chars / self._container_chars

    @property
    def link_count(self) -> int:
        """全文口径的链接数。"""
        return self._link_count

    @property
    def container_link_count(self) -> int:
        """容器口径的链接数。"""
        return self._container_link_count


def _is_noise_element(tag: str, attrs) -> bool:
    """class/id 词元命中导航噪声词即整块剔除（骨架标签豁免）。"""
    if tag in _NOISE_EXEMPT_TAGS:
        return False
    for name, value in attrs:
        if name not in ("class", "id") or not value:
            continue
        for token in _ATTR_TOKEN_RE.split(value.lower()):
            if token and token in _NOISE_ATTR_TOKENS:
                return True
    return False


def _match_selector(tag: str, attrs, selector: tuple[str, str]) -> bool:
    """判断标签是否命中选择器（class 为多值时空格切分后比对）。"""
    attr, want = selector
    for name, value in attrs:
        if name != attr or not value:
            continue
        if attr == "class":
            if want in [c.strip().lower() for c in value.split()]:
                return True
        elif value.strip().lower() == want:
            return True
    return False


@dataclass(frozen=True)
class ExtractedContent:
    """提取结果（PDF 无 extracted_text，只有 content_type）。"""

    title: str | None
    text: str | None
    language_hint: str | None = None
    # 鲁港通 - 链接密度指标（0~1 为链接文字占正文字符比），供导航枢纽页拦截
    link_text_ratio: float = 0.0
    link_count: int = 0


def extract_html(
    content: bytes,
    *,
    content_selector: str | None = None,
    organization: str | None = None,
    title_strip_prefixes: list[str] | None = None,
    title_strip_suffixes: list[str] | None = None,
    keep_form: bool = False,
) -> ExtractedContent:
    """提取 HTML 标题与净化正文。

    content_selector：实测确认的正文容器（如山东政务站 `#zoom`），命中时正文只取
    容器内内容；未配置或未命中则回退全文（去噪声标签 + 压缩空白）。
    organization：来源机构名，用于清洗 <title> 里的站点名前缀。
    title_strip_prefixes：显式标题前缀（如 TID 繁体「工業貿易署 - 」——与简体 org
    匹配不上），命中即剥离。
    title_strip_suffixes：显式标题后缀（如 InvestHK「标题 | InvestHK」）。
    keep_form：ASP.NET 整页 form 包裹站点（HKEAA 实测）保留 form 内文本。
    """
    parser = _TextExtractor(_parse_selector(content_selector), keep_form=keep_form)
    parser.feed(_decode_html(content))
    raw_title = "".join(parser.title_parts).strip() or None
    # 鲁港通 - 容器正文优先（剔除面包屑/字号控件/相关报道），未命中回退全文
    container_text = parser.container_text
    text = container_text or _squeeze("".join(parser.text_parts))
    title = clean_title(raw_title, organization, title_strip_prefixes,
                        title_strip_suffixes)
    # 鲁港通 - 链接密度按实际采用的正文口径统计（容器命中看容器，否则看全文）
    if container_text is not None:
        ratio = parser.container_link_text_ratio
        count = parser.container_link_count
    else:
        ratio = parser.link_text_ratio
        count = parser.link_count
    return ExtractedContent(
        title=title,
        text=text or None,
        language_hint=_lang_hint(title, text),
        link_text_ratio=ratio,
        link_count=count,
    )


# 鲁港通 - 站点名/栏目名与文章标题之间的字段分隔（空格或 _ | 等）；仅用于剥掉紧邻的栏目名一段。
# 注意：文章标题内部也可能含空格/破折号（—）/间隔号（·），故绝不能按这些字符把整条标题切碎。
_COLUMN_SEG_RE = re.compile(r"[^\s_|·—]+[\s_|·—]+")
# 鲁港通 - 机构名括号（中/英文）切分：org 可能带“（省委教育工委）”类后缀，
# 而站点 <title> 前缀只用括号前核心名，故剥离前缀时须能退化到核心名。
_ORG_PAREN_RE = re.compile(r"[（(]")


def clean_title(
    raw: str | None,
    organization: str | None = None,
    strip_prefixes: list[str] | None = None,
    strip_suffixes: list[str] | None = None,
) -> str | None:
    """清洗 <title>：去掉站点名/栏目名前缀，保留真实文章标题。

    仅在标题以机构名（或其括号前核心名）开头时处理；其余情况（如港府英文标题）原样返回。
    strip_prefixes：配置化的显式前缀（如 TID 繁体「工業貿易署 - 」，与简体 org
    匹配不上），优先剥离；剥离后剩空则保持原样。
    strip_suffixes：配置化的显式后缀（如 InvestHK「 | InvestHK」），命中即剥离。
    """
    title = (raw or "").strip()
    if not title:
        return None
    # 鲁港通 - 站点名后缀（InvestHK 实测「标题 | InvestHK」）先剥，再走机构/栏目前缀清洗
    for suffix in strip_suffixes or []:
        if not isinstance(suffix, str) or not suffix or not title.endswith(suffix):
            continue
        rest = title[: -len(suffix)].strip(" \t_|·—-")
        if rest:
            title = rest
        break
    # 鲁港通 - 显式前缀优先（实测 TID：繁体站点名 vs 简体 org，startswith 匹配不上）
    for p in strip_prefixes or []:
        if not isinstance(p, str) or not p or not title.startswith(p):
            continue
        rest = title[len(p):].strip(" \t_|·—-")
        if rest:
            title = rest
        break
    org = (organization or "").strip()
    if not org:
        return title
    # 鲁港通 - 先试完整 org，不匹配再退化到括号前核心名（处理教育厅“（省委教育工委）”类后缀）
    prefix = org if title.startswith(org) else _ORG_PAREN_RE.split(org, 1)[0].strip()
    if not prefix or not title.startswith(prefix):
        return title
    rest = title[len(prefix):].strip(" \t_|·—-")
    if not rest:
        return title      # 标题就是机构名本身（栏目页/首页），无可清洗
    # 鲁港通 - <title> 实测格式「站点名 栏目名 文章标题」：剥掉站点名后，首段是栏目名（短分类词，
    # 如“政策发布/其他文件/商务要闻”），其后是完整文章标题。标题内部常含空格或破折号
    # （如《…（2026—2028年）》、多条款“…办学活力 加快构建…”），故只剥紧邻的栏目名一段、
    # 其余原样保留，绝不按分隔符把标题切碎（旧“取最长段”实测截断损坏 kjt15/gxt4/edu3=22 篇）。
    m = _COLUMN_SEG_RE.match(rest)
    if m:
        remainder = rest[m.end():].strip(" \t_|·—-")
        # 剥掉栏目名后仍需 ≥ 8 字才认定确有文章标题，否则视为无栏目名、返回整段（防误剥标题首词）
        if len(remainder) >= 8:
            return remainder
    return rest


def extract_pdf(content: bytes) -> ExtractedContent:
    """PDF：Phase 2 只登记元信息（哈希 + 大小），文本提取在 RAG 阶段做。"""
    return ExtractedContent(title=None, text=None)


def _squeeze(text: str) -> str:
    """压缩空白：连续空白/空行折叠为单个空格/换行，去首尾。"""
    lines = [ln.strip() for ln in text.splitlines()]
    out: list[str] = []
    blank = 0
    for ln in lines:
        if ln:
            out.append(ln)
            blank = 0
        else:
            blank += 1
            if blank == 1 and out:
                out.append("")
    return "\n".join(out).strip()


def _lang_hint(*texts: str | None) -> str | None:
    """粗略语言检测：供 document.language 初值（zh-Hant/zh-Hans/en）。"""
    sample = "".join(t for t in texts if t)[:2000]
    if not sample:
        return None
    # 鲁港通 - 简繁判定用高频差异字（严格繁/简成对，样本来自港府公报与山东政务实测）
    _TRAD = "灣務學處臺後發門別區聞報廳廣義條業壓員訊設師長"
    _SIMP = "湾务学处台后发门别区闻报厅广义条业压员讯设师长"
    trad = sum(sample.count(c) for c in _TRAD)
    simp = sum(sample.count(c) for c in _SIMP)
    cjk = sum(1 for c in sample if "\u4e00" <= c <= "\u9fff")
    if cjk < 5:
        return "en"
    if trad > simp:
        return "zh-Hant"
    if simp > trad:
        return "zh-Hans"
    return "zh"
