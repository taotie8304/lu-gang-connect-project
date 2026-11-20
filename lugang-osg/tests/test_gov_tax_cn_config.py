# 鲁港通 - 政府一站通简体税务来源配置静态校验（2026-11-20）
# 目的：既有 hk_gov_portal 只采 /en/ 英文页，大陆用户缺少中文薪俸税内容；
# 此来源固定采 /sc/ 简体税务 14 页，锁进测试防止白名单与清单漂移。
from pathlib import Path

import yaml

from app.fastgpt.mapping import HK_DATASET_ID, resolve_route

TAX_BASE = "https://www.gov.hk/sc/residents/taxes"
TAX_EXPECTED_URLS = {
    f"{TAX_BASE}/salaries/salariestax/employeeobligations.htm",
    f"{TAX_BASE}/salaries/salariestax/chargeable/index.htm",
    f"{TAX_BASE}/salaries/salariestax/exemption/index.htm",
    f"{TAX_BASE}/salaries/salariestax/jointassessment.htm",
    f"{TAX_BASE}/salaries/personal/personaleligibility.htm",
    f"{TAX_BASE}/salaries/allowances/allowances/index.htm",
    f"{TAX_BASE}/salaries/allowances/deductions/index.htm",
    f"{TAX_BASE}/taxfiling/filing/completion.htm",
    f"{TAX_BASE}/taxfiling/filing/types/index.htm",
    f"{TAX_BASE}/taxfiling/taxrates/salariesrates.htm",
    f"{TAX_BASE}/taxfiling/payment/personpayment.htm",
    f"{TAX_BASE}/taxfiling/consequences/consequencenotpaytax.htm",
    f"{TAX_BASE}/taxfiling/consequences/recovertax.htm",
    f"{TAX_BASE}/taxfiling/object/provisional.htm",
}


def _load_sources() -> dict[str, dict]:
    path = Path(__file__).resolve().parents[1] / "sources.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    sources = data["sources"] if isinstance(data, dict) else data
    return {src["id"]: src for src in sources}


def test_gov_tax_cn_source_enabled_and_bounded():
    source = _load_sources()["hk_gov_tax_cn"]
    assert source["enabled"] is True
    assert source["discovery_method"] == "fixed_url"
    assert source["base_domains"] == ["www.gov.hk"]
    assert source["content_selector"] == ".mainHolder"
    assert set(source["fixed_urls"]) == TAX_EXPECTED_URLS
    # fixed_url 按清单顺序处理，上限小于清单数会让尾部页面永远轮不到
    assert source["max_pages_per_run"] >= len(source["fixed_urls"])
    assert source["rate_limit_per_minute"] <= 6
    fields = source["schedule"].split()
    assert len(fields) == 5, source["schedule"]


def test_gov_tax_cn_urls_inside_allowlist():
    source = _load_sources()["hk_gov_tax_cn"]
    prefixes = tuple(source["allowed_path_prefixes"])
    for url in TAX_EXPECTED_URLS:
        path = url[len("https://www.gov.hk"):]
        assert any(path.startswith(p) for p in prefixes), url
    # 英文老来源白名单不受影响
    portal = _load_sources()["hk_gov_portal"]
    assert all("/en/" in p for p in portal["allowed_path_prefixes"])


def test_gov_tax_cn_title_prefix_stripped():
    source = _load_sources()["hk_gov_tax_cn"]
    assert "GovHK 香港政府一站通：" in source["title_strip_prefixes"]


def test_gov_tax_cn_routes_to_tax_department():
    url = f"{TAX_BASE}/taxfiling/taxrates/salariesrates.htm"
    route = resolve_route("hk_gov_tax_cn", url)
    assert route.dataset_id == HK_DATASET_ID
    assert route.department == "税务局"
    assert route.folder_path == ("税务局",)
    assert route.verified is True
