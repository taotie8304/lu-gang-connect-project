# 鲁港通 - PDF 文本层提取测试（离线，构造最小合法 PDF，不发网络）
from __future__ import annotations

from app.ingest.extract import extract_pdf

# 鲁港通 - 必须先导入 models，conftest 的 create_all 才能建出全套表
from app.models import DocumentVersion, Source  # noqa: F401


def _build_pdf(lines: list[str], title: str | None = None) -> bytes:
    """构造带正确 xref 的最小单页 PDF（Helvetica，仅 ASCII 内容）。"""
    ops = ["BT /F1 12 Tf 20 760 Td 14 TL"]
    for ln in lines:
        ops.append(f"({ln}) Tj T*")
    ops.append("ET")
    content = "\n".join(ops).encode("latin-1")
    objs: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    if title is not None:
        objs.append(("<< /Title (%s) /Producer (lugang-test) >>" % title).encode("latin-1"))

    out = b"%PDF-1.4\n"
    offsets: list[int] = []
    for idx, obj in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % idx + obj + b"\nendobj\n"
    trailer = "<< /Size %d /Root 1 0 R" % (len(objs) + 1)
    if title is not None:
        trailer += " /Info %d 0 R" % len(objs)
    trailer += " >>"
    xref_pos = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n" + trailer.encode("latin-1")
    out += b"\nstartxref\n%d\n%%%%EOF\n" % xref_pos
    return out


def test_extract_pdf_reads_text_layer_and_metadata_title():
    pdf = _build_pdf(
        [
            "Corporate account opening document checklist",
            "Company registration certificate is required.",
            "Business registration certificate and proof of address are required.",
        ],
        title="Account Opening Documents",
    )
    result = extract_pdf(pdf)
    assert result.title == "Account Opening Documents"
    assert result.text is not None
    assert "Corporate account opening document checklist" in result.text
    assert "Business registration certificate" in result.text
    # 鲁港通 - 多行文本以换行保留、不粘成一串
    assert "required." in result.text and "\n" in result.text


def test_extract_pdf_without_text_layer_returns_no_text():
    # 扫描件/图片型 PDF：无文本层 → text 为空，交由导入器跳过（诚实兜底）
    pdf = _build_pdf([])
    result = extract_pdf(pdf)
    assert result.text is None
    assert result.title is None


def test_extract_pdf_invalid_bytes_does_not_raise():
    result = extract_pdf(b"not a pdf at all")
    assert result.text is None


def test_store_document_saves_pdf_text_layer(db):
    """pipeline 集成：PDF 文本层写入 DocumentVersion.extracted_text（导入器据此入库）。"""
    from sqlalchemy import select

    from app.ingest.discover import DiscoveredItem
    from app.ingest.pipeline import _store_document
    from app.models import DocumentVersion, Source
    from app.security.fetcher import FetchResult

    source = Source(
        code="hk_bank_test",
        name="测试银行",
        source_group="hk_bank_open",
        organization="测试银行",
        discovery_method="fixed_url",
        discovery_config={},
    )
    db.add(source)
    db.flush()

    pdf = _build_pdf(
        [
            "Corporate account opening document checklist",
            "Company registration certificate and business registration certificate.",
        ],
        title="Checklist",
    )
    url = "https://example.com/docs/checklist.pdf"
    result = FetchResult(
        final_url=url, http_status=200, content_type="application/pdf", content=pdf
    )
    action = _store_document(db, source, url, result, DiscoveredItem(url=url, title="清单"))
    db.commit()

    assert action == "new"
    version = db.execute(select(DocumentVersion)).scalar_one()
    assert version.extracted_text and "Corporate account opening" in version.extracted_text
