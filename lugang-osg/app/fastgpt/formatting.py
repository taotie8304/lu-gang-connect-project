# 鲁港通 - 导入正文格式化（design.md §7.3.4）：
# 元数据头（标题/发布机构/发布日期/原文链接）+ 清洗全文，保证回答可溯源。
from datetime import date, datetime


def _format_date(value: date | datetime | None) -> str | None:
    """日期归一为 YYYY-MM-DD（字符串原样返回），空值返回 None。"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    return text or None


def build_import_text(
    *,
    title: str,
    url: str,
    organization: str | None,
    published_at: date | datetime | None,
    body: str,
) -> str:
    """拼接导入文本：元数据头（缺失字段整行省略）+ 空行 + strip 后正文。"""
    lines = [f"标题：{title}"]
    if organization:
        lines.append(f"发布机构：{organization}")
    publish_date = _format_date(published_at)
    if publish_date:
        lines.append(f"发布日期：{publish_date}")
    lines.append(f"原文链接：{url}")
    return "\n".join(lines) + "\n\n" + (body or "").strip()
