# 鲁港通 - FastGPT 导入编排（design.md §7.3）：按源分批导入，幂等（import_map）、
# 同源同内容去重（skipped_duplicate）、版本变化重建（先建新后删旧）、
# dry-run 预演（零副作用）、失败断点续传（failed 记录下轮重试）。
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.fastgpt.client import FastGPTClient, FastGPTError
from app.fastgpt.formatting import build_import_text
from app.fastgpt.mapping import MappingError, resolve_route
from app.models import Document, DocumentVersion, ImportMap, Source

logger = logging.getLogger(__name__)

# 鲁港通 - 实测口径：库中文档无 approved 态（入库即 candidate），
# 导入候选 = 有当前版本、正文非空，且状态不在以下排除集
EXCLUDED_STATUSES = ("rejected", "fetch_failed", "archived", "superseded")
DEFAULT_CHUNK_SIZE = 512

# 鲁港通 - 防回流（kb-cleanup 2026-10-04 配套）：以下 5 个来源的导航/索引类页面
# （下载清单、栏目链接堆叠、名录代码表）曾被人工清理出知识库，但其文档仍是导入
# 候选，内容更新触发重建时会把垃圾页重新导回。故在导入层按文本结构拦截：
# 命中即跳过且不写 import_map（规则可调，放宽后下轮自动恢复导入）。
_JUNK_SCOPE_SOURCES = frozenset({"hk_tid", "hk_ird", "hk_immd", "hk_hkma", "hk_wfsfaa"})
JUNK_MIN_CHARS = 200
JUNK_MIN_LINES = 12
JUNK_SHORT_LINE_MAX = 30
JUNK_SHORT_LINE_RATIO = 0.70
JUNK_MAX_LONG_LINES = 2


def is_index_like_text(text: str) -> bool:
    """判断正文是否为枚举/索引页（整屏短行堆叠、几乎无整句长行）。

    阈值取自 2026-10-04 知识库清理 34 条人工判定样本实测：全部 ≥200 字、≥12 行、
    短行（≤30 字）占比 ≥73%、长行（≥40 字）≤5。长行取 ≤2 可保住含段落正文的
    页面（实测保留页长行 ≥3），代价是漏判约 1 成纯文本型垃圾页（可人工再清理）。
    """
    if len(text) < JUNK_MIN_CHARS:
        return False
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    if len(lines) < JUNK_MIN_LINES:
        return False
    short = sum(1 for ln in lines if len(ln) <= JUNK_SHORT_LINE_MAX)
    long_lines = sum(1 for ln in lines if len(ln) >= 40)
    return short >= JUNK_SHORT_LINE_RATIO * len(lines) and long_lines <= JUNK_MAX_LONG_LINES


class ImporterError(Exception):
    """导入编排错误（源不存在等），消息面向使用者。"""


@dataclass
class ImportReport:
    """一次导入批次的统计与失败明细。"""

    source_code: str
    total: int = 0
    imported: int = 0
    rebuilt: int = 0
    skipped: int = 0
    duplicates: int = 0
    filtered: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)

    def summary_line(self) -> str:
        """单行摘要（CLI 输出用）。"""
        return (
            f"总计 {self.total}｜新建 {self.imported}｜重建 {self.rebuilt}"
            f"｜跳过(未变) {self.skipped}｜重复未导 {self.duplicates}"
            f"｜拦截(索引页) {self.filtered}｜失败 {self.failed}"
        )


@dataclass
class NameSyncReport:
    """名称同步统计（design.md §7.3：解析阶段会把集合名回写为「标题.txt」，收尾校正）。"""

    source_code: str
    checked: int = 0
    fixed: int = 0
    missing: int = 0
    unfixed: int = 0
    errors: list[str] = field(default_factory=list)

    def summary_line(self) -> str:
        """单行摘要（CLI 输出用）；fixed 为已修正数（dry-run 时为待修正数）。"""
        return (
            f"名称同步：检查 {self.checked}｜修正 {self.fixed}"
            f"｜缺失 {self.missing}｜未自动修正 {self.unfixed}"
        )


class _FolderCache:
    """数据集内文件夹逐级复用：listV2 查 children，缺则创建并写回缓存。"""

    def __init__(self, client: FastGPTClient) -> None:
        self._client = client
        self._cache: dict[tuple[str, str | None], dict[str, str]] = {}

    def ensure(self, dataset_id: str, path: tuple[str, ...]) -> str | None:
        """确保路径逐级存在，返回末级文件夹 id；空路径返回 None（数据集根）。"""
        parent: str | None = None
        for name in path:
            key = (dataset_id, parent)
            if key not in self._cache:
                items = self._client.list_collections(dataset_id, parent)
                self._cache[key] = {i["name"]: i["_id"] for i in items}
            children = self._cache[key]
            if name not in children:
                children[name] = self._client.create_folder(dataset_id, name, parent)
            parent = children[name]
        return parent

    def find(self, dataset_id: str, path: tuple[str, ...]) -> str | None:
        """只读查找：路径逐级存在返回末级 id；任一缺失返回 None（不创建文件夹）。"""
        parent: str | None = None
        for name in path:
            key = (dataset_id, parent)
            if key not in self._cache:
                items = self._client.list_collections(dataset_id, parent)
                self._cache[key] = {i["name"]: i["_id"] for i in items}
            children = self._cache[key]
            if name not in children:
                return None
            parent = children[name]
        return parent


def _select_documents(
    db: Session, source_id, limit: int | None
) -> list[tuple[Document, DocumentVersion]]:
    """候选文档：当前版本、正文非空、状态未排除；按创建时间与 id 稳定排序。"""
    rows = db.execute(
        select(Document, DocumentVersion)
        .join(
            DocumentVersion,
            (DocumentVersion.document_id == Document.id)
            & (DocumentVersion.is_current.is_(True)),
        )
        .where(Document.source_id == source_id)
        .where(Document.status.notin_(EXCLUDED_STATUSES))
        .where(DocumentVersion.extracted_text.isnot(None))
        .order_by(Document.created_at.asc(), Document.id.asc())
    ).all()
    picked = [(doc, ver) for doc, ver in rows if (ver.extracted_text or "").strip()]
    if limit is not None:
        picked = picked[:limit]
    return picked


def _find_same_sha_document_id(
    db: Session, source_id, sha: str, exclude_doc_id
) -> str | None:
    """同源内已成功导入相同指纹的文档 id（同源去重依据）。"""
    return (
        db.execute(
            select(ImportMap.document_id)
            .join(Document, Document.id == ImportMap.document_id)
            .where(Document.source_id == source_id)
            .where(ImportMap.content_sha256 == sha)
            .where(ImportMap.status == "imported")
            .where(ImportMap.document_id != exclude_doc_id)
        )
        .scalars()
        .first()
    )


def _record_failure(
    db: Session,
    record: ImportMap | None,
    doc: Document,
    route,
    version: DocumentVersion,
    sha: str,
    message: str,
) -> None:
    """失败落库（保留已存在的 collection_id 供重试后清理），供断点续传。"""
    if record is None:
        db.add(
            ImportMap(
                document_id=doc.id,
                dataset_id=route.dataset_id,
                collection_id=None,
                version_id=version.id,
                content_sha256=sha,
                status="failed",
                error=message,
            )
        )
    else:
        record.dataset_id = route.dataset_id
        record.version_id = version.id
        record.content_sha256 = sha
        record.status = "failed"
        record.error = message
    db.commit()


def run_import(
    db: Session,
    client: FastGPTClient,
    source_code: str,
    *,
    dry_run: bool = False,
    limit: int | None = None,
    interval: float = 0.0,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    rebuild: bool = False,
) -> ImportReport:
    """导入单个源的候选文档到对应知识库；返回统计报告。

    幂等：已导入且指纹未变跳过；版本变化先建新集合后删旧；同源同指纹只导首篇；
    dry_run 仅预演统计、不调用写接口；失败记录 failed 供下轮重试。
    rebuild=True 时忽略「已导入且指纹未变」的跳过，强制重建已导入集合
    （用于分块参数调整后的存量重建；skipped_duplicate 去重记录不受影响）。
    """
    source = db.execute(
        select(Source).where(Source.code == source_code)
    ).scalar_one_or_none()
    if source is None:
        raise ImporterError(f"源不存在：{source_code}（请先确认源已配置并入库）")

    docs = _select_documents(db, source.id, limit)
    report = ImportReport(source_code=source_code, total=len(docs))
    folders = _FolderCache(client)
    planned_sha: set[str] = set()  # 本批次计划导入的指纹（dry-run 批内去重）

    for doc, version in docs:
        title = doc.title or doc.canonical_url
        sha = version.content_sha256
        record = db.execute(
            select(ImportMap).where(ImportMap.document_id == doc.id)
        ).scalar_one_or_none()

        # 幂等与重复：无副作用的快速路径
        if record is not None and record.status == "skipped_duplicate":
            report.duplicates += 1
            continue
        if (
            record is not None
            and record.status == "imported"
            and record.content_sha256 == sha
            and not rebuild
        ):
            report.skipped += 1
            continue

        # 鲁港通 - 防回流拦截（见 is_index_like_text）：命中即跳过且不落 import_map
        if source_code in _JUNK_SCOPE_SOURCES and is_index_like_text(
            version.extracted_text or ""
        ):
            report.filtered += 1
            logger.info("%s｜索引页拦截未导：%s", source_code, title)
            continue

        try:
            route = resolve_route(source_code, doc.canonical_url)
        except MappingError as exc:
            report.failed += 1
            report.errors.append(f"{title}：{exc}")
            continue

        # 已有成功导入记录的版本变化 → 重建；否则为新建/重试
        is_rebuild = record is not None and record.collection_id is not None

        if record is None:
            dup_id: str | None = _find_same_sha_document_id(
                db, source.id, sha, doc.id
            )
            if dup_id is None and sha in planned_sha:
                dup_id = "本批次先导文档"
            if dup_id is not None:
                if not dry_run:
                    db.add(
                        ImportMap(
                            document_id=doc.id,
                            dataset_id=route.dataset_id,
                            collection_id=None,
                            version_id=version.id,
                            content_sha256=sha,
                            status="skipped_duplicate",
                            error=f"同源重复：与 {dup_id} 内容相同，未导入",
                        )
                    )
                    db.commit()
                report.duplicates += 1
                continue

        if dry_run:
            report.rebuilt += 1 if is_rebuild else 0
            report.imported += 0 if is_rebuild else 1
            planned_sha.add(sha)
            continue

        text = build_import_text(
            title=doc.title or "",
            url=doc.canonical_url,
            organization=doc.organization or source.organization,
            published_at=doc.published_at,
            body=version.extracted_text or "",
        )
        try:
            parent_id = folders.ensure(route.dataset_id, route.folder_path)
            collection_id = client.create_text(
                route.dataset_id,
                title,
                text,
                parent_id=parent_id,
                tags=[route.region, route.department],
                chunk_size=chunk_size,
            )
        except FastGPTError as exc:
            _record_failure(db, record, doc, route, version, sha, str(exc))
            report.failed += 1
            report.errors.append(f"{title}：{exc}")
            if interval:
                time.sleep(interval)
            continue

        try:
            client.rename(collection_id, title)
        except FastGPTError as exc:
            # 鲁港通 - 实测：解析阶段完成后会用「标题.txt」回写集合名（覆盖此次改名），
            # 改名失败不阻断导入，统一由 sync_names 在管线排空后校正
            report.errors.append(f"{title}：集合改名未生效（{exc}），稍后由名称同步校正")

        if record is not None and record.collection_id:
            try:
                client.delete_collections([record.collection_id])
            except FastGPTError as exc:
                report.errors.append(
                    f"{title}：旧集合清理失败（{exc}），请在后台手动删除 {record.collection_id}"
                )

        if record is None:
            db.add(
                ImportMap(
                    document_id=doc.id,
                    dataset_id=route.dataset_id,
                    collection_id=collection_id,
                    version_id=version.id,
                    content_sha256=sha,
                    status="imported",
                )
            )
        else:
            record.dataset_id = route.dataset_id
            record.collection_id = collection_id
            record.version_id = version.id
            record.content_sha256 = sha
            record.status = "imported"
            record.error = None
        db.commit()

        if is_rebuild:
            report.rebuilt += 1
        else:
            report.imported += 1
        planned_sha.add(sha)

        if interval:
            time.sleep(interval)

    return report


def sync_names(
    db: Session,
    client: FastGPTClient,
    source_code: str,
    *,
    dry_run: bool = False,
    interval: float = 0.0,
) -> NameSyncReport:
    """名称同步：对照导入记录与 FastGPT 实际集合名，修正解析阶段回写的「标题.txt」后缀。

    仅处理该源 status=imported 且 collection_id 非空的记录；按目标文件夹聚合列表查询复用；
    dry_run 仅统计待修正数不调用改名；非「标题.txt」的异常命名只上报不自作主张修改。
    应在训练/解析管线排空后执行（否则解析回写可能再次覆盖）。
    """
    source = db.execute(
        select(Source).where(Source.code == source_code)
    ).scalar_one_or_none()
    if source is None:
        raise ImporterError(f"源不存在：{source_code}（请先确认源已配置并入库）")

    rows = db.execute(
        select(ImportMap, Document)
        .join(Document, Document.id == ImportMap.document_id)
        .where(Document.source_id == source.id)
        .where(ImportMap.status == "imported")
        .where(ImportMap.collection_id.isnot(None))
        .order_by(Document.created_at.asc(), Document.id.asc())
    ).all()

    report = NameSyncReport(source_code=source_code)
    folders = _FolderCache(client)
    listing: dict[str, dict[str, str]] = {}  # folder_id -> {collection_id: name}

    for record, doc in rows:
        title = doc.title or doc.canonical_url
        try:
            route = resolve_route(source_code, doc.canonical_url)
        except MappingError as exc:
            report.unfixed += 1
            report.errors.append(f"{title}：{exc}")
            continue

        folder_id = folders.find(route.dataset_id, route.folder_path)
        if folder_id is None:
            report.missing += 1
            report.errors.append(f"{title}：目标文件夹不存在（尚未创建或已被删除）")
            continue
        if folder_id not in listing:
            items = client.list_collections(
                route.dataset_id, folder_id, folders_only=False
            )
            listing[folder_id] = {i["_id"]: i["name"] for i in items}

        current = listing[folder_id].get(record.collection_id)
        if current is None:
            report.missing += 1
            report.errors.append(
                f"{title}：集合 {record.collection_id} 不在目标文件夹中（可能被删除或移动）"
            )
            continue
        report.checked += 1
        if current == title:
            continue
        if current != f"{title}.txt":
            report.unfixed += 1
            report.errors.append(f"{title}：当前名称「{current}」与预期不一致，未自动修正")
            continue

        if not dry_run:
            try:
                client.rename(record.collection_id, title)
            except FastGPTError as exc:
                report.unfixed += 1
                report.errors.append(f"{title}：改名失败（{exc}）")
                continue
            if interval:
                time.sleep(interval)
        report.fixed += 1
        listing[folder_id][record.collection_id] = title

    return report
