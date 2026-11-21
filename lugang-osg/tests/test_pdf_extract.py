# 鲁港通 - PDF 原文件链路测试（离线，构造最小合法 PDF，不发网络）：
# 2026-11-20 用户口径——PDF 不提取正文，原文件落盘后直传 FastGPT 文件集合
from __future__ import annotations

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


def test_store_document_saves_pdf_raw_file_without_text_extraction(db, tmp_path):
    """pipeline 集成：PDF 原文件落盘（raw_object_key），不再提取正文（2026-11-21 用户口径）。

    导入器随后直传原文件到 FastGPT 文件集合；列表锚文本是「请按此查看PDF版本」这类
    残渣时，标题必须优先用 PDF 元数据标题。
    """
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
    action = _store_document(
        db, source, url, result,
        DiscoveredItem(url=url, title="请按此查看PDF版本"),
        pdf_store_dir=str(tmp_path),
    )
    db.commit()

    assert action == "new"
    version = db.execute(select(DocumentVersion)).scalar_one()
    # 鲁港通 - 不提取正文；原文件内容寻址落盘
    assert version.extracted_text is None
    assert version.raw_object_key and version.raw_object_key.endswith(".pdf")
    saved = tmp_path / version.raw_object_key
    assert saved.exists() and saved.read_bytes() == pdf
    # 鲁港通 - PDF 元数据标题优先于列表锚文本残渣
    from app.models import Document
    doc = db.execute(select(Document)).scalar_one()
    assert doc.title == "Checklist"


def test_unchanged_pdf_backfills_raw_file_for_legacy_docs(db, tmp_path):
    """存量 PDF（旧文本层版本、无原文件）内容未变时补落盘，免重抓即可迁移文件集合。"""
    import hashlib

    from sqlalchemy import select

    from app.ingest.discover import DiscoveredItem
    from app.ingest.pipeline import _store_document
    from app.models import Document, DocumentVersion, Source
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

    pdf = _build_pdf(["Admission guide"], title="Admission Guide")
    url = "https://example.com/docs/guide.pdf"
    doc = Document(source_id=source.id, canonical_url=url, title="招生指引", status="active")
    db.add(doc)
    db.flush()
    legacy = DocumentVersion(
        document_id=doc.id,
        fetched_url=url,
        final_url=url,
        content_sha256=hashlib.sha256(pdf).hexdigest(),
        extracted_text="旧文本层正文",
        raw_object_key=None,
        is_current=True,
    )
    db.add(legacy)
    db.flush()
    doc.latest_version_id = legacy.id
    db.flush()

    result = FetchResult(
        final_url=url, http_status=200, content_type="application/pdf", content=pdf
    )
    action = _store_document(
        db, source, url, result,
        DiscoveredItem(url=url, title="请按此查看PDF版本"),
        pdf_store_dir=str(tmp_path),
    )
    db.commit()

    assert action == "unchanged"
    version = db.execute(select(DocumentVersion)).scalar_one()
    assert version.raw_object_key and version.raw_object_key.endswith(".pdf")
    assert (tmp_path / version.raw_object_key).read_bytes() == pdf


def test_extract_pdf_title_strips_word_prefix():
    """PDF 元数据标题清洗：微软 Office 生成器前缀不进入知识库集合名。"""
    from app.ingest.extract import extract_pdf_title

    pdf = _build_pdf(["body"], title="Microsoft Word - Admission Guide 2027.docx")
    assert extract_pdf_title(pdf) == "Admission Guide 2027"


def test_extract_pdf_title_missing_metadata():
    from app.ingest.extract import extract_pdf_title

    assert extract_pdf_title(_build_pdf(["body"])) is None
    assert extract_pdf_title(b"not a pdf") is None


def test_pdf_title_falls_back_to_url_filename_when_anchor_is_placeholder():
    """鲁港通 - 港中文学费表实测：PDF 无元数据标题且链接锚文本是占位词「document」，
    须退到 URL 文件名生成可读标题，集合名不能叫 document.pdf。"""
    from app.ingest.extract import is_junk_pdf_title, pdf_title_from_url

    assert is_junk_pdf_title("document")
    assert is_junk_pdf_title(" Download ")
    assert is_junk_pdf_title("PDF")
    assert not is_junk_pdf_title("入學指南 2027")
    assert not is_junk_pdf_title(None)

    url = ("https://admission.cuhk.edu.hk/wp-content/uploads/2026/10/"
           "local_students_category_2027-entry.pdf")
    assert pdf_title_from_url(url) == "Local students category 2027 entry"
    # 鲁港通 - 查询串不得混进标题；非 PDF 路径也容忍（取末段）
    assert pdf_title_from_url("https://x/a/Admission_Guide.PDF?from=list") == "Admission Guide"
    assert pdf_title_from_url("https://x/") is None
