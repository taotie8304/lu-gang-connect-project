# 鲁港通 - 导入正文格式化测试（TDD）：元数据头 + 清洗全文，字段缺失时不出现 None
from datetime import date, datetime, timezone

from app.fastgpt.formatting import build_import_text


def test_full_metadata_header():
    text = build_import_text(
        title="2026年施政報告公眾諮詢",
        url="https://www.policyaddress.gov.hk/2026/tc/index.html",
        organization="香港特别行政区政府",
        published_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
        body="正文内容……",
    )
    assert text.startswith(
        "标题：2026年施政報告公眾諮詢\n"
        "发布机构：香港特别行政区政府\n"
        "发布日期：2026-08-01\n"
        "原文链接：https://www.policyaddress.gov.hk/2026/tc/index.html\n\n"
    )
    assert text.endswith("正文内容……")


def test_missing_optional_fields_omitted():
    text = build_import_text(
        title="测试标题",
        url="https://example.com/a",
        organization=None,
        published_at=None,
        body="b",
    )
    assert "发布机构" not in text
    assert "发布日期" not in text
    assert "None" not in text
    assert text == "标题：测试标题\n原文链接：https://example.com/a\n\nb"


def test_date_accepts_date_object():
    text = build_import_text(
        title="t",
        url="u",
        organization="o",
        published_at=date(2026, 9, 1),
        body="b",
    )
    assert "发布日期：2026-09-01" in text


def test_body_is_stripped():
    text = build_import_text(
        title="t", url="u", organization="o", published_at=None, body="  正文呢  \n\n"
    )
    assert text.endswith("正文呢")
    assert "\n\n\n" not in text
