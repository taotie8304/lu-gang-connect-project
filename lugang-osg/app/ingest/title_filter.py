# 鲁港通 - 标题关键词自动归档（2026-10-15 用户批准）：济南六区级来源实测「任免/会议/
# 名录/建制批复」类新文档约占新采两成，采到即入库会随每日自动导入混进知识库。
# 命中即置 archived（不进知识库，改回 candidate 即可恢复）；仅对显式配置
# title_exclude_patterns 的来源生效（防误伤发改委等高质量源）。
from __future__ import annotations

import re


def first_matching_pattern(title: str | None, patterns) -> str | None:
    """返回标题命中的首个排除模式文本；未命中或无配置返回 None。非法正则跳过不阻断采集。"""
    if not title or not patterns:
        return None
    for pattern in patterns:
        try:
            if re.search(pattern, title):
                return pattern
        except re.error:
            continue
    return None
