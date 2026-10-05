# 鲁港通 - FastGPT 导入编排测试（TDD）：FakeClient 替身 + SQLite 内存库，不发真实网络
import pytest

from app.fastgpt.client import FastGPTError
from app.fastgpt.importer import ImporterError, run_import, sync_names
from app.fastgpt.mapping import HK_DATASET_ID
from app.models import Document, DocumentVersion, ImportMap, Source

SHA1 = "a" * 64
SHA2 = "b" * 64
# 鲁港通 - 工业贸易署 CEPA 栏目样例 URL（/tc/our_work/cepa/ → 子文件夹 CEPA）
TID_URL = "https://www.tid.gov.hk/tc/our_work/cepa/x.html"


class FakeClient:
    """FastGPTClient 替身：记录调用序列，模拟文件夹层级与文本集合创建。"""

    def __init__(self, existing_folders=None):
        self.calls: list[tuple] = []
        self.ids: dict[str, str] = {}
        self.last_text_id: str | None = None
        self.fail_next_create_text = False
        self.fail_next_rename = False
        self._seq = 0
        # {(dataset_id, parent_id): [{"_id": ..., "name": ...}]}
        self.existing_folders = existing_folders or {}

    def list_collections(self, dataset_id, parent_id=None, *, folders_only=True):
        self.calls.append(("list", dataset_id, parent_id, folders_only))
        return list(self.existing_folders.get((dataset_id, parent_id), []))

    def create_folder(self, dataset_id, name, parent_id=None):
        self.calls.append(("folder", dataset_id, name, parent_id))
        self._seq += 1
        fid = f"F{self._seq:03d}"
        self.ids[name] = fid
        return fid

    def create_text(
        self, dataset_id, name, text, *, parent_id=None, tags=None, chunk_size=512
    ):
        self.calls.append(
            ("text", dataset_id, name, text, parent_id, tuple(tags or ()), chunk_size)
        )
        if self.fail_next_create_text:
            self.fail_next_create_text = False
            raise FastGPTError("模拟网络抖动")
        self._seq += 1
        self.last_text_id = f"C{self._seq:03d}"
        return self.last_text_id

    def rename(self, collection_id, name):
        self.calls.append(("rename", collection_id, name))
        if self.fail_next_rename:
            self.fail_next_rename = False
            raise FastGPTError("模拟改名失败")
        # 同步本地文件夹视图，使后续列表与改名结果一致
        for items in self.existing_folders.values():
            for item in items:
                if item.get("_id") == collection_id:
                    item["name"] = name

    def delete_collections(self, collection_ids):
        self.calls.append(("delete", tuple(collection_ids)))


def make_source(db, code="hk_tid", name="工业贸易署", organization="工业贸易署"):
    src = Source(
        code=code,
        name=name,
        source_group="hk",
        organization=organization,
        trust_level=1,
        enabled=True,
        discovery_method="rss",
    )
    db.add(src)
    db.flush()
    return src


def make_document(
    db,
    source,
    url,
    title="CEPA 货物贸易协议",
    sha=SHA1,
    text="正文内容",
    status="candidate",
):
    doc = Document(source_id=source.id, canonical_url=url, title=title, status=status)
    db.add(doc)
    db.flush()
    ver = DocumentVersion(
        document_id=doc.id,
        fetched_url=url,
        final_url=url,
        content_sha256=sha,
        extracted_text=text,
        is_current=True,
    )
    db.add(ver)
    db.flush()
    doc.latest_version_id = ver.id
    db.flush()
    return doc, ver


def add_new_version(db, doc, sha=SHA2, text="新正文"):
    db.query(DocumentVersion).filter(
        DocumentVersion.document_id == doc.id
    ).update({"is_current": False})
    ver = DocumentVersion(
        document_id=doc.id,
        fetched_url=doc.canonical_url,
        final_url=doc.canonical_url,
        content_sha256=sha,
        extracted_text=text,
        is_current=True,
    )
    db.add(ver)
    db.flush()
    doc.latest_version_id = ver.id
    db.flush()
    return ver


def write_imported(db, doc, ver, collection_id="OLD1", sha=SHA1):
    db.add(
        ImportMap(
            document_id=doc.id,
            dataset_id=HK_DATASET_ID,
            collection_id=collection_id,
            version_id=ver.id,
            content_sha256=sha,
            status="imported",
        )
    )
    db.flush()


# --- 首导全链路 ---


def test_first_import_creates_folders_and_collection(db):
    src = make_source(db)
    doc, ver = make_document(db, src, TID_URL)
    fake = FakeClient()

    report = run_import(db, fake, "hk_tid")

    assert (
        report.total,
        report.imported,
        report.rebuilt,
        report.skipped,
        report.duplicates,
        report.failed,
    ) == (1, 1, 0, 0, 0, 0)
    assert report.source_code == "hk_tid"

    kinds = [c[0] for c in fake.calls]
    assert kinds == ["list", "folder", "list", "folder", "text", "rename"]

    folder_calls = [c for c in fake.calls if c[0] == "folder"]
    assert [c[2] for c in folder_calls] == ["工业贸易署", "CEPA"]
    assert folder_calls[0][3] is None
    assert folder_calls[1][3] == fake.ids["工业贸易署"]

    text_call = [c for c in fake.calls if c[0] == "text"][0]
    assert text_call[1] == HK_DATASET_ID
    assert text_call[2] == "CEPA 货物贸易协议"
    assert text_call[4] == fake.ids["CEPA"]
    assert text_call[5] == ("香港", "工业贸易署")
    assert text_call[6] == 512
    body = text_call[3]
    assert "标题：CEPA 货物贸易协议" in body
    assert f"原文链接：{TID_URL}" in body
    assert "发布机构：工业贸易署" in body
    assert "正文内容" in body

    rename_call = [c for c in fake.calls if c[0] == "rename"][0]
    assert rename_call == ("rename", fake.last_text_id, "CEPA 货物贸易协议")

    rec = db.query(ImportMap).one()
    assert rec.status == "imported"
    assert rec.dataset_id == HK_DATASET_ID
    assert rec.collection_id == fake.last_text_id
    assert rec.content_sha256 == SHA1
    assert rec.version_id == ver.id


# --- 幂等 ---


def test_same_sha_skips_without_api_calls(db):
    src = make_source(db)
    doc, ver = make_document(db, src, TID_URL)
    write_imported(db, doc, ver)
    fake = FakeClient()

    report = run_import(db, fake, "hk_tid")

    assert report.skipped == 1
    assert report.imported == 0
    assert fake.calls == []


# --- 版本变化重建（先建新后删旧） ---


def test_version_change_rebuilds(db):
    src = make_source(db)
    doc, ver1 = make_document(db, src, TID_URL)
    write_imported(db, doc, ver1)
    ver2 = add_new_version(db, doc, sha=SHA2)
    fake = FakeClient(
        existing_folders={
            (HK_DATASET_ID, None): [{"_id": "D1", "name": "工业贸易署"}],
            (HK_DATASET_ID, "D1"): [{"_id": "D2", "name": "CEPA"}],
        }
    )

    report = run_import(db, fake, "hk_tid")

    assert report.rebuilt == 1
    assert report.imported == 0
    kinds = [c[0] for c in fake.calls]
    assert kinds == ["list", "list", "text", "rename", "delete"]
    text_call = [c for c in fake.calls if c[0] == "text"][0]
    assert text_call[4] == "D2"  # 复用已存在文件夹，未新建
    del_call = [c for c in fake.calls if c[0] == "delete"][0]
    assert del_call[1] == ("OLD1",)

    rec = db.query(ImportMap).one()
    assert rec.collection_id == fake.last_text_id
    assert rec.content_sha256 == SHA2
    assert rec.version_id == ver2.id
    assert rec.status == "imported"


# --- rebuild 强制重建（阶段①：分块参数重建通道） ---


def test_rebuild_forces_recreate_for_same_sha(db):
    src = make_source(db)
    doc, ver = make_document(db, src, TID_URL)
    write_imported(db, doc, ver)
    fake = FakeClient(
        existing_folders={
            (HK_DATASET_ID, None): [{"_id": "D1", "name": "工业贸易署"}],
            (HK_DATASET_ID, "D1"): [{"_id": "D2", "name": "CEPA"}],
        }
    )

    report = run_import(db, fake, "hk_tid", rebuild=True)

    assert report.rebuilt == 1
    assert report.skipped == 0
    assert report.imported == 0
    kinds = [c[0] for c in fake.calls]
    assert kinds == ["list", "list", "text", "rename", "delete"]
    del_call = [c for c in fake.calls if c[0] == "delete"][0]
    assert del_call[1] == ("OLD1",)

    rec = db.query(ImportMap).one()
    assert rec.collection_id == fake.last_text_id
    assert rec.status == "imported"


def test_rebuild_keeps_duplicate_records_skipped(db):
    src = make_source(db)
    make_document(db, src, TID_URL)
    make_document(db, src, TID_URL + "?dup=1", title="重复文章")
    fake = FakeClient()
    run_import(db, fake, "hk_tid")
    old_id = fake.last_text_id

    fake2 = FakeClient(
        existing_folders={
            (HK_DATASET_ID, None): [{"_id": "D1", "name": "工业贸易署"}],
            (HK_DATASET_ID, "D1"): [{"_id": "D2", "name": "CEPA"}],
        }
    )
    report = run_import(db, fake2, "hk_tid", rebuild=True)

    assert report.rebuilt == 1
    assert report.duplicates == 1
    assert report.imported == 0
    assert len([c for c in fake2.calls if c[0] == "text"]) == 1
    del_call = [c for c in fake2.calls if c[0] == "delete"][0]
    assert del_call[1] == (old_id,)


def test_rebuild_dry_run_counts_without_writes(db):
    src = make_source(db)
    doc, ver = make_document(db, src, TID_URL)
    write_imported(db, doc, ver)
    fake = FakeClient()

    report = run_import(db, fake, "hk_tid", rebuild=True, dry_run=True)

    assert report.rebuilt == 1
    assert report.skipped == 0
    assert fake.calls == []

    rec = db.query(ImportMap).one()
    assert rec.collection_id == "OLD1"


# --- dry-run 零副作用 ---


def test_dry_run_no_side_effects(db):
    src = make_source(db)
    make_document(db, src, TID_URL)
    fake = FakeClient()

    report = run_import(db, fake, "hk_tid", dry_run=True)

    assert report.imported == 1
    assert fake.calls == []
    assert db.query(ImportMap).count() == 0


# --- 同源重复去重（skipped_duplicate） ---


def test_same_source_duplicate_skipped(db):
    src = make_source(db)
    make_document(db, src, TID_URL)
    make_document(db, src, TID_URL + "?dup=1", title="重复文章")
    fake = FakeClient()

    report = run_import(db, fake, "hk_tid")
    assert report.imported == 1
    assert report.duplicates == 1
    assert len([c for c in fake.calls if c[0] == "text"]) == 1
    statuses = sorted(r.status for r in db.query(ImportMap).all())
    assert statuses == ["imported", "skipped_duplicate"]

    # 再跑一次：已导入的跳过、重复项保持不导
    fake2 = FakeClient()
    report2 = run_import(db, fake2, "hk_tid")
    assert report2.skipped == 1
    assert report2.duplicates == 1
    assert report2.imported == 0
    assert fake2.calls == []


def test_cross_source_same_sha_not_deduped(db):
    src1 = make_source(db, code="hk_tid")
    src2 = make_source(db, code="hk_edb", name="教育局")
    make_document(db, src1, TID_URL)
    make_document(db, src2, "https://www.edb.gov.hk/tc/abc.html", title="教育局文章")
    fake = FakeClient()

    report_edb = run_import(db, fake, "hk_edb")
    assert report_edb.imported == 1

    report_tid = run_import(db, fake, "hk_tid")
    assert report_tid.imported == 1  # 同 sha 但不同源 → 不去重
    assert db.query(ImportMap).count() == 2


# --- 失败与断点续传 ---


def test_failure_then_retry_resumes(db):
    src = make_source(db)
    make_document(db, src, TID_URL)
    fake = FakeClient()
    fake.fail_next_create_text = True

    report = run_import(db, fake, "hk_tid")
    assert report.failed == 1
    assert report.errors and "模拟网络抖动" in report.errors[0]
    rec = db.query(ImportMap).one()
    assert rec.status == "failed"
    assert rec.collection_id is None

    fake2 = FakeClient()
    report2 = run_import(db, fake2, "hk_tid")
    assert report2.imported == 1
    assert report2.failed == 0
    rec = db.query(ImportMap).one()
    assert rec.status == "imported"
    assert rec.collection_id is not None


def test_deferred_source_document_recorded_as_failed(db):
    src = make_source(db, code="sd_sdu", name="山东大学", organization="山东大学")
    make_document(db, src, "https://www.sdu.edu.cn/x.html")
    fake = FakeClient()

    report = run_import(db, fake, "sd_sdu")

    assert report.failed == 1
    assert "暂缓" in report.errors[0]
    assert fake.calls == []


def test_unknown_source_raises(db):
    with pytest.raises(ImporterError, match="不存在"):
        run_import(db, FakeClient(), "no_such_source")


# --- 候选筛选与限额 ---


def test_candidate_filter(db):
    src = make_source(db)
    make_document(db, src, TID_URL + "/1", title="拒绝稿", status="rejected")
    make_document(db, src, TID_URL + "/2", title="无正文", text=None)
    make_document(db, src, TID_URL + "/3", title="空白正文", text="   ")
    make_document(db, src, TID_URL + "/4", title="正常")
    fake = FakeClient()

    report = run_import(db, fake, "hk_tid")

    assert report.total == 1
    assert report.imported == 1
    assert [c[2] for c in fake.calls if c[0] == "text"] == ["正常"]


def test_limit_truncates(db):
    src = make_source(db)
    for i in range(3):
        make_document(
            db, src, f"{TID_URL}?i={i}", title=f"文章{i}", sha=f"{i:064d}"
        )
    fake = FakeClient()

    report = run_import(db, fake, "hk_tid", limit=2)

    assert report.total == 2
    assert report.imported == 2


# --- 导入时改名失败不再静默（由名称同步收尾） ---


def test_import_rename_failure_recorded(db):
    src = make_source(db)
    make_document(db, src, TID_URL)
    fake = FakeClient()
    fake.fail_next_rename = True

    report = run_import(db, fake, "hk_tid")

    assert report.imported == 1
    assert report.failed == 0
    assert any("改名" in e for e in report.errors)
    rec = db.query(ImportMap).one()
    assert rec.status == "imported"


# --- 名称同步（实测：解析阶段会用「标题.txt」回写集合名，需在管线排空后收尾校正） ---

TID_FOLDERS = {
    (HK_DATASET_ID, None): [{"_id": "D1", "name": "工业贸易署"}],
    (HK_DATASET_ID, "D1"): [{"_id": "D2", "name": "CEPA"}],
}


def seed_imported(db, cid="C1", title="CEPA 货物贸易协议", url=TID_URL):
    """造一条已导入记录（目标文件夹结构由调用方在 existing_folders 提供）。"""
    src = make_source(db)
    doc, ver = make_document(db, src, url, title=title)
    write_imported(db, doc, ver, collection_id=cid)
    return doc


def _folders_with_c1(name):
    return {
        **TID_FOLDERS,
        (HK_DATASET_ID, "D2"): [{"_id": "C1", "name": name}],
    }


def test_sync_names_fixes_txt_suffix(db):
    seed_imported(db)
    fake = FakeClient(existing_folders=_folders_with_c1("CEPA 货物贸易协议.txt"))

    report = sync_names(db, fake, "hk_tid")

    assert (report.checked, report.fixed, report.missing, report.unfixed) == (1, 1, 0, 0)
    assert ("rename", "C1", "CEPA 货物贸易协议") in fake.calls
    assert ("list", HK_DATASET_ID, None, True) in fake.calls
    assert ("list", HK_DATASET_ID, "D2", False) in fake.calls


def test_sync_names_noop_when_clean(db):
    seed_imported(db)
    fake = FakeClient(existing_folders=_folders_with_c1("CEPA 货物贸易协议"))

    report = sync_names(db, fake, "hk_tid")

    assert (report.checked, report.fixed, report.missing, report.unfixed) == (1, 0, 0, 0)
    assert not [c for c in fake.calls if c[0] == "rename"]


def test_sync_names_missing_collection_reported(db):
    seed_imported(db)
    fake = FakeClient(
        existing_folders={**TID_FOLDERS, (HK_DATASET_ID, "D2"): [{"_id": "OTHER", "name": "别的"}]}
    )

    report = sync_names(db, fake, "hk_tid")

    assert (report.checked, report.fixed, report.missing, report.unfixed) == (0, 0, 1, 0)
    assert "不在目标文件夹" in report.errors[0]
    assert not [c for c in fake.calls if c[0] == "rename"]


def test_sync_names_missing_folder_reported(db):
    seed_imported(db)
    fake = FakeClient()  # 无任何文件夹

    report = sync_names(db, fake, "hk_tid")

    assert (report.checked, report.fixed, report.missing, report.unfixed) == (0, 0, 1, 0)
    assert "文件夹" in report.errors[0]


def test_sync_names_other_mismatch_not_touched(db):
    seed_imported(db)
    fake = FakeClient(existing_folders=_folders_with_c1("被人工改过的名字"))

    report = sync_names(db, fake, "hk_tid")

    assert (report.checked, report.fixed, report.missing, report.unfixed) == (1, 0, 0, 1)
    assert "未自动修正" in report.errors[0]
    assert not [c for c in fake.calls if c[0] == "rename"]


def test_sync_names_dry_run_counts_without_writes(db):
    seed_imported(db)
    fake = FakeClient(existing_folders=_folders_with_c1("CEPA 货物贸易协议.txt"))

    report = sync_names(db, fake, "hk_tid", dry_run=True)

    assert (report.checked, report.fixed) == (1, 1)
    assert not [c for c in fake.calls if c[0] == "rename"]


def test_sync_names_rename_failure_reported(db):
    seed_imported(db)
    fake = FakeClient(existing_folders=_folders_with_c1("CEPA 货物贸易协议.txt"))
    fake.fail_next_rename = True

    report = sync_names(db, fake, "hk_tid")

    assert (report.fixed, report.unfixed) == (0, 1)
    assert "改名失败" in report.errors[0]
