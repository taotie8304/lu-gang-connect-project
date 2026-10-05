#!/usr/bin/env python3
# 鲁港通 - FastGPT 导入器 CLI（tasks.md 阶段四 A7）。
# 容器内用法：
#   docker compose exec lugang-osg python -m app.fastgpt.cli --source hk_tid --dry-run
#   docker compose exec lugang-osg python -m app.fastgpt.cli --source hk_tid
#   docker compose exec lugang-osg python -m app.fastgpt.cli --source hk_tid --rebuild
#   docker compose exec lugang-osg python -m app.fastgpt.cli --source hk_tid --sync-names
# 退出码：0 全部成功 / 1 有失败项（见输出清单）/ 2 配置或参数错误 / 3 接口异常。
from __future__ import annotations

import argparse
import sys

from app.config import get_settings
from app.database import SessionLocal
from app.fastgpt.client import FastGPTClient, FastGPTError
from app.fastgpt.importer import ImporterError, run_import, sync_names


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="FastGPT 知识库导入（按源分批；幂等可重跑）"
    )
    parser.add_argument("--source", required=True, help="来源 code（如 hk_tid / sd_kjt）")
    parser.add_argument("--dry-run", action="store_true", help="仅预演统计，不写知识库")
    parser.add_argument("--limit", type=int, default=None, help="最多处理 N 篇（试导用）")
    parser.add_argument(
        "--interval", type=float, default=None, help="每篇间隔秒数（默认取配置）"
    )
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="强制重建已导入集合（分块参数调整后的存量重建，忽略指纹未变的跳过）",
    )
    parser.add_argument(
        "--sync-names",
        action="store_true",
        help="仅做名称同步：按导入记录修正集合名（.txt 残留），不执行导入",
    )
    args = parser.parse_args(argv)

    settings = get_settings()
    if not settings.fastgpt_api_key:
        print("缺少 OSG_FASTGPT_API_KEY（请在服务器 .env 配置后重试）")
        return 2

    client = FastGPTClient(settings.fastgpt_base_url, settings.fastgpt_api_key)
    db = SessionLocal()
    try:
        if args.sync_names:
            result = sync_names(
                db,
                client,
                args.source,
                dry_run=args.dry_run,
                interval=(
                    args.interval
                    if args.interval is not None
                    else settings.fastgpt_interval_s
                ),
            )
        else:
            result = run_import(
                db,
                client,
                args.source,
                dry_run=args.dry_run,
                limit=args.limit,
                interval=(
                    args.interval
                    if args.interval is not None
                    else settings.fastgpt_interval_s
                ),
                chunk_size=settings.fastgpt_chunk_size,
                rebuild=args.rebuild,
            )
    except ImporterError as exc:
        print(f"导入中止：{exc}")
        return 2
    except FastGPTError as exc:
        print(f"导入中止（FastGPT 接口异常）：{exc}")
        return 3
    finally:
        client.close()
        db.close()

    mode = "（dry-run 预演，未写入）" if args.dry_run else ""
    print(f"[{result.source_code}] {result.summary_line()}{mode}")
    for err in result.errors:
        print(f"  - {err}")
    if args.sync_names:
        return 1 if (result.missing or result.unfixed) else 0
    return 1 if result.failed else 0


if __name__ == "__main__":
    sys.exit(main())
