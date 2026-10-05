# 鲁港通 - FastGPT 导入分类映射（design.md §7.2）：
# 香港源 → 香港政府各部门知识库（部门文件夹；TID 按 URL 分 6 个栏目子文件夹）；
# 山东源 → 山东省各地市综合政策知识库（「省级部门」与「济南市」下再分机构）；
# 高校源暂缓（用户 2026-09-13 决策）；未知源报错。
from dataclasses import dataclass
from typing import Literal

HK_DATASET_ID = "6aa65d90429fb6770923e91f"  # 鲁港通 - 香港政府各部门知识库
SD_DATASET_ID = "6aa65dd8429fb6770923ea6a"  # 鲁港通 - 山东省各地市综合政策知识库


class MappingError(Exception):
    """源未配置导入路由，或该源已声明暂缓导入。"""


@dataclass(frozen=True)
class KbRoute:
    """一个文档的导入目标：知识库 + 数据集内文件夹路径。"""

    kb_key: Literal["hk", "sd"]
    dataset_id: str
    region: str  # 标签用：香港 / 山东
    department: str  # 标签用：部门（末级机构）
    folder_path: tuple[str, ...]  # 数据集内文件夹路径（不含数据集根）
    column: str | None = None  # 职能栏目（目前仅 hk_tid 有）


# 鲁港通 - 香港源 → 部门文件夹（取自源配置 organization 的简称）
_HK_DEPARTMENTS: dict[str, str] = {
    "hk_data_gov": "数字政策办公室",
    "hk_edb": "教育局",
    "hk_gia_press": "政府新闻处",
    "hk_gov_portal": "政府一站通",
    "hk_hkma": "金融管理局",
    "hk_immd": "入境事务处",
    "hk_investhk": "投资推广署",
    "hk_ird": "税务局",
    "hk_itib": "创新科技及工业局",
    "hk_news_gov": "政府新闻处",
    "hk_policy_address": "施政报告",
    "hk_tid": "工业贸易署",
    "hk_wfsfaa": "在职家庭及学生资助事务处",
}

# 鲁港通 - 山东省级部门源 → 机构文件夹（挂「省级部门」下）
_SD_PROVINCIAL: dict[str, str] = {
    "sd_prov_gov": "山东省人民政府",
    "sd_commerce": "山东省商务厅",
    "sd_czt": "山东省财政厅",
    "sd_kjt": "山东省科学技术厅",
    "sd_gxt": "山东省工业和信息化厅",
    "sd_edu": "山东省教育厅",
    "sd_tjj": "山东省统计局",
}

# 鲁港通 - 济南源 → 机构文件夹（挂「济南市」下）
_SD_JINAN: dict[str, str] = {
    "jinan_gov": "济南市人民政府",
    "jinan_hrss": "济南市人力资源和社会保障局",
    "jinan_rc": "海右人社政策通",
    "jinan_zwfw": "济南市政务服务网",
}

# 鲁港通 - 高校源（academic 6 校）暂缓导入（用户 2026-09-13 决策）
_ACADEMIC_DEFERRED = (
    "sd_sdu",
    "sd_ujn",
    "sd_ouc",
    "sd_sdnu",
    "sd_sdufe",
    "sd_qdu",
)

# 鲁港通 - 工业贸易署栏目（URL /tc/our_work/<seg>/ → 职能子文件夹，T3 专项批 6 栏目白名单）
TID_COLUMN_FOLDERS: dict[str, str] = {
    "import_export_licensing_control": "进出口管制及签证",
    "support_for_trade_industry": "中小企支援",
    "cepa": "CEPA",
    "trade_and_investment_agreements": "自贸协定及投资协定",
    "trade_relations": "贸易关系",
    "hk_participation_in_ito": "香港参与国际组织",
}
_TID_FALLBACK = "综合政策"


def tid_column_folder(url: str) -> str:
    """从 TID 文档 URL 提取栏目子文件夹名；未命中返回「综合政策」。"""
    marker = "/tc/our_work/"
    if marker in url:
        tail = url.split(marker, 1)[1]
        seg = tail.split("/", 1)[0]
        return TID_COLUMN_FOLDERS.get(seg, _TID_FALLBACK)
    return _TID_FALLBACK


def resolve_route(source_code: str, canonical_url: str) -> KbRoute:
    """返回文档导入路由；未知源/暂缓源抛 MappingError（消息面向使用者，中文可操作）。"""
    if source_code in _ACADEMIC_DEFERRED:
        raise MappingError(
            f"高校源暂缓导入：{source_code}（用户 2026-09-13 决策，待内容扩充再定）"
        )
    if source_code in _HK_DEPARTMENTS:
        dept = _HK_DEPARTMENTS[source_code]
        if source_code == "hk_tid":
            column = tid_column_folder(canonical_url)
            return KbRoute(
                "hk", HK_DATASET_ID, "香港", dept, (dept, column), column
            )
        return KbRoute("hk", HK_DATASET_ID, "香港", dept, (dept,))
    if source_code in _SD_PROVINCIAL:
        dept = _SD_PROVINCIAL[source_code]
        return KbRoute("sd", SD_DATASET_ID, "山东", dept, ("省级部门", dept))
    if source_code in _SD_JINAN:
        dept = _SD_JINAN[source_code]
        return KbRoute("sd", SD_DATASET_ID, "山东", dept, ("济南市", dept))
    raise MappingError(f"源未配置导入路由：{source_code}（请在 mapping.py 补充映射）")


def is_routable(source_code: str) -> bool:
    """该源是否配置了导入路由（高校源为暂缓导入、未知源无路由，均返回 False）。"""
    return (
        source_code in _HK_DEPARTMENTS
        or source_code in _SD_PROVINCIAL
        or source_code in _SD_JINAN
    )
