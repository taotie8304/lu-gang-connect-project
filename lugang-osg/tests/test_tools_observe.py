# 鲁港通 - 观察工具指标口径单测（2026-11-04 采集韧性加固观察期）。
# 重点守住三件事：零发现轮与零新增轮分开算、被拒标记从 error_summary 正确计数、
# 前 10 条截断时不谎报精确值。
from __future__ import annotations

from datetime import datetime, timezone

from tools.observe_sources import report_rows, summarize


def _run(day: int, hour: int, *, discovered: int, new: int, errors: str = "") -> dict:
    return {
        "started_at": datetime(2026, 11, day, hour, tzinfo=timezone.utc),
        "discovered_urls": discovered,
        "new_docs": new,
        "error_summary": errors,
    }


class TestSummarize:
    def test_splits_zero_discovery_from_zero_new(self):
        """发现>0 但新增=0 只计零新增，不计零发现——两者语义不同不能混。"""
        days = summarize([
            _run(4, 1, discovered=137, new=0),
            _run(4, 9, discovered=0, new=0),
        ])
        d = days["2026-11-04"]
        assert d["runs"] == 2
        assert d["zero_discovery"] == 1
        assert d["zero_new"] == 2
        assert d["discovered"] == 137

    def test_counts_blocked_retries_and_cutoff(self):
        """被拒 / 退避重试 / 熔断收尾各自独立计数，供横向比较。"""
        errors = "; ".join([
            "blocked: https://a/1",
            "blocked: https://a/2",
            "transient retry 1 https://a/3: 503",
            "连续被拒 3 次，本轮提前收尾（剩余 12 条留待下轮）",
        ])
        d = summarize([_run(4, 1, discovered=50, new=0, errors=errors)])["2026-11-04"]
        assert d["blocked"] == 2
        assert d["retries"] == 1
        assert d["cutoffs"] == 1
        assert d["blocked_truncated"] is False

    def test_flags_truncation_instead_of_exact_count(self):
        """error_summary 只留前 10 条：达到上限时标记截断，不把 10 当真实值。"""
        errors = "; ".join(f"blocked: https://a/{i}" for i in range(10))
        d = summarize([_run(4, 1, discovered=50, new=0, errors=errors)])["2026-11-04"]
        assert d["blocked"] == 10
        assert d["blocked_truncated"] is True

    def test_groups_by_utc_day(self):
        """按 UTC 日切分——服务器 cron 即按 UTC 触发，观察窗口须同口径。"""
        days = summarize([
            _run(3, 23, discovered=10, new=1),
            _run(4, 0, discovered=20, new=2),
        ])
        assert sorted(days) == ["2026-11-03", "2026-11-04"]
        assert days["2026-11-03"]["discovered"] == 10


class TestReportRows:
    def test_row_shows_truncated_marker(self):
        errors = "; ".join(f"blocked: https://a/{i}" for i in range(10))
        rows = report_rows("jinan_gov", summarize([_run(4, 1, discovered=9, new=0, errors=errors)]))
        assert len(rows) == 1
        assert "被拒 10（≥，已截断）" in rows[0]
        assert rows[0].startswith("jinan_gov")
