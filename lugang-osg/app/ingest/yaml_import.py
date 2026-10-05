# 鲁港通 - sources.yaml 导入器（spec Phase 2）：把 Phase 0 实测清单转成
# source + source_domain_rule 记录。幂等：按 code 覆盖更新，不重复插入。
from __future__ import annotations

from dataclasses import dataclass, field

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Source, SourceDomainRule
from app.rules import rule_loader


@dataclass
class ImportResult:
    """导入结果统计（返回给管理接口）。"""

    imported: list[str] = field(default_factory=list)   # 新增的 source code
    updated: list[str] = field(default_factory=list)    # 更新的 source code
    skipped_disabled: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


# 鲁港通 - sources.yaml 字段 → Source.discovery_config 的映射（发现端点统一进 JSONB）
# content_selector：实测确认的正文容器（如山东政务站 #zoom），用于剔除面包屑等 UI 噪声
# title_strip_prefixes：显式标题前缀（如 TID 繁体「工業貿易署 - 」），extract 清洗时优先剥离
_DISCOVERY_KEYS = (
    "feed_urls",
    "sitemap_urls",
    "listing_urls",
    "fixed_urls",
    "api_config",
    "js_menu_config",
    "content_selector",
    "title_strip_prefixes",
)


def import_sources_yaml(yaml_text: str, db: Session) -> ImportResult:
    """解析 sources.yaml 文本并落库。YAML 语法/结构错误统一抛 ValueError。"""
    try:
        data = yaml.safe_load(yaml_text)
    except yaml.YAMLError as exc:
        raise ValueError(f"YAML 解析失败: {exc}") from exc
    entries = data.get("sources") if isinstance(data, dict) else None
    if not isinstance(entries, list):
        raise ValueError("sources.yaml 结构错误：缺少 sources 列表")

    result = ImportResult()
    for entry in entries:
        code = entry.get("id")
        if not code:
            result.errors.append(f"缺少 id 的条目被跳过: {entry.get('name', '?')}")
            continue
        try:
            _upsert_source(entry, db, result)
        except Exception as exc:  # noqa: BLE001 - 单条失败不影响其余导入
            db.rollback()
            result.errors.append(f"{code}: {exc}")

    rule_loader.invalidate()
    return result


def _upsert_source(entry: dict, db: Session, result: ImportResult) -> None:
    code = entry["id"]
    enabled = bool(entry.get("enabled", True))

    discovery_config = {
        k: entry[k] for k in _DISCOVERY_KEYS if entry.get(k) is not None
    }

    src = db.execute(select(Source).where(Source.code == code)).scalar_one_or_none()
    if src is None:
        src = Source(code=code)
        db.add(src)
        result.imported.append(code)
    else:
        result.updated.append(code)

    src.name = entry.get("name", code)
    src.source_group = entry.get("group", "uncategorized")
    src.organization = entry.get("organization")
    src.trust_level = int(entry.get("trust_level", 1))
    src.enabled = enabled
    src.discovery_method = entry.get("discovery_method", "listing")
    src.schedule_cron = entry.get("schedule")
    src.rate_limit_per_minute = int(entry.get("rate_limit_per_minute", 5))
    src.max_pages_per_run = int(entry.get("max_pages_per_run", 100))
    src.max_depth = int(entry.get("max_depth", 1))
    # 鲁港通 - Phase 0 实测：山东政务云仅 HTTP 80 放行 → allow_http 白名单机制
    src.allow_http = bool(entry.get("allow_http", False))
    src.force_ipv4 = bool(entry.get("force_ipv4", False))
    src.discovery_config = discovery_config

    if not enabled:
        result.skipped_disabled.append(code)

    # 鲁港通 - 域名规则重建（幂等：删旧插新，path_prefix 按声明顺序取第一条命中）
    db.flush()
    db.query(SourceDomainRule).filter(SourceDomainRule.source_id == src.id).delete()
    domains = entry.get("base_domains") or []
    prefixes = entry.get("allowed_path_prefixes") or ["/"]
    for domain in domains:
        # 每个域名 × 每个路径前缀各生成一条规则；allow_http/ports 来源级统一
        for prefix in prefixes:
            db.add(
                SourceDomainRule(
                    source_id=src.id,
                    hostname=domain.strip().lower(),
                    allow_subdomains=False,   # 鲁港通 - 默认精确匹配，子域需管理员显式开启
                    path_prefix=prefix,
                    allow_http=src.allow_http,
                    allowed_ports=[],
                    enabled=enabled,
                )
            )
    db.commit()
