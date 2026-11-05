# 鲁港通 - 同文判重测试：URL 身份归一 + 采集入库按身份跳过别名网址
# 全部离线（SQLite 内存库 + 假 fetcher），不发真实网络请求。
#
# 背景（2026-11-05 实测）：同一份政府文件常挂在两个栏目路径下（长清/市中），或文章
# 地址带一个每次刷新都变的临时参数（起步区 ?type=）。采集按 URL 精确串判重，于是
# 同一篇文章建了两条文档、进了知识库两份同名文件。判重改用「文档身份」而非原始网址。
from __future__ import annotations

from sqlalchemy import select

from app.ingest.pipeline import sync_source
from app.ingest.url_identity import document_identity, identity_key
from app.ingest.yaml_import import import_sources_yaml
from app.models import Document, Source

from test_ingest import _FakeFetcher, _LONG_EN, _article_html, _mk_settings, fake_resolver

HOST = "www.jnalias.test"
FEED = f"http://{HOST}/gongkai/feed.xml"
DOC_TOKEN = "doc_deadbeef0123456789abcdef.html"
# 同一文件的两种栏目挂载形态（长清/市中实测形态）
ALIAS_A = f"http://{HOST}/gongkai/channel_aaa/{DOC_TOKEN}"
ALIAS_B = f"http://{HOST}/gongkai/site_bbb/channel_ccc/{DOC_TOKEN}"
# 同一文件的裸地址与带临时参数地址（起步区实测形态）
ALIAS_TYPE = f"{ALIAS_A}?type=Rotating1"
OTHER_DOC = f"http://{HOST}/gongkai/channel_eee/doc_111122223333444455556666.html"

CFG = {
    "url_identity_path_capture": r"/(doc_[0-9a-f]{16,40}\.html)$",
    "url_identity_ignore_params": ["type"],
}

IDENTITY_YAML = f"""
sources:
  - id: jn_alias_test
    name: 测试同文判重站
    group: sd_core_gov
    organization: 测试区政府
    base_domains: [{HOST}]
    allowed_path_prefixes: [/gongkai/]
    allow_http: true
    discovery_method: rss
    feed_urls:
      - {FEED}
    url_identity_path_capture: '/(doc_[0-9a-f]{{16,40}}\\.html)$'
    url_identity_ignore_params: [type]
    enabled: true
"""


def _rss(links: list[str]) -> bytes:
    items = "".join(
        f"<item><title>文章{i}</title><link>{u}</link></item>"
        for i, u in enumerate(links, 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<rss version=\"2.0\"><channel><title>T</title>{items}</channel></rss>"
    ).encode("utf-8")


class TestDocumentIdentity:
    def test_channel_alias_paths_share_one_identity(self):
        assert document_identity(ALIAS_A, CFG) == document_identity(ALIAS_B, CFG)

    def test_volatile_query_param_dropped(self):
        assert document_identity(ALIAS_TYPE, CFG) == document_identity(ALIAS_A, CFG)

    def test_different_doc_tokens_stay_distinct(self):
        assert document_identity(ALIAS_A, CFG) != document_identity(OTHER_DOC, CFG)

    def test_unconfigured_query_params_are_preserved(self):
        # 鲁港通 - 医管局式页面只靠 Content_ID 区分，参数不得被无差别丢掉
        a = "https://www.ha.org.hk/visitor/ha_view_content.asp?Parent_ID=1&Content_ID=10045"
        b = "https://www.ha.org.hk/visitor/ha_view_content.asp?Parent_ID=1&Content_ID=259365"
        assert document_identity(a, CFG) != document_identity(b, CFG)
        # 鲁港通 - 身份规则只该折叠「已声明会漂移」的形态；无关参数必须原样保留，
        # 配不配 capture 都不得改写这条 URL（否则整个 HA 来源的存量文档会判为陌生网址）。
        assert "Content_ID=10045" in document_identity(a, CFG)
        assert document_identity(a, CFG) == document_identity(a, cfg=None)

    def test_param_name_match_is_case_insensitive(self):
        assert document_identity(f"{ALIAS_A}?TYPE=abc", CFG) == document_identity(ALIAS_A, CFG)

    def test_fragment_always_dropped(self):
        assert document_identity(f"{ALIAS_A}#top", CFG) == document_identity(ALIAS_A, CFG)

    def test_trailing_slash_normalized(self):
        plain = "https://www.news.gov.hk/en/2026/09/1"
        assert document_identity(f"{plain}/", CFG) == document_identity(plain, CFG)

    def test_no_config_is_passthrough(self):
        # 鲁港通 - 未配置身份规则来源必须保持现有行为，否则存量文档全部判为陌生网址
        url = "https://www.news.gov.hk/en/2026/09/1.html?a=1#x"
        assert document_identity(url, None) == "https://www.news.gov.hk/en/2026/09/1.html?a=1"

    def test_capture_pattern_miss_keeps_full_path(self):
        url = "http://commerce.shandong.gov.cn/art/2026/9/4/art_103585_10328790.html"
        assert document_identity(url, CFG) == url

    def test_bad_url_fails_open(self):
        # 鲁港通 - 身份函数只在判重前多做一次字符串加工，异常输入不得影响采集主流程
        assert document_identity("not a url", CFG) == "not a url"
        assert document_identity("", CFG) == ""


class TestIdentityGate:
    """判重键只在显式配置了身份规则的来源上折叠，其余来源行为逐字节不变。"""

    def test_unconfigured_source_keys_on_raw_url(self):
        url = "https://www.ha.org.hk/visitor/ha_view_content.asp?a=1#/tab"
        assert identity_key(url, None) == url
        assert identity_key(url, {"title_exclude_patterns": ["通知"]}) == url

    def test_configured_source_collapses_forms(self):
        assert identity_key(ALIAS_TYPE, CFG) == identity_key(ALIAS_A, CFG)
        assert identity_key(ALIAS_B, CFG) == identity_key(ALIAS_A, CFG)


class TestIdentityConfigImport:
    def test_yaml_import_keeps_identity_keys(self, db):
        # 鲁港通 - 新配置键漏登记导入白名单会静默丢配置（历史上踩过两次）
        import_sources_yaml(IDENTITY_YAML, db)
        src = db.execute(
            select(Source).where(Source.code == "jn_alias_test")
        ).scalar_one()
        assert src.discovery_config["url_identity_ignore_params"] == ["type"]
        assert src.discovery_config["url_identity_path_capture"] == CFG[
            "url_identity_path_capture"
        ]


class TestPipelineSkipsAlias:
    def _source(self, db) -> Source:
        import_sources_yaml(IDENTITY_YAML, db)
        return db.execute(
            select(Source).where(Source.code == "jn_alias_test")
        ).scalar_one()

    def test_alias_url_creates_no_second_document(self, db):
        src = self._source(db)
        page = _article_html("长清区办法", _LONG_EN)
        fetcher = _FakeFetcher({FEED: _rss([ALIAS_A]), ALIAS_A: page})
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)
        assert stats.new_docs == 1

        # 第二轮：列表改挂同一文件的另一栏目路径
        fetcher.responses[FEED] = _rss([ALIAS_A, ALIAS_B])
        fetcher.responses[ALIAS_B] = page
        stats2 = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                             sleeper=lambda s: None, resolver=fake_resolver)

        assert stats2.new_docs == 0
        assert ALIAS_B not in fetcher.calls  # 同一篇文章，不必再抓一遍
        assert len(db.execute(select(Document)).scalars().all()) == 1

    def test_archived_copy_still_blocks_alias_recreate(self, db):
        # 鲁港通 - 存量清理把副本置为 archived 后，别名网址也不得再新建第二条文档
        src = self._source(db)
        page = _article_html("长清区办法", _LONG_EN)
        fetcher = _FakeFetcher({FEED: _rss([ALIAS_A]), ALIAS_A: page})
        sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                    sleeper=lambda s: None, resolver=fake_resolver)
        doc = db.execute(select(Document)).scalar_one()
        doc.status = "archived"
        db.commit()

        fetcher.responses[FEED] = _rss([ALIAS_B])
        fetcher.responses[ALIAS_B] = page
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)

        assert stats.new_docs == 0
        assert len(db.execute(select(Document)).scalars().all()) == 1

    def test_prefers_live_document_when_alias_archived(self, db):
        # 鲁港通 - 同一身份下有归档副本也有在用文档时，命中在用那份（内容更新不落到归档行）
        src = self._source(db)
        page = _article_html("长清区办法", _LONG_EN)
        fetcher = _FakeFetcher({FEED: _rss([ALIAS_A, ALIAS_B]), ALIAS_A: page, ALIAS_B: page})
        sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                    sleeper=lambda s: None, resolver=fake_resolver)
        docs = db.execute(select(Document)).scalars().all()
        assert len(docs) == 1

        live = docs[0]
        assert live.status == "candidate"

        # 正文更新后从别名地址重抓：更新应落在同一文档上，不新建、不丢在用状态
        updated = _article_html("长清区办法", _LONG_EN + " 补充一条执行条款。")
        fetcher.responses[ALIAS_B] = updated
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver,
                            force_refetch=True)
        assert stats.new_docs == 0
        assert len(db.execute(select(Document)).scalars().all()) == 1
        assert db.execute(select(Document)).scalar_one().id == live.id
