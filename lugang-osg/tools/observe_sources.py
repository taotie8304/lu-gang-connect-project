#!/usr/bin/env python3
# 鲁港通 - 来源观察工具（只读）：按天统计指定来源的「发现条数 / 零发现率 / 被拒次数」，
# 供采集韧性加固的上线观察期（2026-11-04 起 3 天）判定「保留 or 退役」。
#
# 用法（服务器容器内，需带 PYTHONPATH 才能 import app）：
#   docker exec -e PYTHONPATH=/app lugang-osg python tools/observe_sources.py \
#     jinan_gov,jinan_hrss,jinan_zwfw --days 3
#
# 口径说明（重要，别把截断当真实值）：
#   · 发现条数 = 该轮列表/接口返回的候选 URL 数（crawl_run.discovered_urls）。
#   · 抓取 成功/失败 = crawl_run.fetch_ok / fetch_failed，即真正发起过内容请求的条数。
#   · 零发现轮 = 发现条数为 0 的轮次；零新增轮 = 新文档为 0 的轮次。
#   · 零抓取轮 = 「发现>0 但成功+失败=0」的轮次：候选一条都没被尝试抓取，属于候选
#     选择/判重短路问题，既不是站点拒绝也不是「没发文」，判退役时须与前者区分开。
#   · 被拒次数按 error_summary 里的标记统计，而 error_summary 只保留前 10 条，
#     因此单轮标记数达到 10 时按「≥10（已截断）」呈现，只用于横向比较不作精确计数。
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timedelta, timezone

_BLOCKED_TAG = "blocked: "
_TRANSIENT_RETRY_TAG = "transient retry "
_CUTOFF_TAG = "本轮提前收尾"
_ERROR_CAP = 10


def summarize(runs: list[dict]) -> dict[str, dict]:
    """按日期（UTC）聚合轮次指标。runs 的每项含 started_at / discovered_urls /
    fetch_ok / fetch_failed / new_docs / error_summary，本函数不碰数据库，便于单测。"""
    days: dict[str, dict] = defaultdict(
        lambda: {
            "runs": 0,
            "discovered": 0,
            "fetch_ok": 0,
            "fetch_failed": 0,
            "no_attempt": 0,
            "new_docs": 0,
            "zero_discovery": 0,
            "zero_new": 0,
            "blocked": 0,
            "blocked_truncated": False,
            "retries": 0,
            "cutoffs": 0,
        }
    )
    for run in runs:
        day = run["started_at"].astimezone(timezone.utc).strftime("%Y-%m-%d")
        d = days[day]
        summary = run.get("error_summary") or ""
        tags = summary.count(_BLOCKED_TAG)
        fetched = (run.get("fetch_ok") or 0) + (run.get("fetch_failed") or 0)
        d["runs"] += 1
        d["discovered"] += run.get("discovered_urls") or 0
        d["fetch_ok"] += run.get("fetch_ok") or 0
        d["fetch_failed"] += run.get("fetch_failed") or 0
        d["new_docs"] += run.get("new_docs") or 0
        if not run.get("discovered_urls"):
            d["zero_discovery"] += 1
        elif not fetched:
            # 有候选却一次抓取都没发生：选择/短路问题，不是站点拒绝
            d["no_attempt"] += 1
        if not run.get("new_docs"):
            d["zero_new"] += 1
        d["blocked"] += tags
        if tags + summary.count(_TRANSIENT_RETRY_TAG) >= _ERROR_CAP:
            # 标记数已挤满 10 条上限，说明真实值可能被截断
            d["blocked_truncated"] = True
        d["retries"] += summary.count(_TRANSIENT_RETRY_TAG)
        d["cutoffs"] += summary.count(_CUTOFF_TAG)
    return dict(days)


def report_rows(code: str, days: dict[str, dict]) -> list[str]:
    lines = []
    for day in sorted(days):
        d = days[day]
        blocked = f"{d['blocked']}" + ("（≥，已截断）" if d["blocked_truncated"] else "")
        lines.append(
            f"{code:<12} {day}  轮次 {d['runs']:>2}  发现 {d['discovered']:>5}"
            f"  抓取 {d['fetch_ok']}/{d['fetch_failed']}  零抓取轮 {d['no_attempt']:>2}"
            f"  新增 {d['new_docs']:>3}  零发现轮 {d['zero_discovery']:>2}"
            f"  零新增轮 {d['zero_new']:>2}  被拒 {blocked:>4}"
            f"  退避重试 {d['retries']:>3}  熔断收尾 {d['cutoffs']:>2}"
        )
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description="按天统计来源采集观察指标")
    parser.add_argument("codes", help="逗号分隔的来源 code，如 jinan_gov,jinan_hrss")
    parser.add_argument("--days", type=int, default=3, help="观察窗口（天，默认 3）")
    args = parser.parse_args()

    from app.database import SessionLocal
    from app.models import CrawlRun, Source
    from sqlalchemy import select

    since = datetime.now(timezone.utc) - timedelta(days=args.days)
    session = SessionLocal()
    try:
        for code in [c.strip() for c in args.codes.split(",") if c.strip()]:
            src = session.execute(
                select(Source).where(Source.code == code)
            ).scalar_one_or_none()
            if src is None:
                print(f"{code:<12} 未找到该来源")
                continue
            runs = session.execute(
                select(CrawlRun)
                .where(CrawlRun.source_id == src.id, CrawlRun.started_at >= since)
                .order_by(CrawlRun.started_at)
            ).scalars().all()
            if not runs:
                print(f"{code:<12} 观察窗口内无轮次（cron 未到点或被禁用）")
                continue
            rows = report_rows(
                code,
                summarize(
                    [
                        {
                            "started_at": r.started_at,
                            "discovered_urls": r.discovered_urls,
                            "fetch_ok": r.fetch_ok,
                            "fetch_failed": r.fetch_failed,
                            "new_docs": r.new_docs,
                            "error_summary": r.error_summary,
                        }
                        for r in runs
                    ]
                ),
            )
            print("\n".join(rows))
            print(f"{code:<12} cron={src.schedule_cron} 拟真停顿基数="
                  f"{(src.discovery_config or {}).get('discovery_min_interval_s')}s")
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
