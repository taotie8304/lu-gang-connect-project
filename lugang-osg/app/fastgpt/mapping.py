# 鲁港通 - FastGPT 导入分类映射（design.md §7.2）：
# 香港源 → 香港政府各部门知识库（部门文件夹；TID 按 URL 分 6 个栏目子文件夹）；
# 山东源 → 山东省各地市综合政策知识库（「省级部门」与「济南市」下再分机构）；
# 教育源 → 香港教育中心知识库（学段/院校文件夹；教育局按 URL 分学段，2026-11-18）；
# 高校源暂缓（用户 2026-09-13 决策）；未知源报错。
from dataclasses import dataclass
from typing import Literal

HK_DATASET_ID = "6aa65d90429fb6770923e91f"  # 鲁港通 - 香港政府各部门知识库
SD_DATASET_ID = "6aa65dd8429fb6770923ea6a"  # 鲁港通 - 山东省各地市综合政策知识库
EDU_DATASET_ID = "69674f94fa58c162073713be"  # 鲁港通 - 香港教育中心知识库（原「香港教育相关」）
BANK_DATASET_ID = "6afed05e1f0af75b59e136ec"  # 鲁港通 - 香港银行证券开户中心
MED_DATASET_ID = "6aff10cf1f0af75b59e28b9a"  # 鲁港通 - 香港公立医院就医指引中心


class MappingError(Exception):
    """源未配置导入路由，或该源已声明暂缓导入。"""


@dataclass(frozen=True)
class KbRoute:
    """一个文档的导入目标：知识库 + 数据集内文件夹路径。"""

    kb_key: Literal["hk", "sd", "edu", "bank", "med"]
    dataset_id: str
    region: str  # 标签用：香港 / 山东
    department: str  # 标签用：部门（末级机构）
    folder_path: tuple[str, ...]  # 数据集内文件夹路径（不含数据集根）
    column: str | None = None  # 职能栏目（目前仅 hk_tid 有）
    # 鲁港通 - 导入头带核对日期（时效敏感的办事类页面，2026-11-20）
    verified: bool = False


# 鲁港通 - 香港源 → 部门文件夹（取自源配置 organization 的简称）
_HK_DEPARTMENTS: dict[str, str] = {
    "hk_cr_policy": "公司注册处",
    "hk_customs_pc": "香港海关",
    "hk_data_gov": "数字政策办公室",
    "hk_dh_policy": "卫生署",
    "hk_edb": "教育局",
    "hk_gia_press": "政府新闻处",
    "hk_ha_policy": "医院管理局",
    "hk_hd_policy": "房屋署",
    "hk_gov_portal": "政府一站通",
    "hk_hkma": "金融管理局",
    "hk_immd": "入境事务处",
    "hk_investhk": "投资推广署",
    "hk_ird": "税务局",
    "hk_gov_tax_cn": "税务局",
    "hk_ipd_policy": "知识产权署",
    "hk_itib": "创新科技及工业局",
    "hk_itf": "创新科技署",
    "hk_hkstp": "香港科技园公司",
    "hk_ld_policy": "劳工处",
    "hk_news_gov": "政府新闻处",
    "hk_police_so": "警务处",
    "hk_policy_address": "施政报告",
    "hk_smefund": "工业贸易署",
    "hk_swd_policy": "社会福利署",
    "hk_td": "运输署",
    "hk_tid": "工业贸易署",
    "hk_wfsfaa": "在职家庭及学生资助事务处",
    "hk_mpfa": "积金局",
}

# 鲁港通 - 办事类来源：导入头附「核对日期」（额度/资格/流程时效敏感，2026-11-20）
_VERIFIED_SOURCES = {"hk_td", "hk_mpfa", "hk_hd_policy", "hk_customs_pc", "hk_gov_tax_cn"}

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
    "jinan_huaiyin": "济南市槐荫区人民政府",
    "jinan_fgw": "济南市发展和改革委员会",
    "jinan_jnxxq": "济南新旧动能转换起步区管委会",
    "jinan_shizhong": "济南市市中区人民政府",
    "jinan_zhangqiu": "济南市章丘区人民政府",
    "jinan_changqing": "济南市长清区人民政府",
    "jinan_tianqiao": "济南市天桥区人民政府",
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


# 鲁港通 - 香港教育中心来源 → (标签部门, 文件夹路径)
# 入口与路径均取自 2026-11-18 服务器实测（.qoder/specs/hk-edu-center/probe1–5）
_HK_EDU_SOURCES: dict[str, tuple[str, tuple[str, ...]]] = {
    "hk_edu_hkeaa": ("考评局", ("40 文凭试与大学联招", "文凭试")),
    "hk_edu_jupas": ("大学联招", ("40 文凭试与大学联招", "大学联招")),
    "hk_edu_ugc": ("教资会", ("50 专上教育", "资助大学总览")),
    "hk_edu_vtc": ("职业训练局", ("50 专上教育", "职业训练局")),
    "hk_edu_hku": ("香港大学", ("60 院校档案", "香港大学")),
    "hk_edu_hku_admissions": ("香港大学", ("60 院校档案", "香港大学")),
    "hk_edu_cuhk": ("香港中文大学", ("60 院校档案", "香港中文大学")),
    "hk_edu_hkust": ("香港科技大学", ("60 院校档案", "香港科技大学")),
    "hk_edu_hkust_join": ("香港科技大学", ("60 院校档案", "香港科技大学")),
    "hk_edu_polyu": ("香港理工大学", ("60 院校档案", "香港理工大学")),
    "hk_edu_polyu_admissions": ("香港理工大学", ("60 院校档案", "香港理工大学")),
    "hk_edu_hkbu": ("香港浸会大学", ("60 院校档案", "香港浸会大学")),
    "hk_edu_lingnan": ("岭南大学", ("60 院校档案", "岭南大学")),
    "hk_edu_thei": ("香港高等教育科技学院", ("60 院校档案", "香港高等教育科技学院")),
    "hk_edu_eduhk": ("香港教育大学", ("60 院校档案", "香港教育大学")),
}

_EDU_OVERVIEW = "00 教育体系总览"


# 鲁港通 - 香港银行证券开户中心来源 → (标签部门, 文件夹路径)
# 传统银行 9 家 / 虚拟银行 8 家（个人+企业业务同源采集）/ 证券行 10 家（2026-11-19）
_HK_BANK_SOURCES: dict[str, tuple[str, tuple[str, ...]]] = {
    # 传统银行
    "hk_bank_hsbc": ("汇丰银行", ("10 传统银行", "汇丰银行")),
    "hk_bank_hsbc_biz": ("汇丰银行", ("10 传统银行", "汇丰银行")),
    "hk_bank_bochk": ("中国银行（香港）", ("10 传统银行", "中国银行（香港）")),
    "hk_bank_bochk_docs": ("中国银行（香港）", ("10 传统银行", "中国银行（香港）")),
    "hk_bank_sc": ("渣打银行", ("10 传统银行", "渣打银行")),
    "hk_bank_hangseng": ("恒生银行", ("10 传统银行", "恒生银行")),
    "hk_bank_bea": ("东亚银行", ("10 传统银行", "东亚银行")),
    "hk_bank_icbcasia": ("工银亚洲", ("10 传统银行", "工银亚洲")),
    "hk_bank_cmbwl": ("招商永隆银行", ("10 传统银行", "招商永隆银行")),
    "hk_bank_ocbc": ("华侨银行（香港）", ("10 传统银行", "华侨银行（香港）")),
    "hk_bank_dbs": ("星展银行", ("10 传统银行", "星展银行")),
    # 虚拟银行
    "hk_vbank_fusion": ("富融银行", ("20 虚拟银行", "富融银行")),
    "hk_vbank_za": ("众安银行", ("20 虚拟银行", "众安银行")),
    "hk_vbank_livi": ("理慧银行", ("20 虚拟银行", "理慧银行")),
    "hk_vbank_mox": ("Mox Bank", ("20 虚拟银行", "Mox Bank")),
    "hk_vbank_welab": ("汇立银行", ("20 虚拟银行", "汇立银行")),
    "hk_vbank_ant": ("蚂蚁银行", ("20 虚拟银行", "蚂蚁银行")),
    "hk_vbank_elebank": ("大象银行", ("20 虚拟银行", "大象银行")),
    "hk_vbank_paob": ("平安壹账通银行", ("20 虚拟银行", "平安壹账通银行")),
    # 证券行
    "hk_sec_futu": ("富途证券", ("30 证券行", "富途证券")),
    "hk_sec_webull": ("微牛证券", ("30 证券行", "微牛证券")),
    "hk_sec_usmart": ("盈立证券", ("30 证券行", "盈立证券")),
    "hk_sec_cms": ("招商证券国际", ("30 证券行", "招商证券国际")),
    "hk_sec_tiger": ("老虎证券", ("30 证券行", "老虎证券")),
    "hk_sec_longbridge": ("长桥证券", ("30 证券行", "长桥证券")),
    "hk_sec_valuable": ("华盛证券", ("30 证券行", "华盛证券")),
    "hk_sec_brightsmart": ("耀才证券", ("30 证券行", "耀才证券")),
    "hk_sec_chief": ("致富证券", ("30 证券行", "致富证券")),
    "hk_sec_gtja": ("国泰君安国际", ("30 证券行", "国泰君安国际")),
}

# 鲁港通 - 内地居民赴港开户专题源（同一机构的 _cn 开户指引页）→ 40 专题文件夹
_HK_BANK_MAINLAND: dict[str, tuple[str, str]] = {
    "hk_bank_hsbc_cn": ("汇丰银行", "银行开户"),
    "hk_bank_bochk_cn": ("中国银行（香港）", "银行开户"),
    "hk_bank_icbcasia_cn": ("工银亚洲", "银行开户"),
    "hk_vbank_za_cn": ("众安银行", "银行开户"),
    "hk_sec_futu_cn": ("富途证券", "证券开户"),
}


# 鲁港通 - 香港公立医院就医指引中心来源 → (标签部门, 文件夹路径)
# 医管局服务指引 + HA Go（2026-11-19 批次）
_HK_MED_SOURCES: dict[str, tuple[str, tuple[str, ...]]] = {
    "hk_med_ha_overview": ("医院管理局", ("00 就医总览与流程",)),
    "hk_med_ha_ae": ("医院管理局", ("10 急症室",)),
    "hk_med_ha_gopc": ("医院管理局", ("20 家庭医学门诊（普通科门诊）",)),
    "hk_med_ha_sopc": ("医院管理局", ("30 专科门诊",)),
    "hk_med_ha_cm": ("医院管理局", ("40 中医服务",)),
    "hk_med_ha_fees": ("医院管理局", ("50 收费与减免",)),
    "hk_med_hago": ("医院管理局", ("60 HA Go 与预约",)),
    "hk_med_ha_clusters": ("医院管理局", ("70 医院联网与医院",)),
    "hk_med_ha_other": ("医院管理局", ("90 住院与其他服务",)),
}


def edu_edb_folder(url: str) -> tuple[str, ...]:
    """教育局文档按 URL 学段路由（路径白名单见 spec design §3.3）。"""
    u = url.lower()
    if "/spa-systems/primary-1-admission" in u:
        return ("20 小学", "小一入学统筹办法")
    if "/spa-systems/secondary-" in u:
        return ("30 中学", "中一派位")
    if "/applicable-to-secondary/" in u:
        return ("30 中学", "课程与教学语言")
    if "/applicable-to-primary-secondary/direct-subsidy-scheme/" in u:
        return ("80 办学类型与学校资料", "办学类型")
    if "/edu-system/primary-secondary/primary.html" in u:
        return ("20 小学",)
    if "/edu-system/primary-secondary/secondary.html" in u:
        return ("30 中学",)
    if "/preprimary-kindergarten/kindergarten-k1-admission-arrangements/" in u:
        return ("10 学前教育", "幼稚园入学")
    if "/preprimary-kindergarten/" in u:
        return ("10 学前教育", "幼稚园教育计划")
    if "/edu-system/postsecondary/" in u:
        return ("50 专上教育", "专上政策与资助")
    if "/student-parents/sch-info/" in u:
        return ("80 办学类型与学校资料", "学校概览与校网")
    if "/student-parents/support-subsidies/" in u:
        return ("90 学生资助与奖学",)
    if (
        "/student-parents/placement-assistance/" in u
        or "/student-parents/newly-arrived-children/" in u
    ):
        return ("70 非本地学生来港", "新来港儿童入学")
    return (_EDU_OVERVIEW,)


def resolve_route(source_code: str, canonical_url: str) -> KbRoute:
    """返回文档导入路由；未知源/暂缓源抛 MappingError（消息面向使用者，中文可操作）。"""
    if source_code in _ACADEMIC_DEFERRED:
        raise MappingError(
            f"高校源暂缓导入：{source_code}（用户 2026-09-13 决策，待内容扩充再定）"
        )
    if source_code == "hk_edu_edb":
        folder = edu_edb_folder(canonical_url)
        return KbRoute("edu", EDU_DATASET_ID, "香港", "教育局", folder, folder[-1])
    if source_code in _HK_EDU_SOURCES:
        dept, folder = _HK_EDU_SOURCES[source_code]
        return KbRoute("edu", EDU_DATASET_ID, "香港", dept, folder)
    if source_code in _HK_DEPARTMENTS:
        dept = _HK_DEPARTMENTS[source_code]
        if source_code == "hk_tid":
            column = tid_column_folder(canonical_url)
            return KbRoute(
                "hk", HK_DATASET_ID, "香港", dept, (dept, column), column
            )
        return KbRoute(
            "hk", HK_DATASET_ID, "香港", dept, (dept,),
            verified=source_code in _VERIFIED_SOURCES,
        )
    if source_code in _HK_BANK_MAINLAND:
        dept, sub = _HK_BANK_MAINLAND[source_code]
        return KbRoute("bank", BANK_DATASET_ID, "香港", dept, ("40 内地居民赴港开户", sub))
    if source_code in _HK_BANK_SOURCES:
        dept, folder = _HK_BANK_SOURCES[source_code]
        return KbRoute("bank", BANK_DATASET_ID, "香港", dept, folder)
    if source_code in _HK_MED_SOURCES:
        dept, folder = _HK_MED_SOURCES[source_code]
        return KbRoute("med", MED_DATASET_ID, "香港", dept, folder)
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
        or source_code in _HK_EDU_SOURCES
        or source_code == "hk_edu_edb"
        or source_code in _HK_BANK_SOURCES
        or source_code in _HK_BANK_MAINLAND
        or source_code in _HK_MED_SOURCES
        or source_code in _SD_PROVINCIAL
        or source_code in _SD_JINAN
    )
