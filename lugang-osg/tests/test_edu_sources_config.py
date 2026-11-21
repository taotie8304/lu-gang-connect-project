# 鲁港通 - 教育库港大/浸会来源配置校验（sources.yaml）
# 目的：锁定 2026-11-20 「重定向出白名单」修复口径，防止每日任务重复空转失败。
from pathlib import Path

import yaml


def _load_sources() -> dict[str, dict]:
    path = Path(__file__).resolve().parents[1] / "sources.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    sources = data["sources"] if isinstance(data, dict) else data
    return {src["id"]: src for src in sources}


def test_hkbu_listing_avoids_root_redirect_and_research_news():
    source = _load_sources()["hk_edu_hkbu"]
    # 鲁港通 - admissions.hkbu.edu.hk/en/ 301 到无斜杠根；根路径本身也须在白名单内
    assert "https://admissions.hkbu.edu.hk" in source["listing_urls"]
    assert "https://admissions.hkbu.edu.hk/en/" not in source["listing_urls"]
    assert "/" in source["allowed_path_prefixes"]
    # 鲁港通 - 科研新闻（research.hkbu.edu.hk）不属招生内容，www 站只放行关于/院系栏目
    pattern = source["link_pattern"]
    assert "whats-new" not in pattern
    assert r"www\.hkbu\.edu\.hk/en/about/" in pattern


def test_hku_admissions_allows_redirect_targets():
    source = _load_sources()["hk_edu_hku_admissions"]
    prefixes = source["allowed_path_prefixes"]
    # 鲁港通 - /zh-hans/node/1749 与 sndas_highschool 分别 302 到 /node/ 与 /talent_search_scheme_TSS
    assert "/node/" in prefixes
    assert "/talent_search_scheme_TSS" in prefixes


def test_cuhk_fees_entry_uses_final_url():
    """鲁港通 - /tc/fees/ 301 到 /fees-financing-your-studies/fees/（2026-11-21 实测），
    入口必须直接用最终地址，否则整轮采集 REDIRECT_OUT_OF_ALLOWLIST 中止。"""
    source = _load_sources()["hk_edu_cuhk"]
    assert "https://admission.cuhk.edu.hk/fees-financing-your-studies/fees/" in source["listing_urls"]
    assert "https://admission.cuhk.edu.hk/tc/fees/" not in source["listing_urls"]
    assert "/fees-financing-your-studies/" in source["allowed_path_prefixes"]


def test_jupas_and_ugc_exclude_privacy_notices():
    """鲁港通 - JUPAS/UGC 的隐私声明页面无政策办理价值（2026-11-21 存量 3 篇已归档），
    来源层加入标题排除词，防止后续再采。"""
    sources = _load_sources()
    jupas = sources["hk_edu_jupas"]
    ugc = sources["hk_edu_ugc"]
    assert "Personal Data" in jupas["title_exclude_patterns"]
    assert "Privacy" in ugc["title_exclude_patterns"]
