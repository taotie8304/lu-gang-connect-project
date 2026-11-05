# 鲁港通 - 文档身份归一（同文判重）：把「同一篇文章的多种网址形态」折成同一个判重键。
#
# 为什么需要：采集入库按 URL 精确串判重，而政府网站同一份文件常以多种形态链出——
#   1) 多栏目挂载（长清/市中实测：/gongkai/site_x/channel_y/doc_a.html 与
#      /gongkai/channel_z/doc_a.html 是同一个文件）；
#   2) 列表页每次渲染都换一个临时参数（起步区实测：art_x.html?type=<token>）。
# 每种形态都新建一条 Document，于是知识库出现同名多份文件。
#
# 边界：身份只作为**内存里的查表键**，不写回 document.canonical_url——用户可见的来源
# 网址必须保持原样（引用与点开的都是它）。规则按来源显式配置，未配置的来源行为不变；
# 无规则时唯一的归一是丢锚点与末尾斜杠，因此存量文档不会被判为陌生网址。
from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def has_identity_rules(cfg: dict | None) -> bool:
    return bool(cfg and (cfg.get("url_identity_path_capture") or cfg.get("url_identity_ignore_params")))


def identity_key(url: str, cfg: dict | None) -> str:
    """判重查表键。

    鲁港通 - 只有显式配置了身份规则的来源才折叠网址形态；其余 40+ 个在线来源保持按原始
    网址精确匹配，与改造前逐字节一致（含锚点、末尾斜杠），避免无差别归一让存量文档被判
    成陌生网址、或让 SPA 式 #/tab 差异页面被误并为同一篇。
    """
    return document_identity(url, cfg) if has_identity_rules(cfg) else url


def document_identity(url: str, cfg: dict | None) -> str:
    """返回 url 的文档身份串；cfg 缺省或异常输入时原样返回（判重退化为按网址精确匹配）。"""
    if not isinstance(url, str) or not url.strip():
        return url if isinstance(url, str) else ""
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return url
    if not parts.scheme or not parts.netloc:
        return url

    cfg = cfg or {}
    path = parts.path or "/"
    captured = _capture_identity_path(path, cfg.get("url_identity_path_capture"))
    if captured:
        path = captured
    path = path.rstrip("/") or "/"

    query = _drop_params(parts.query, cfg.get("url_identity_ignore_params"))
    return urlunsplit((parts.scheme, parts.netloc, path, query, ""))


def _capture_identity_path(path: str, pattern) -> str | None:
    """命中捕获组则以「/编号」为身份路径——不同栏目挂载折成同一篇，不同编号仍分开。"""
    if not isinstance(pattern, str) or not pattern:
        return None
    try:
        matched = re.search(pattern, path)
    except re.error:
        return None
    if matched is None:
        return None
    token = matched.group(1) if matched.groups() else matched.group(0)
    token = (token or "").lstrip("/")
    return f"/{token}" if token else None


def _drop_params(query: str, names) -> str:
    """只丢掉来源显式声明「会漂移」的参数；其余参数与顺序原样保留。"""
    if not query or not names:
        return query
    ignored = {str(n).strip().lower() for n in names if str(n).strip()}
    if not ignored:
        return query
    kept = [(k, v) for k, v in parse_qsl(query, keep_blank_values=True)
            if k.lower() not in ignored]
    return urlencode(kept)
