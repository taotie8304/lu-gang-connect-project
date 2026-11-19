# 鲁港通 - 就医库来源配置静态校验（sources.yaml）
# 目的：把 T3 固化结果锁进测试，防止后续改配置时漏标题/漏页/截尾或混入非简体页。
from pathlib import Path

import yaml

MED_SOURCE_IDS = {
    "hk_med_ha_overview",
    "hk_med_ha_ae",
    "hk_med_ha_gopc",
    "hk_med_ha_sopc",
    "hk_med_ha_cm",
    "hk_med_ha_fees",
    "hk_med_hago",
    "hk_med_ha_clusters",
    "hk_med_ha_other",
}
EXPECTED_TOTAL_PAGES = 61


def _load_med_sources() -> dict[str, dict]:
    path = Path(__file__).resolve().parents[1] / "sources.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    sources = data["sources"] if isinstance(data, dict) else data
    return {
        src["id"]: src
        for src in sources
        if src.get("group") == "hk_med_guide"
    }


def test_med_sources_exact_set_and_total_pages():
    sources = _load_med_sources()
    assert set(sources) == MED_SOURCE_IDS
    assert sum(len(s["fixed_urls"]) for s in sources.values()) == EXPECTED_TOTAL_PAGES


def test_med_sources_fixed_url_weekly_and_not_truncated():
    sources = _load_med_sources()
    schedules = set()
    for source in sources.values():
        assert source["discovery_method"] == "fixed_url"
        assert source["enabled"] is True
        assert source["rate_limit_per_minute"] == 4
        # fixed_url 按清单顺序处理，上限小于清单数会让尾部页面永远轮不到
        assert source["max_pages_per_run"] >= len(source["fixed_urls"])
        fields = source["schedule"].split()
        assert len(fields) == 5 and fields[4] == "1", source["schedule"]
        schedules.add(source["schedule"])
    assert len(schedules) == len(sources)


def test_med_sources_have_readable_title_for_every_url():
    for source in _load_med_sources().values():
        overrides = source.get("title_overrides") or {}
        assert set(overrides) == set(source["fixed_urls"]), source["id"]
        for title in overrides.values():
            assert title.strip()
            assert title.strip() != "HA", source["id"]


def test_med_sources_simplified_pages_and_selectors():
    for source in _load_med_sources().values():
        for url in source["fixed_urls"]:
            if url.startswith("https://www.ha.org.hk/"):
                assert "Lang=CHIGB" in url, url
                assert "Content_ID=" in url, url
                assert source.get("content_selector") == "#contentarea"
            elif url.startswith("https://www2.ha.org.hk/"):
                assert url.startswith("https://www2.ha.org.hk/hago/zh-cn/"), url
                assert "content_selector" not in source
            else:
                raise AssertionError(f"unexpected med domain: {url}")