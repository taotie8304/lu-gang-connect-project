# 鲁港通 - 采集编排（spec 第 8/9/10 节）：发现 → 白名单校验 → 去重 →
# 安全抓取 → 内容提取 → 版本化入库 → crawl_run/crawl_task 全程记录。
# 抓取全部走 Phase 1 安全通道（fetch_url：逐跳重定向校验 + 内容限制）。
from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.ingest.discover import (
    DiscoveredItem,
    is_listing_page,
    is_sitemap,
    parse_api_json,
    parse_fixed,
    parse_js_menu,
    parse_listing,
    parse_rss,
    parse_sitemap,
)
from app.ingest.extract import MIN_CONTENT_CHARS, extract_html, extract_pdf
from app.models import CrawlRun, CrawlTask, Document, DocumentVersion, Source, SourceDomainRule
from app.security.fetcher import (
    FetchAborted,
    FetchBlocked,
    FetchResult,
    fetch_url,
)
from app.security.url_validator import URLRejected, validate_target_url

logger = logging.getLogger("lugang.osg.pipeline")

# 鲁港通 - 网络层异常重试（退避秒数）；FetchBlocked 绝不重试（spec 6.4 退避 ≥24h 由调度层负责）
_RETRY_BACKOFF_S = (5, 15)
_SITEMAP_MAX_DEPTH = 2   # sitemapindex 嵌套上限

# 鲁港通 - 发现入口页（首页/栏目页/sitemap/RSS）只用于提取链接，本身不是文档；
# fixed_url 方式的入口就是目标文档（如施政报告固定页），绝不排除。
_ENTRY_KEYS = ("listing_urls", "sitemap_urls", "feed_urls")


@dataclass
class SyncStats:
    """一次来源同步的结果统计（回填 crawl_run 并返回给管理接口）。"""

    discovered: int = 0
    rejected: int = 0
    already_known: int = 0
    fetched_ok: int = 0
    fetch_failed: int = 0
    new_docs: int = 0
    updated_docs: int = 0
    unchanged_docs: int = 0
    # 鲁港通 - 栏目/列表页形态过滤与单轮上限截断的候选数（仅计数，不逐条建 crawl_task）
    skipped_non_article: int = 0
    skipped_limit: int = 0
    errors: list[str] = field(default_factory=list)


def sync_source(
    db: Session,
    source: Source,
    *,
    settings: Settings | None = None,
    fetcher=fetch_url,
    sleeper=time.sleep,
    resolver=None,
    force_refetch: bool = False,
) -> SyncStats:
    """同步一个来源。fetcher/sleeper/resolver 供测试注入。

    force_refetch=True 时已知文档也重新抓取（用于人工触发的全量核对）。
    """
    settings = settings or get_settings()
    stats = SyncStats()
    run = CrawlRun(source_id=source.id, status="running")
    db.add(run)
    db.commit()

    try:
        rules = _rules_for_source(db, source)
        candidates = _discover(db, source, rules, settings, fetcher, sleeper, stats)
        stats.discovered = len(candidates)

        _process_candidates(db, source, run, candidates, rules, settings,
                            fetcher, sleeper, stats, force_refetch, resolver)
        run.status = "finished"
    except Exception as exc:  # noqa: BLE001 - 顶层兜底：run 标记失败，不让异常逃逸到调度器
        db.rollback()
        run.status = "failed"
        stats.errors.append(f"pipeline error: {exc}")
        logger.exception("sync_source failed: %s", source.code)
    finally:
        run.discovered_urls = stats.discovered
        run.fetch_ok = stats.fetched_ok
        run.fetch_failed = stats.fetch_failed
        run.new_docs = stats.new_docs
        run.updated_docs = stats.updated_docs
        run.unchanged_docs = stats.unchanged_docs
        run.finished_at = datetime.now(timezone.utc)
        run.error_summary = "; ".join(stats.errors[:10]) or None
        db.commit()
    return stats


# ---------------------------------------------------------------------------
# 发现阶段
# ---------------------------------------------------------------------------

def _rules_for_source(db: Session, source: Source):
    """加载本来源的域名规则（含强制 http/IPv4 约定）。"""
    from app.security.url_validator import DomainRule

    rows = db.execute(
        select(SourceDomainRule).where(SourceDomainRule.source_id == source.id)
    ).scalars().all()
    return tuple(
        DomainRule(
            hostname=r.hostname,
            allow_subdomains=r.allow_subdomains,
            path_prefix=r.path_prefix,
            allow_http=r.allow_http,
            allowed_ports=frozenset(r.allowed_ports or []),
        )
        for r in rows
    )


def _discover(db, source, rules, settings, fetcher, sleeper, stats) -> list[DiscoveredItem]:
    """按 discovery_method 拉发现端点并解析。异常只记录不中断。"""
    cfg = source.discovery_config or {}
    method = source.discovery_method
    items: list[DiscoveredItem] = []

    if method == "rss":
        for url in cfg.get("feed_urls", []):
            items.extend(_fetch_and_parse(db, url, rules, settings, fetcher, sleeper, stats,
                                          lambda c, b: parse_rss(c)))
    elif method == "sitemap":
        for url in cfg.get("sitemap_urls", []):
            items.extend(
                _fetch_sitemap_recursive(db, url, rules, settings, fetcher, sleeper, stats, depth=0)
            )
    elif method == "listing":
        for url in cfg.get("listing_urls", []):
            items.extend(_fetch_and_parse(db, url, rules, settings, fetcher, sleeper, stats,
                                          lambda c, b: parse_listing(c, b)))
    elif method == "js_menu":
        # 鲁港通 - TID：栏目页是 JS 空壳（main_card_section 由 JS 填充），全站栏目树
        # 在静态 .js 菜单文件里；解析出白名单栏目下的文章页 URL（排除通告/统计栏目）。
        menu_cfg = cfg.get("js_menu_config") or {}
        for url in menu_cfg.get("menu_urls", []):
            items.extend(_fetch_and_parse(db, url, rules, settings, fetcher, sleeper, stats,
                                          lambda c, b: parse_js_menu(c, menu_cfg)))
    elif method == "fixed_url":
        items.extend(parse_fixed(cfg.get("fixed_urls", [])))
    elif method == "api":
        # 鲁港通 - data.gov.hk：Phase 2 用每日更新 RSS 做发现（增量化）；
        # 全量 35,599 数据集枚举（list-files API）在 RAG 阶段按主题筛选实现
        api_cfg = cfg.get("api_config") or {}
        for url in api_cfg.get("update_rss", []):
            items.extend(_fetch_and_parse(db, url, rules, settings, fetcher, sleeper, stats,
                                          lambda c, b: parse_rss(c)))
    elif method == "api_json":
        # 鲁港通 - 政务 JSON 接口两种形态：① 列表项内嵌全文（海右 rc portalList）→ 单段式
        #    直接入库；② 列表只给元数据（济南文件库 do-search，POST + {pageNo} 分页）→
        #    parse_api_json 不配 body_fields 时 body_html=None，_process_candidates 两段式抓详情页。
        api_cfg = cfg.get("api_config") or {}
        parse_cfg = api_cfg.get("parse") or {}
        http_method = (api_cfg.get("method") or "GET").upper()
        paginate = api_cfg.get("paginate") or {}
        for endpoint in api_cfg.get("endpoints", []):
            items.extend(_discover_api_json(db, endpoint, parse_cfg, http_method, paginate,
                                            rules, settings, fetcher, sleeper, stats))
    else:
        stats.errors.append(f"未知 discovery_method: {method}")
    return items


def _discover_api_json(db, endpoint, parse_cfg, http_method, paginate,
                       rules, settings, fetcher, sleeper, stats) -> list[DiscoveredItem]:
    """api_json 发现：无 paginate → 单端点一次拉取（海右 rc）；有 paginate → 按
    {page_param} 模板逐页拉取，某页解析出 0 条（末页之后）或达 max_pages 即停。

    鲁港通 - 济南市政府文件库 do-search：level=0 筛出市政府+市直部门共 4819 条，
    pageSize=100 约 49 页；逐页 POST 累积候选，空页停止翻页（下轮调度再从首页起）。
    """
    def parser(c, b):
        return parse_api_json(c, parse_cfg)

    if not paginate:
        return _fetch_and_parse(db, endpoint, rules, settings, fetcher, sleeper, stats,
                                parser, method=http_method)

    page_param = paginate.get("page_param") or "pageNo"
    placeholder = "{%s}" % page_param
    start = int(paginate.get("start", 1))
    max_pages = int(paginate.get("max_pages", 50))
    out: list[DiscoveredItem] = []
    page = start
    while page < start + max_pages:
        url = endpoint.replace(placeholder, str(page)) if placeholder in endpoint else endpoint
        page_items = _fetch_and_parse(db, url, rules, settings, fetcher, sleeper, stats,
                                      parser, method=http_method)
        if not page_items:
            break   # 空页/末页/请求失败 → 停止翻页
        out.extend(page_items)
        if placeholder not in endpoint:
            break   # 模板无占位符 → 单页即止，防死循环
        page += 1
    return out


def _fetch_and_parse(db, url, rules, settings, fetcher, sleeper, stats, parser_fn,
                     method="GET") -> list[DiscoveredItem]:
    """拉一个发现端点并解析（带重试）。method 供 api_json 列表接口指定 POST。"""
    result = _fetch_with_retry(url, rules, settings, fetcher, sleeper, stats, method=method)
    if result is None:
        return []
    try:
        return parser_fn(result.content, result.final_url)
    except Exception as exc:  # noqa: BLE001
        stats.errors.append(f"parse failed {url}: {exc}")
        return []


def _fetch_sitemap_recursive(db, url, rules, settings, fetcher, sleeper, stats, depth) -> list[DiscoveredItem]:
    """sitemap 可能是 sitemapindex：子 sitemap 继续拉取（限深防循环）。"""
    result = _fetch_with_retry(url, rules, settings, fetcher, sleeper, stats)
    if result is None:
        return []
    items = parse_sitemap(result.content, result.final_url)
    if depth >= _SITEMAP_MAX_DEPTH:
        return items
    # 鲁港通 - 判定 sitemapindex：返回的 loc 又指向 .xml 站点地图
    out: list[DiscoveredItem] = []
    for item in items:
        if _looks_like_sitemap(item.url):
            out.extend(
                _fetch_sitemap_recursive(db, item.url, rules, settings, fetcher, sleeper, stats, depth + 1)
            )
        else:
            out.append(item)
    return out


def _looks_like_sitemap(url: str) -> bool:
    path = url.split("?", 1)[0].lower()
    return "sitemap" in path and path.endswith((".xml", ".xml.gz"))


def _entry_urls(source: Source) -> set[str]:
    """收集发现入口 URL（去尾斜杠归一），用于排除入口页自身被当文档入库。"""
    cfg = source.discovery_config or {}
    urls: set[str] = set()
    for key in _ENTRY_KEYS:
        for u in cfg.get(key) or []:
            if isinstance(u, str) and u.strip():
                urls.add(u.strip().rstrip("/"))
    for u in (cfg.get("api_config") or {}).get("update_rss") or []:
        if isinstance(u, str) and u.strip():
            urls.add(u.strip().rstrip("/"))
    return urls


def _fetch_with_retry(url, rules, settings, fetcher, sleeper, stats, method="GET") -> FetchResult | None:
    """网络异常重试（指数退避）；FetchBlocked/FetchAborted 不重试直接放弃。
    method 透传给 fetcher（济南 do-search 列表接口须 POST，GET 返 500）。"""
    for attempt in range(len(_RETRY_BACKOFF_S) + 1):
        try:
            return fetcher(url, rules, settings, method=method)
        except FetchBlocked:
            stats.errors.append(f"blocked: {url}")
            return None
        except FetchAborted as exc:
            stats.errors.append(f"aborted: {url} ({exc.reason.value})")
            return None
        except Exception as exc:  # noqa: BLE001 - 网络超时/连接失败：退避重试
            if attempt < len(_RETRY_BACKOFF_S):
                stats.errors.append(f"retry {attempt + 1} {url}: {exc}")
                sleeper(_RETRY_BACKOFF_S[attempt])
            else:
                stats.errors.append(f"fetch failed {url}: {exc}")
    return None


# ---------------------------------------------------------------------------
# 处理阶段：校验 → 去重 → 抓取 → 入库
# ---------------------------------------------------------------------------

def _process_candidates(db, source, run, candidates, rules, settings,
                        fetcher, sleeper, stats, force_refetch, resolver):
    known = {d.canonical_url: d for d in db.execute(
        select(Document).where(Document.source_id == source.id)
    ).scalars()}
    entry_urls = _entry_urls(source)
    # 鲁港通 - fixed_url 入口即目标文档；api_json 的 canonical_url 是详情 API 端点
    # （/prod-api/...getInfo?id=），网页形态规则对它无意义，两者均豁免栏目页形态过滤。
    shape_filter = source.discovery_method not in ("fixed_url", "api_json")

    for idx, item in enumerate(candidates):
        # 0) 单轮抓取页数上限（spec 12.2）：达标即结束本轮，不再为剩余候选逐条建
        #    crawl_task。实测 hk_investhk 的 sitemap 有 4787 条 URL，采满 100 篇上限后
        #    仍逐条建了 4600+ 行 skipped_limit 并逐行 commit，白耗十几分钟且全程占着
        #    全局同步锁，期间任何其他来源都无法同步。
        if stats.fetched_ok + stats.fetch_failed >= source.max_pages_per_run:
            remaining = len(candidates) - idx
            stats.skipped_limit += remaining
            logger.info("%s: 已达单轮上限 %s 篇，剩余 %s 条候选留待下轮",
                        source.code, source.max_pages_per_run, remaining)
            break

        task = CrawlTask(run_id=run.id, url=item.url, status="pending")
        db.add(task)

        # 1) 白名单 + SSRF 校验（拒绝的记 crawl_task 即可，不抓取）
        try:
            validated = validate_target_url(item.url, rules, resolver=resolver)
        except URLRejected as exc:
            task.status = "rejected"
            task.reject_reason = exc.reason.value
            stats.rejected += 1
            db.commit()
            continue

        canonical = validated.url

        # 1.5) 发现入口页自身不作为文档（实测首页/栏目页正文仅 28~59 字导航噪声）
        if canonical.rstrip("/") in entry_urls:
            task.status = "skipped_entry"
            db.commit()
            continue

        # 1.6) 栏目/列表/分页页形态过滤，必须在抓取前挡掉。实测取证：山东政务云
        #      栏目页的正文容器里是链接标题堆叠，282~1930 字越过 MIN_CONTENT_CHARS
        #      入库（sd_czt 首轮 9 篇混进 5 篇）；同时白耗配额——教育厅首页链出
        #      35 个栏目页只夹 4 篇真文章，50 篇配额九成被噪声吃掉。
        if shape_filter and is_listing_page(canonical):
            task.status = "skipped_non_article"
            stats.skipped_non_article += 1
            db.commit()
            continue

        # 2) 已知文档：默认跳过；force_refetch 或 RSS 有更新信号时重抓
        doc = known.get(canonical)
        if doc is not None and not force_refetch:
            task.status = "skipped_known"
            stats.already_known += 1
            db.commit()
            continue

        # 4) 取得文档内容：api_json 列表项已内嵌全文（body_html）→ 直接构造抓取结果，
        #    跳过详情页请求（海右人社详情是 SPA 静态抓不到，且全文已在列表接口）；
        #    其余发现方式走安全通道 fetch_with_retry（含逐跳白名单校验与重试）。
        if item.body_html is not None:
            result = FetchResult(
                final_url=canonical, http_status=200,
                content_type="text/html", content=item.body_html.encode("utf-8"),
            )
        else:
            result = _fetch_with_retry(canonical, rules, settings, fetcher, sleeper, stats)
            if result is None:
                task.status = "failed"
                stats.fetch_failed += 1
                db.commit()
                continue

        # 5) 提取 + 版本化入库
        action = _store_document(db, source, canonical, result, item)
        task.status = action
        task.http_status = result.http_status
        task.bytes_downloaded = len(result.content)
        task.redirect_chain = list(result.redirect_chain)
        if action == "new":
            stats.new_docs += 1
            stats.fetched_ok += 1
        elif action == "updated":
            stats.updated_docs += 1
            stats.fetched_ok += 1
        elif action == "unchanged":
            stats.unchanged_docs += 1
            stats.fetched_ok += 1
        elif action == "skipped_low_content":
            # 鲁港通 - 抽取成功但正文不足（栏目页/导航页）：计入已处理页数，
            # 保证 max_pages_per_run 上限不被噪声页绕过
            stats.fetched_ok += 1
        db.commit()

        # 6) 抓取节奏：同一来源两次请求之间 ≥ source_min_interval_s（spec 12.2）。
        #    鲁港通 - api_json 内嵌全文（body_html）不发详情页请求，逐条 sleep 纯属浪费：
        #    实测 jinan_rc 311 条 × 10s ≈ 52 分钟且全程占着全局同步锁阻塞其他来源，
        #    故仅在真正发起了网络请求（body_html 为空）时才限速。
        if item.body_html is None:
            sleeper(settings.source_min_interval_s)


def _store_document(db, source, canonical, result: FetchResult, item) -> str:
    """sha256 版本化入库。返回 new / updated / unchanged / skipped_low_content。"""
    content_sha = hashlib.sha256(result.content).hexdigest()

    doc = db.execute(
        select(Document).where(Document.canonical_url == canonical)
    ).scalar_one_or_none()

    if doc is not None:
        existing = db.execute(
            select(DocumentVersion).where(
                DocumentVersion.document_id == doc.id,
                DocumentVersion.content_sha256 == content_sha,
            )
        ).scalar_one_or_none()
        if existing is not None:
            return "unchanged"

    is_pdf = result.content_type == "application/pdf"
    cfg = source.discovery_config or {}
    extracted = (
        extract_pdf(result.content)
        if is_pdf
        else extract_html(
            result.content,
            content_selector=cfg.get("content_selector"),
            organization=source.organization,
            title_strip_prefixes=cfg.get("title_strip_prefixes"),
        )
    )

    # 鲁港通 - 噪声页过滤：HTML 正文低于实测门槛则不建文档（栏目页/首页只有导航文字）。
    # PDF 不做此判定（Phase 2 只登记元信息，正文提取留 RAG 阶段）。
    if not is_pdf and len(extracted.text or "") < MIN_CONTENT_CHARS:
        return "skipped_low_content"

    if doc is None:
        doc = Document(
            source_id=source.id,
            canonical_url=canonical,
            title=item.title or extracted.title,
            language=extracted.language_hint,
            organization=source.organization,
            status="candidate",
        )
        db.add(doc)
        db.flush()
        action = "new"
    else:
        action = "updated"
        db.query(DocumentVersion).filter(
            DocumentVersion.document_id == doc.id
        ).update({"is_current": False})

    version = DocumentVersion(
        document_id=doc.id,
        fetched_url=canonical,
        final_url=result.final_url,
        content_type=result.content_type,
        http_status=result.http_status,
        content_sha256=content_sha,
        extracted_text=extracted.text,
        extracted_metadata={"title": extracted.title, "language": extracted.language_hint},
        is_current=True,
    )
    db.add(version)
    db.flush()
    doc.latest_version_id = version.id
    if extracted.title and not doc.title:
        doc.title = extracted.title
    return action
