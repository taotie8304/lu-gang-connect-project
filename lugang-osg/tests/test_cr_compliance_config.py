# 鲁港通 - 公司注册处来源配置静态校验（sources.yaml，2026-11-20）
# 目的：锁定合规栏目 7 页（周年申报表 NAR1/NN3、交付规定、执法）与路径放行，
# 防止后续调整时把检控个案列表等低价值页误加回来源。
from pathlib import Path

import yaml

CR_ORIGIN = "https://www.cr.gov.hk"
CR_COMPLIANCE_URLS = {
    f"{CR_ORIGIN}/tc/compliance/obligations.htm",
    f"{CR_ORIGIN}/tc/compliance/filing-requirements.htm",
    f"{CR_ORIGIN}/tc/compliance/enforcement.htm",
    f"{CR_ORIGIN}/tc/compliance/annual-return/private-company.htm",
    f"{CR_ORIGIN}/tc/compliance/annual-return/non-hk-company.htm",
    f"{CR_ORIGIN}/tc/compliance/annual-return/ereminder.htm",
    f"{CR_ORIGIN}/tc/compliance/annual-return/calculator.htm",
}


def _load_sources() -> dict[str, dict]:
    path = Path(__file__).resolve().parents[1] / "sources.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    sources = data["sources"] if isinstance(data, dict) else data
    return {src["id"]: src for src in sources}


def test_cr_compliance_urls_added_and_allowlisted():
    source = _load_sources()["hk_cr_policy"]
    urls = set(source["fixed_urls"])
    assert CR_COMPLIANCE_URLS <= urls, CR_COMPLIANCE_URLS - urls
    prefixes = tuple(source["allowed_path_prefixes"])
    assert "/tc/compliance/" in prefixes
    for url in urls:
        path = url[len(CR_ORIGIN):]
        assert any(path.startswith(p) for p in prefixes), url


def test_cr_fixed_urls_not_truncated_and_titled():
    source = _load_sources()["hk_cr_policy"]
    urls = source["fixed_urls"]
    # fixed_url 按清单顺序处理，上限小于清单数会让尾部页面永远轮不到
    assert source["max_pages_per_run"] >= len(urls)
    assert set(source["title_overrides"]) == set(urls)
    overrides = source["title_overrides"]
    assert overrides[f"{CR_ORIGIN}/tc/compliance/annual-return/private-company.htm"] == (
        "公司注册处 - 周年申报表（本地私人公司 NAR1）"
    )
    assert overrides[f"{CR_ORIGIN}/tc/compliance/annual-return/non-hk-company.htm"] == (
        "公司注册处 - 周年申报表（注册非香港公司 NN3）"
    )


def test_cr_excludes_low_value_pages():
    # 鲁港通 - 检控个案概要（8k 字个案列表）与限期计算器交互页之外的检控细节不纳入
    source = _load_sources()["hk_cr_policy"]
    urls = set(source["fixed_urls"])
    assert f"{CR_ORIGIN}/tc/compliance/prosecution.htm" not in urls
