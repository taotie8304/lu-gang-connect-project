# 鲁港通 - 香港生活办事来源配置静态校验（sources.yaml，2026-11-20）
# 目的：把运输署/积金局来源限域与房屋署补充清单锁进测试，防止后续调整时
# 混入非范围内页面或把栏目页当文档入库。
import re
from pathlib import Path

import yaml

from app.fastgpt.mapping import HK_DATASET_ID, resolve_route

LIFE_SOURCE_IDS = {"hk_td", "hk_mpfa", "hk_customs_pc"}
HOUSING_EXPECTED_URLS = 23


def _load_sources() -> dict[str, dict]:
    path = Path(__file__).resolve().parents[1] / "sources.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    sources = data["sources"] if isinstance(data, dict) else data
    return {src["id"]: src for src in sources}


def test_life_sources_exist_and_weekly_sunday():
    life = {
        code: src
        for code, src in _load_sources().items()
        if src.get("group") == "hk_life_services"
    }
    assert set(life) == LIFE_SOURCE_IDS
    schedules = set()
    for src in life.values():
        assert src["enabled"] is True
        assert src["rate_limit_per_minute"] == 4
        fields = src["schedule"].split()
        assert len(fields) == 5 and fields[4] == "0", src["schedule"]
        schedules.add(src["schedule"])
    assert len(schedules) == len(life)


def test_td_listing_scope_and_index_pages():
    td = _load_sources()["hk_td"]
    assert td["discovery_method"] == "listing"
    # 运输署核心办事页均以 /index.html 结尾，必须放行，否则整源采不到正文
    assert td["allow_index_pages"] is True
    assert len(td["listing_urls"]) == 6
    entries = "\n".join(td["listing_urls"])
    for segment in (
        "driving_licences/how_to_apply_for_a_driving_licence",
        "vehicle_licences",
        "vehicle_first_registration",
        "closed_road_permit_for_cross_boundary_vehicles",
    ):
        assert segment in entries, segment
    pattern = re.compile(td["link_pattern"])
    assert pattern.search(
        "https://www.td.gov.hk/tc/public_services/licences_and_permits/edl/index.html"
    )
    assert pattern.search(
        "https://www.td.gov.hk/tc/public_services/licences_and_permits/southboundtravel/index.html"
    )
    assert not pattern.search(
        "https://www.td.gov.hk/tc/public_services/licences_and_permits/hire_car_permit/index.html"
    )
    assert td["max_pages_per_run"] == 50


def test_mpfa_sitemap_scope():
    mpfa = _load_sources()["hk_mpfa"]
    assert mpfa["discovery_method"] == "sitemap"
    assert mpfa["sitemap_urls"] == ["https://www.mpfa.org.hk/sitemap.xml"]
    pattern = re.compile(mpfa["sitemap_url_pattern"])
    assert pattern.search("https://www.mpfa.org.hk/mpf-system/withdrawal-of-mpf")
    assert pattern.search("https://www.mpfa.org.hk/empf/empf-platform")
    assert not pattern.search(
        "https://www.mpfa.org.hk/info-centre/faq/mpf-system/employee-choice-arrangement/x"
    )
    # sitemap 文件本身也必须放行，否则首轮直接 NOT_IN_ALLOWLIST（教育源同类经验）
    assert set(mpfa["allowed_path_prefixes"]) == {"/sitemap.xml", "/mpf-system/", "/empf/"}
    assert mpfa["content_selector"] == "#mainContent"
    # sitemap 每轮从头处理，上限须覆盖范围内全部链接（实测 50 条）
    assert mpfa["max_pages_per_run"] >= 50


def test_housing_fixed_urls_complete_titles():
    hd = _load_sources()["hk_hd_policy"]
    urls = hd["fixed_urls"]
    overrides = hd["title_overrides"]
    assert len(urls) == HOUSING_EXPECTED_URLS
    assert set(overrides) == set(urls)
    # fixed_url 按清单顺序处理，上限小于清单数会让尾部页面永远轮不到
    assert hd["max_pages_per_run"] >= len(urls)
    joined = "\n".join(urls)
    for segment in (
        "flat-application/allocation-status",
        "hos-flats/eligibility",
        "hos-flats/general-sales-information",
        "gsh-ownership/eligibility-gsh",
        "gsh-ownership/general-sales-information-gsh",
        "hos-secondary-market/buying-a-flat",
        "buying-a-flat-under-tps/eligibility",
        "buying-a-flat-under-tps/mortgage-arrangement",
    ):
        assert segment in joined, segment


# 鲁港通 - 香港海关旅客清关（2026-11-20）：免税限额/现金申报/禁运物品，固定 7 页
CUSTOMS_BASE = "https://www.customs.gov.hk/sc/service-enforcement-information"
CUSTOMS_EXPECTED_URLS = {
    f"{CUSTOMS_BASE}/passenger-clearance/red-green-channel-system/index.html",
    f"{CUSTOMS_BASE}/passenger-clearance/duty-free-concessions/index.html",
    f"{CUSTOMS_BASE}/passenger-clearance/prohibited-controlled-items/index.html",
    f"{CUSTOMS_BASE}/passenger-clearance/currency-bearer-negotiable-instruments/index.html",
    f"{CUSTOMS_BASE}/passenger-clearance/faqs/index.html",
    f"{CUSTOMS_BASE}/passenger-clearance/faqs/common-charges-penalties/index.html",
    f"{CUSTOMS_BASE}/cargo-clearance/prohibited-articles/index.html",
}


def test_customs_fixed_urls_enabled_and_bounded():
    source = _load_sources()["hk_customs_pc"]
    assert source["enabled"] is True
    assert source["discovery_method"] == "fixed_url"
    assert source["group"] == "hk_life_services"
    assert set(source["fixed_urls"]) == CUSTOMS_EXPECTED_URLS
    # fixed_url 按清单顺序处理，上限小于清单数会让尾部页面永远轮不到
    assert source["max_pages_per_run"] >= len(source["fixed_urls"])
    assert source["rate_limit_per_minute"] == 4
    fields = source["schedule"].split()
    assert len(fields) == 5 and fields[4] == "0", source["schedule"]
    # 每页标题需可读（站点 <title> 均带「香港海关 - 」前缀，统一覆盖为可辨识来源名）
    assert set(source["title_overrides"]) == CUSTOMS_EXPECTED_URLS


def test_customs_urls_inside_allowlist():
    source = _load_sources()["hk_customs_pc"]
    prefixes = tuple(source["allowed_path_prefixes"])
    for url in CUSTOMS_EXPECTED_URLS:
        path = url[len("https://www.customs.gov.hk"):]
        assert any(path.startswith(p) for p in prefixes), url


def test_customs_routes_to_hk_dataset_with_verified_date():
    url = f"{CUSTOMS_BASE}/passenger-clearance/duty-free-concessions/index.html"
    route = resolve_route("hk_customs_pc", url)
    assert route.dataset_id == HK_DATASET_ID
    assert route.department == "香港海关"
    assert route.folder_path == ("香港海关",)
    assert route.verified is True
