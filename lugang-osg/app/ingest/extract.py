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
    """提取 <title> 与净化正文：跳过噪声标签，压缩空白。

    鲁港通 - 配置了容器选择器时额外收集容器内正文（如山东政务站实测的 `#zoom`），
    可剔除面包屑、字号控件、相关报道等 UI 噪声；容器未命中则回退全文，
    避免站点改版导致正文为空。
    """

    def __init__(self, selector: tuple[str, str] | None = None) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.container_parts: list[str] = []
        self._selector = selector
        self._skip_depth = 0
        self._in_title = False
        self._container_depth = 0   # >0 表示当前在目标容器内
        self._nested_div = 0        # 容器内嵌套标签计数（用于定位容器结束）

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in _DROP_TAGS:
            self._skip_depth += 1
            return
        if tag == "title":
            self._in_title = True
            return
        if self._container_depth > 0:
            self._nested_div += 1
        elif self._selector and _match_selector(tag, attrs, self._selector):
            self._container_depth = 1
            self._nested_div = 0
        if tag in _BLOCK_TAGS:
            self.text_parts.append("\n")
            if self._container_depth > 0:
                self.container_parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _DROP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if tag == "title":
            self._in_title = False
            return
        if self._container_depth > 0:
            # 鲁港通 - 容器内嵌套标签逐层抵消，归零时即容器结束
            if self._nested_div > 0:
                self._nested_div -= 1
            else:
                self._container_depth = 0

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
            return
        if self._skip_depth > 0 or not data.strip():
            return
        self.text_parts.append(data)
        if self._container_depth > 0:
            self.container_parts.append(data)

    @property
    def container_text(self) -> str | None:
        """容器内正文（未配置选择器或未命中容器时为 None）。"""
        if not self._selector or not self.container_parts:
            return None
        return _squeeze("".join(self.container_parts)) or None


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


def extract_html(
    content: bytes,
    *,
    content_selector: str | None = None,
    organization: str | None = None,
    title_strip_prefixes: list[str] | None = None,
) -> ExtractedContent:
    """提取 HTML 标题与净化正文。

    content_selector：实测确认的正文容器（如山东政务站 `#zoom`），命中时正文只取
    容器内内容；未配置或未命中则回退全文（去噪声标签 + 压缩空白）。
    organization：来源机构名，用于清洗 <title> 里的站点名前缀。
    title_strip_prefixes：显式标题前缀（如 TID 繁体「工業貿易署 - 」——与简体 org
    匹配不上），命中即剥离。
    """
    parser = _TextExtractor(_parse_selector(content_selector))
    parser.feed(_decode_html(content))
    raw_title = "".join(parser.title_parts).strip() or None
    # 鲁港通 - 容器正文优先（剔除面包屑/字号控件/相关报道），未命中回退全文
    text = parser.container_text or _squeeze("".join(parser.text_parts))
    title = clean_title(raw_title, organization, title_strip_prefixes)
    return ExtractedContent(
        title=title, text=text or None, language_hint=_lang_hint(title, text)
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
) -> str | None:
    """清洗 <title>：去掉站点名/栏目名前缀，保留真实文章标题。

    仅在标题以机构名（或其括号前核心名）开头时处理；其余情况（如港府英文标题）原样返回。
    strip_prefixes：配置化的显式前缀（如 TID 繁体「工業貿易署 - 」，与简体 org
    匹配不上），优先剥离；剥离后剩空则保持原样。
    """
    title = (raw or "").strip()
    if not title:
        return None
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
