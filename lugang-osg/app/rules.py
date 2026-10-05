# 鲁港通 - 白名单规则加载器：从 source_domain_rule 表加载启用规则，
# 转为 url_validator.DomainRule；带进程内 TTL 缓存（管理后台改规则后 ≤60s 生效）。
from __future__ import annotations

import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SourceDomainRule
from app.security.url_validator import DomainRule


class RuleLoader:
    """白名单规则缓存加载器。"""

    def __init__(self, ttl_s: int = 60) -> None:
        self._ttl_s = ttl_s
        self._cached_at = 0.0
        self._rules: tuple[DomainRule, ...] = ()

    def invalidate(self) -> None:
        """手动失效缓存（管理后台改规则后调用）。"""
        self._cached_at = 0.0

    def load(self, db: Session, *, force: bool = False) -> tuple[DomainRule, ...]:
        if not force and self._rules and (time.monotonic() - self._cached_at) < self._ttl_s:
            return self._rules
        rows = db.execute(
            select(SourceDomainRule).where(SourceDomainRule.enabled.is_(True))
        ).scalars().all()
        self._rules = tuple(
            DomainRule(
                hostname=row.hostname,
                allow_subdomains=row.allow_subdomains,
                path_prefix=row.path_prefix,
                allow_http=row.allow_http,
                allowed_ports=frozenset(row.allowed_ports or []),
            )
            for row in rows
        )
        self._cached_at = time.monotonic()
        return self._rules


rule_loader = RuleLoader()
