# 鲁港通 - 开户库来源配置静态校验（sources.yaml）
# 目的：固化招商永隆启用结论（旧版静态 CMS 站两页），防止后续改配置时误删/误扩。
from pathlib import Path

import yaml

from app.fastgpt.mapping import resolve_route


def _load_sources() -> dict[str, dict]:
    path = Path(__file__).resolve().parents[1] / "sources.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    sources = data["sources"] if isinstance(data, dict) else data
    return {src["id"]: src for src in sources}


def test_cmbwl_source_fixed_urls_weekly_and_not_truncated():
    source = _load_sources()["hk_bank_cmbwl"]
    assert source["group"] == "hk_bank_open"
    assert source["discovery_method"] == "fixed_url"
    assert source["enabled"] is True
    assert source["rate_limit_per_minute"] == 4
    assert source["max_pages_per_run"] >= len(source["fixed_urls"])
    assert len(source["fixed_urls"]) == 2
    fields = source["schedule"].split()
    assert len(fields) == 5 and fields[4] == "0", source["schedule"]


def test_cmbwl_only_verified_static_pages():
    source = _load_sources()["hk_bank_cmbwl"]
    assert set(source["fixed_urls"]) == {
        "https://www.cmbwinglungbank.com/wlb_corporate/cn/about-us/service-guide/documents-required-for-opening-account.html",
        "https://www.cmbwinglungbank.com/wlb_corporate/cn/personal/deposits/wing-lung-all-in-one-card-services.html",
    }
    for url in source["fixed_urls"]:
        assert url.startswith("https://www.cmbwinglungbank.com/wlb_corporate/cn/"), url
    assert source["allowed_path_prefixes"] == ["/wlb_corporate/cn/"]


def test_cms_account_opening_fixed_url():
    # 鲁港通 - 原 listing 只发现下载页（导航枢纽长期零入库），改为固定采开户页正文
    source = _load_sources()["hk_sec_cms"]
    assert source["discovery_method"] == "fixed_url"
    assert source["fixed_urls"] == ["https://www.cmschina.com.hk/CS/AccountOpening"]
    assert source.get("keep_form") is True
    assert source["title_strip_prefixes"] == ["招商證券國際有限公司 - 客戶服務 - "]
    assert source["max_pages_per_run"] >= 1


def test_cmbwl_maps_to_bank_center_folder():
    route = resolve_route(
        "hk_bank_cmbwl",
        "https://www.cmbwinglungbank.com/wlb_corporate/cn/x.html",
    )
    assert route.kb_key == "bank"
    assert route.folder_path == ("10 传统银行", "招商永隆银行")


def test_bochk_docs_pdf_source_and_route():
    # 鲁港通 - 中银「开立账户程序及所需文件/资料」为 PDF-only，2026-11-20 起随 PDF 文本提取能力入库
    source = _load_sources()["hk_bank_bochk_docs"]
    assert source["group"] == "hk_bank_open"
    assert source["discovery_method"] == "fixed_url"
    assert source["enabled"] is True
    url = "https://www.bochk.com/dam/bochk/desktop/interface/AC_Open_sc.pdf"
    assert source["fixed_urls"] == [url]
    assert source["allowed_path_prefixes"] == ["/dam/bochk/desktop/interface/"]
    assert source["title_overrides"][url] == "开立账户程序及所需文件及资料"
    fields = source["schedule"].split()
    assert len(fields) == 5 and fields[4] == "0", source["schedule"]

    route = resolve_route("hk_bank_bochk_docs", url)
    assert route.kb_key == "bank"
    assert route.folder_path == ("10 传统银行", "中国银行（香港）")
