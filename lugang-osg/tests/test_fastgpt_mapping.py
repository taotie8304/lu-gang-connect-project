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
    # 13 香港 + 7 山东省级 + 4 济南，共 24 个可导入源均有路由
    codes = [
        "hk_data_gov",
        "hk_edb",
        "hk_gia_press",
        "hk_gov_portal",
        "hk_hkma",
        "hk_immd",
        "hk_investhk",
        "hk_ird",
        "hk_itib",
        "hk_news_gov",
        "hk_policy_address",
        "hk_tid",
        "hk_wfsfaa",
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
