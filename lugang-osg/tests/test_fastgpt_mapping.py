# 鲁港通 - FastGPT 导入器分类映射测试（TDD：先写测试后实现）
# 映射规则：香港源 → 香港库（部门/职能子文件夹）；山东源 → 山东库（省级部门·城市/机构）；
# 高校源暂缓；未知源报错。
import pytest

from app.fastgpt.mapping import (
    HK_DATASET_ID,
    SD_DATASET_ID,
    MappingError,
    is_routable,
    resolve_route,
)


def test_hk_tid_routes_to_column_subfolder():
    route = resolve_route(
        "hk_tid", "https://www.tid.gov.hk/tc/our_work/cepa/agreement.html"
    )
    assert route.kb_key == "hk"
    assert route.dataset_id == HK_DATASET_ID
    assert route.region == "香港"
    assert route.department == "工业贸易署"
    assert route.folder_path == ("工业贸易署", "CEPA")
    assert route.column == "CEPA"


def test_hk_tid_all_six_columns():
    cases = {
        "import_export_licensing_control": "进出口管制及签证",
        "support_for_trade_industry": "中小企支援",
        "cepa": "CEPA",
        "trade_and_investment_agreements": "自贸协定及投资协定",
        "trade_relations": "贸易关系",
        "hk_participation_in_ito": "香港参与国际组织",
    }
    for seg, folder in cases.items():
        url = f"https://www.tid.gov.hk/tc/our_work/{seg}/x.html"
        route = resolve_route("hk_tid", url)
        assert route.folder_path == ("工业贸易署", folder), seg
        assert route.column == folder


def test_hk_tid_unknown_column_falls_back_to_general():
    url = "https://www.tid.gov.hk/tc/our_work/something_else/x.html"
    route = resolve_route("hk_tid", url)
    assert route.folder_path == ("工业贸易署", "综合政策")
    assert route.column == "综合政策"


def test_hk_plain_department_source():
    route = resolve_route("hk_edb", "https://www.edb.gov.hk/tc/about/x.html")
    assert route.kb_key == "hk"
    assert route.dataset_id == HK_DATASET_ID
    assert route.folder_path == ("教育局",)
    assert route.column is None


def test_hk_two_sources_share_news_department_folder():
    a = resolve_route("hk_gia_press", "https://www.info.gov.hk/gia/general/x.htm")
    b = resolve_route("hk_news_gov", "https://www.news.gov.hk/chi/x.html")
    assert a.folder_path == ("政府新闻处",)
    assert b.folder_path == ("政府新闻处",)


def test_hk_p1a_new_sources_have_routes():
    """P1-A 新源：ITF/科技园/中小企基金必须能路由到对应部门，否则导入报 MappingError。"""
    assert resolve_route("hk_itf", "https://www.itf.gov.hk/tc/x").folder_path == ("创新科技署",)
    assert resolve_route("hk_hkstp", "https://www.hkstp.org/zh-hk/x").folder_path == ("香港科技园公司",)
    assert resolve_route("hk_smefund", "https://smefund.tid.gov.hk/sc_chi/x").folder_path == ("工业贸易署",)


def test_hk_p1b_new_sources_have_routes():
    """P1-B 新源：房屋署/公司注册处/知识产权署/卫生署/社署/医管局/劳工处必须能路由。"""
    cases = {
        "hk_hd_policy": "房屋署",
        "hk_cr_policy": "公司注册处",
        "hk_ipd_policy": "知识产权署",
        "hk_dh_policy": "卫生署",
        "hk_swd_policy": "社会福利署",
        "hk_ha_policy": "医院管理局",
        "hk_ld_policy": "劳工处",
    }
    for code, dept in cases.items():
        route = resolve_route(code, "https://example.com/x.html")
        assert route.kb_key == "hk"
        assert route.dataset_id == HK_DATASET_ID
        assert route.folder_path == (dept,), code
        assert route.column is None, code


def test_sd_provincial_source():
    route = resolve_route(
        "sd_kjt",
        "http://kjt.shandong.gov.cn/art/2024/1/2/art_103585_10311901.html",
    )
    assert route.kb_key == "sd"
    assert route.dataset_id == SD_DATASET_ID
    assert route.region == "山东"
    assert route.department == "山东省科学技术厅"
    assert route.folder_path == ("省级部门", "山东省科学技术厅")


def test_sd_jinan_source():
    route = resolve_route(
        "jinan_gov", "http://www.jinan.gov.cn/art/2024/1/1/art_1.html"
    )
    assert route.folder_path == ("济南市", "济南市人民政府")


def test_academic_source_deferred():
    with pytest.raises(MappingError, match="暂缓"):
        resolve_route("sd_sdu", "https://www.sdu.edu.cn/x.html")


def test_unknown_source_raises():
    with pytest.raises(MappingError, match="未配置"):
        resolve_route("hk_unknown_xyz", "https://example.com/x")


def test_all_importable_sources_covered():
    # 23 香港（含 P1-A、P1-B 新源）+ 7 山东省级 + 4 济南，共 34 个可导入源均有路由
    codes = [
        "hk_data_gov",
        "hk_edb",
        "hk_gia_press",
        "hk_gov_portal",
        "hk_hkma",
        "hk_immd",
        "hk_investhk",
        "hk_ird",
        "hk_itf",
        "hk_itib",
        "hk_hkstp",
        "hk_news_gov",
        "hk_policy_address",
        "hk_smefund",
        "hk_tid",
        "hk_wfsfaa",
        "hk_hd_policy",
        "hk_cr_policy",
        "hk_ipd_policy",
        "hk_dh_policy",
        "hk_swd_policy",
        "hk_ha_policy",
        "hk_ld_policy",
        "sd_prov_gov",
        "sd_commerce",
        "sd_czt",
        "sd_kjt",
        "sd_gxt",
        "sd_edu",
        "sd_tjj",
        "jinan_gov",
        "jinan_hrss",
        "jinan_rc",
        "jinan_zwfw",
    ]
    for code in codes:
        route = resolve_route(code, "https://example.com/x")
        assert route.folder_path, code
        assert route.dataset_id in (HK_DATASET_ID, SD_DATASET_ID), code


def test_is_routable_known_sources_true():
    assert is_routable("hk_edb") is True
    assert is_routable("sd_gxt") is True
    assert is_routable("jinan_gov") is True


def test_is_routable_academic_and_unknown_false():
    assert is_routable("sd_sdu") is False
    assert is_routable("sd_ouc") is False
    assert is_routable("no_such_source") is False


# 鲁港通 - 香港教育中心（2026-11-18）：教育库路由
from app.fastgpt.mapping import EDU_DATASET_ID  # noqa: E402


def test_edu_university_sources_route_to_college_folders():
    cases = {
        "hk_edu_hkeaa": ("40 文凭试与大学联招", "文凭试"),
        "hk_edu_jupas": ("40 文凭试与大学联招", "大学联招"),
        "hk_edu_ugc": ("50 专上教育", "资助大学总览"),
        "hk_edu_vtc": ("50 专上教育", "职业训练局"),
        "hk_edu_hku": ("60 院校档案", "香港大学"),
        "hk_edu_hku_admissions": ("60 院校档案", "香港大学"),
        "hk_edu_cuhk": ("60 院校档案", "香港中文大学"),
        "hk_edu_hkust": ("60 院校档案", "香港科技大学"),
        "hk_edu_hkust_join": ("60 院校档案", "香港科技大学"),
        "hk_edu_polyu": ("60 院校档案", "香港理工大学"),
        "hk_edu_hkbu": ("60 院校档案", "香港浸会大学"),
        "hk_edu_lingnan": ("60 院校档案", "岭南大学"),
    }
    for code, folder in cases.items():
        route = resolve_route(code, "https://example.edu.hk/x.html")
        assert route.kb_key == "edu", code
        assert route.dataset_id == EDU_DATASET_ID, code
        assert route.region == "香港", code
        assert route.folder_path == folder, code
        assert route.column is None, code


def test_edu_edb_primary_1_admission():
    route = resolve_route(
        "hk_edu_edb",
        "https://www.edb.gov.hk/sc/edu-system/primary-secondary/spa-systems/"
        "primary-1-admission/school-lists/index.html",
    )
    assert route.dataset_id == EDU_DATASET_ID
    assert route.department == "教育局"
    assert route.folder_path == ("20 小学", "小一入学统筹办法")
    assert route.column == "小一入学统筹办法"


def test_edu_edb_secondary_placement():
    for path in (
        "/sc/edu-system/primary-secondary/spa-systems/secondary-spa/general-info/FAQs.html",
        "/sc/edu-system/primary-secondary/spa-systems/secondary-4-placement/index.html",
    ):
        route = resolve_route("hk_edu_edb", "https://www.edb.gov.hk" + path)
        assert route.folder_path == ("30 中学", "中一派位"), path


def test_edu_edb_kindergarten_and_postsecondary():
    route = resolve_route(
        "hk_edu_edb",
        "https://www.edb.gov.hk/sc/edu-system/preprimary-kindergarten/"
        "kindergarten-k1-admission-arrangements/2728_admission_arrangements.html",
    )
    assert route.folder_path == ("10 学前教育", "幼稚园入学")
    route = resolve_route(
        "hk_edu_edb",
        "https://www.edb.gov.hk/sc/edu-system/preprimary-kindergarten/"
        "preprimary-voucher/index.html",
    )
    assert route.folder_path == ("10 学前教育", "幼稚园教育计划")
    route = resolve_route(
        "hk_edu_edb",
        "https://www.edb.gov.hk/sc/edu-system/postsecondary/policy-doc/Scheme_2026/index.html",
    )
    assert route.folder_path == ("50 专上教育", "专上政策与资助")


def test_edu_edb_student_parents_branches():
    cases = {
        "/sc/student-parents/sch-info/sch-search/schlist-by-district/school-list-cw.html":
            ("80 办学类型与学校资料", "学校概览与校网"),
        "/sc/student-parents/support-subsidies/assistance-scheme/index.html":
            ("90 学生资助与奖学",),
        "/sc/student-parents/placement-assistance/about-placement-assistance/faq.html":
            ("70 非本地学生来港", "新来港儿童入学"),
        "/sc/student-parents/newly-arrived-children/overview/index.html":
            ("70 非本地学生来港", "新来港儿童入学"),
        "/sc/student-parents/spa-systems/overview/index.html":
            ("00 教育体系总览",),
    }
    for path, folder in cases.items():
        route = resolve_route("hk_edu_edb", "https://www.edb.gov.hk" + path)
        assert route.folder_path == folder, path


def test_edu_edb_moi_and_direct_subsidy():
    route = resolve_route(
        "hk_edu_edb",
        "https://www.edb.gov.hk/sc/edu-system/primary-secondary/applicable-to-secondary/"
        "moi/index.html",
    )
    assert route.folder_path == ("30 中学", "课程与教学语言")
    route = resolve_route(
        "hk_edu_edb",
        "https://www.edb.gov.hk/sc/edu-system/primary-secondary/"
        "applicable-to-primary-secondary/direct-subsidy-scheme/index.html",
    )
    assert route.folder_path == ("80 办学类型与学校资料", "办学类型")


def test_edu_edb_fallback_overview():
    route = resolve_route(
        "hk_edu_edb",
        "https://www.edb.gov.hk/sc/edu-system/primary-secondary/spa-systems/index.html",
    )
    assert route.folder_path == ("00 教育体系总览",)


def test_edu_sources_routable():
    for code in ("hk_edu_edb", "hk_edu_hku", "hk_edu_hkust_join", "hk_edu_lingnan"):
        assert is_routable(code) is True, code
