# 鲁港通 - Phase 2 测试：yaml 导入 / 发现层解析 / 内容提取 / pipeline 全流程
# 全部离线（SQLite 内存库 + 假 fetcher），不发真实网络请求。
from __future__ import annotations

import json

import pytest
from sqlalchemy import select

from app.config import Settings
from app.database import Base
from app.ingest.discover import (
    is_listing_page,
    parse_api_json,
    parse_js_menu,
    parse_listing,
    parse_rss,
    parse_sitemap,
)
from app.ingest.extract import MIN_CONTENT_CHARS, clean_title, extract_html
from app.ingest.pipeline import sync_source
from app.ingest.yaml_import import import_sources_yaml
from app.models import CrawlRun, CrawlTask, Document, DocumentVersion, Source, SourceDomainRule
from app.security.fetcher import FetchResult

# 鲁港通 - db fixture 已上移 tests/conftest.py（探测工具测试共用）


MINI_YAML = """
sources:
  - id: hk_news_test
    name: 测试新闻网
    group: hk_core_gov
    organization: 测试机构
    base_domains: [www.news.gov.hk]
    allowed_path_prefixes: [/en/]
    discovery_method: rss
    feed_urls:
      - https://www.news.gov.hk/en/common/html/topstories.rss.xml
    schedule: "0 */6 * * *"
    rate_limit_per_minute: 6
    enabled: true
  - id: sd_test
    name: 测试山东厅
    group: sd_core_gov
    organization: 山东省商务厅
    base_domains: [commerce.shandong.gov.cn]
    allowed_path_prefixes: [/]
    allow_http: true
    force_ipv4: true
    discovery_method: listing
    listing_urls:
      - http://commerce.shandong.gov.cn/
    enabled: true
"""


# ---------------------------------------------------------------------------
# yaml 导入器
# ---------------------------------------------------------------------------

class TestYamlImport:
    def test_import_creates_sources_and_rules(self, db):
        result = import_sources_yaml(MINI_YAML, db)
        assert result.imported == ["hk_news_test", "sd_test"]
        assert not result.errors

        src = db.execute(select(Source).where(Source.code == "hk_news_test")).scalar_one()
        assert src.discovery_method == "rss"
        assert src.allow_http is False
        assert src.discovery_config["feed_urls"]

        rules = db.execute(
            select(SourceDomainRule).where(SourceDomainRule.source_id == src.id)
        ).scalars().all()
        assert len(rules) == 1
        assert rules[0].hostname == "www.news.gov.hk"
        assert rules[0].path_prefix == "/en/"
        assert rules[0].allow_http is False

    def test_import_idempotent_and_http_flag(self, db):
        import_sources_yaml(MINI_YAML, db)
        result = import_sources_yaml(MINI_YAML, db)
        # 第二次导入全部是 update，不新增
        assert result.imported == []
        assert set(result.updated) == {"hk_news_test", "sd_test"}
        assert db.execute(select(Source)).scalars().all().__len__() == 2

        sd = db.execute(select(Source).where(Source.code == "sd_test")).scalar_one()
        assert sd.allow_http is True and sd.force_ipv4 is True
        sd_rules = db.execute(
            select(SourceDomainRule).where(SourceDomainRule.source_id == sd.id)
        ).scalars().all()
        assert all(r.allow_http for r in sd_rules)

    def test_import_bad_yaml_rejected(self, db):
        with pytest.raises(ValueError):
            import_sources_yaml("not_a_mapping: [", db)


# ---------------------------------------------------------------------------
# 发现层解析器
# ---------------------------------------------------------------------------

RSS_SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>T</title>
<item><title>香港新闻一</title><link>https://www.news.gov.hk/en/2026/09/1.html</link>
<pubDate>Wed, 09 Sep 2026 08:00:00 GMT</pubDate></item>
<item><title>香港新闻二</title><link>https://www.news.gov.hk/en/2026/09/2.html</link></item>
</channel></rss>""".encode("utf-8")

SITEMAP_SAMPLE = b"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://www.investhk.gov.hk/en/page-a</loc></url>
<url><loc>https://www.investhk.gov.hk/en/page-b</loc></url>
</urlset>"""

SITEMAPINDEX_SAMPLE = b"""<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>https://www.edb.gov.hk/sitemap-pages.xml</loc></sitemap>
</sitemapindex>"""

LISTING_SAMPLE = (
    b"<html><head><meta charset='utf-8'><title>\xe5\xb1\xb1\xe4\xb8\x9c\xe6\x94\xbf\xe5\x8a\xa1</title></head>"
    b"<body><a href='/col/col1234/index.html'>col</a>"
    b"<a href='https://other.example.com/x'>out</a>"
    b"<a href='javascript:void(0)'>js</a>"
    b"<a href='/art/2026/1.html#frag'>art</a></body></html>"
)

# 鲁港通 - 政务云 CMS（用友 jpaas）栏目页样本：政策文件列表嵌在 <script type="text/xml">
# <datastore> 的 <![CDATA[...]]> 内（实测 kjt/gxt/edu 三厅 col 页，2026-09-10）。HTMLParser
# 视 <script> 为原始文本，默认抽不到里面的 <a href>，导致三厅同步「发现栏目页却 0 文章入库」。
# 结构照搬真实 kjt col103585 页：nextgroup 是 dataproxy.jsp 分页端点，record 才是政策文件。
JPAAS_DATASTORE_SAMPLE = '''<html><head><meta charset="utf-8"><title>山东省科学技术厅</title></head><body>
<div id="764752"><script type="text/xml"><datastore>
<nextgroup><![CDATA[<a href="/module/web/jpage/dataproxy.jsp?page=1&webid=73&columnid=103585&unitid=764752"></a>]]></nextgroup>
<recordset><ul id="information-list"></ul>
<record><![CDATA[
<li><s></s><a class="ellipsis-line-clamp" href="http://kjt.shandong.gov.cn/art/2026/9/4/art_103585_10328790.html" target="_blank">关于印发《山东省自然科学基金绩效评价工作细则（试行）》的通知</a><span class="pull-right">2026-09-04</span></li>]]></record>
<record><![CDATA[
<li><s></s><a class="ellipsis-line-clamp" href="http://kjt.shandong.gov.cn/art/2026/8/21/art_103585_10327410.html" target="_blank">关于印发《关于进一步加强科技类行业协会等社会组织管理工作的若干措施》的通知</a><span class="pull-right">2026-08-21</span></li>]]></record>
</recordset></datastore></script></div>
</body></html>'''.encode("utf-8")

# 鲁港通 - api_json 发现方式样本：海右人社政策通 portalList 实测结构
# {total, rows:[{id, zcmc, ...内嵌全文}], code, msg}；rows 每条直接含政策全文，无需再爬详情页。
API_JSON_SAMPLE = json.dumps({
    "total": 2,
    "rows": [
        {
            "id": "2072156012114726914",
            "zcmc": "博士后人才来济创业启动支持计划",
            "zcLevel": "市级",
            "publishTime": "2026-03-18",
            "applicableObjects": "<p>主要支持处于创办初始阶段，创新能力强、发展潜力大、市场前景好的博士后人才创业企业，重点支持符合济南市标志性产业链发展方向的企业，有海外高新技术产业领域自主创业经验或相关经历者优先考虑。</p>",
            "applyCondition": "<p>1.已注册企业，申报企业注册地、主要办公场所均须设在济南市行政区域内；2.在站及出站博士后人才创业企业均可申报，博士后人才为企业的主要创办人且为第一大股东，股权占比不低于30%；3.企业注册时间原则上不超过3年；4.企业创办以来未发生重大安全、重大质量事故和严重环境违法、科研失信行为。</p>",
            "zczc": "<p>择优确定不超过10家博士后人才创业企业，按照重点、优秀两个类别给予一次性创业支持资金。其中：重点类一次性给予创业支持资金50万元；优秀类一次性给予创业支持资金30万元。资助资金主要用于企业生产经营、研发等相关费用。</p>",
            "phone": "<p>市人才服务中心：0531-51705945</p>",
        },
        {
            "id": "1963872386727608321",
            "zcmc": "泰山学者青年专家",
            "zcLevel": "省级",
            "publishTime": "2025-07-01",
            "applicableObjects": "<p>面向高校、科研院所、新型研发机构、医疗卫生机构、宣传文化单位等，重点支持有较强的科学研究能力和创新潜能，全职在山东工作或引进后全职来山东工作的优秀青年人才。</p>",
            "applyCondition": "<p>1.人选应拥护中国共产党的领导，遵守中华人民共和国法律法规，自觉践行科学家精神，具有良好的道德情操，学风正派，品行端正；2.人选一般应取得博士学位或具有高级专业技术职务，在一线从事教学、科研、临床等工作；3.人选年龄不超过40周岁，女性可放宽至42周岁；4.全职在申报单位工作或引进后全职来申报单位工作。</p>",
            "zczc": "<p>每年选拨1次，每次400名左右。支持期3年内，每年给予入选者25万元综合资助。支持期满后，符合条件的，择优纳入泰山特聘专家项目继续支持。</p>",
        },
    ],
    "code": 200,
    "msg": "查询成功",
}, ensure_ascii=False).encode("utf-8")

# 鲁港通 - 字段映射配置（写入 sources.yaml 的 api_config.parse）
API_PARSE_CFG = {
    "rows_path": "rows",
    "id_field": "id",
    "title_field": "zcmc",
    "url_template": "https://rc.jinan.gov.cn/prod-api/portal/policyInfo/getInfo?id={id}",
    "body_fields": [
        ["政策级别", "zcLevel"],
        ["发布时间", "publishTime"],
        ["适用对象", "applicableObjects"],
        ["申请条件", "applyCondition"],
        ["政策支持", "zczc"],
        ["联系电话", "phone"],
    ],
}

# 鲁港通 - 济南市政府文件库 do-search 实测响应结构（probe-wjk-api.log）：
# {success, code, data:{infoCount, bean:{results:[{infoid,title,issue,publishunit,publishdate,infoLevel,...}]}}}。
# results[] 只有元数据、无正文字段 → 正文靠 stage-2 抓 detail?iid= 详情页（两段式采集）。
JINAN_WJK_SAMPLE = json.dumps({
    "success": True, "code": "200", "message": "查询成功",
    "data": {
        "infoCount": 4819, "pageNum": 1, "pageSize": 100,
        "bean": {"results": [
            {"infoid": "425296cff1094b02a69e01b82e92c051",
             "title": "济南市工业和信息化局关于组织开展济南市工业和信息化领域财政资金股权投资项目申报工作的通知",
             "issue": "济工信函字〔2026〕27号", "publishunit": "济南市工业和信息化局",
             "publishdate": "2026-09-09", "infoLevel": "19", "validity": "0"},
            {"infoid": "9d186c7ab8034382abcd230e054573fb",
             "title": "济南市济阳区人民政府关于修改《济南市济阳区噪声敏感建筑物集中区域划分方案（试行）》的通知",
             "issue": "济阳政字〔2026〕53号", "publishunit": "济南市济阳区人民政府",
             "publishdate": "2026-09-09", "infoLevel": "8", "validity": "0"},
        ]},
    },
}, ensure_ascii=False).encode("utf-8")

# 鲁港通 - 济南两段式解析配置：rows_path 深入 data.bean.results；不配 body_fields（触发详情抓取）。
JINAN_WJK_CFG = {
    "rows_path": "data.bean.results",
    "id_field": "infoid",
    "title_field": "title",
    "url_template": "https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/front/info/detail?iid={id}",
}

# 鲁港通 - js_menu 发现方式样本：照搬 TID 实测菜单结构（probe2，2026-09-12）：
# https://www.tid.gov.hk/js/data/tc_top_menu.js 由多个 `var X = {...}` 组成，
# 节点格式 {"id":["标题","相对路径","","id","N",{子节点}]}，且同一棵栏目树在
# tc_topMenu / menuItems 等变量里重复（布局不同版本，需跨 var 去重）。
JS_MENU_SAMPLE = (
    'var tc_topMenu = {"20":["我們的工作","our_work.html","","20","N",{'
    '"21":["進出口管制及簽證","our_work/import_export_licensing_control/overview.html","","21","N",{'
    '"22":["簽證服務","our_work/import_export_licensing_control/licensing.html","","22","N",{}],'
    '"23":["申請表格","our_work/import_export_licensing_control/forms.pdf","","23","N",{}],'
    '"24":["外連","http://www.gov.hk/en/x.html","","24","N",{}],'
    '"25":["查詢","?page=link&id=3","","25","N",{}]}],'
    '"30":["中小企支援","our_work/support_for_trade_industry/sme.html","","30","N",{}],'
    '"40":["統計資料","statistics/trade_stats.html","","40","N",{}],'
    '"50":["貿易通告","tradecircular/index.html","","50","N",{}]}]};'
    'var menuItems = {"98":["簽證服務","our_work/import_export_licensing_control/licensing.html","","98","N",{}]};'
).encode("utf-8")

JS_MENU_CFG = {
    "base_url": "https://www.tid.gov.hk/tc/",
    "allow_prefixes": [
        "our_work/import_export_licensing_control/",
        "our_work/support_for_trade_industry/",
    ],
}


class TestDiscover:
    def test_parse_rss(self):
        items = parse_rss(RSS_SAMPLE)
        assert len(items) == 2
        assert items[0].url.endswith("/1.html")
        assert items[0].title == "香港新闻一"
        assert items[0].published is not None

    def test_parse_sitemap(self):
        items = parse_sitemap(SITEMAP_SAMPLE, "https://www.investhk.gov.hk/sitemap.xml")
        assert {i.url for i in items} == {
            "https://www.investhk.gov.hk/en/page-a",
            "https://www.investhk.gov.hk/en/page-b",
        }

    def test_parse_sitemapindex(self):
        items = parse_sitemap(SITEMAPINDEX_SAMPLE, "https://www.edb.gov.hk/sitemap.xml")
        assert items[0].url == "https://www.edb.gov.hk/sitemap-pages.xml"

    def test_parse_listing_links_and_dedupe(self):
        items = parse_listing(LISTING_SAMPLE, "http://commerce.shandong.gov.cn/")
        urls = [i.url for i in items]
        assert "http://commerce.shandong.gov.cn/col/col1234/index.html" in urls
        assert "http://commerce.shandong.gov.cn/art/2026/1.html" in urls
        # javascript 链接剔除；外链保留（白名单过滤是 pipeline 职责）
        assert all(not u.startswith("javascript") for u in urls)
        assert "https://other.example.com/x" in urls
        # 鲁港通 - 入口页标题不再传播（实测站点名会让文章标题全部退化）
        assert all(i.title is None for i in items)

    def test_parse_listing_gbk_encoding(self):
        gbk_html = "<html><head><meta charset='gbk'><title>山东</title></head><body><a href='/a'>x</a></body></html>".encode("gbk")
        items = parse_listing(gbk_html, "http://tjj.shandong.gov.cn/")
        # GBK 解码后仍能提取链接（中文 href/文本不乱码）
        assert items[0].url == "http://tjj.shandong.gov.cn/a"

    def test_parse_listing_extracts_article_links_from_jpaas_datastore(self):
        """鲁港通 - 政务云 CMS（用友 jpaas）把政策文件列表嵌在 <script type="text/xml">
        <datastore> 的 CDATA 里，HTMLParser 默认抽不到。实测 kjt/gxt/edu 三厅 col 页政策
        文件全在此结构内，不解析 CDATA 则「发现栏目页却 0 文章入库」。"""
        items = parse_listing(
            JPAAS_DATASTORE_SAMPLE, "http://kjt.shandong.gov.cn/col/col103585/index.html"
        )
        urls = [i.url for i in items]
        assert "http://kjt.shandong.gov.cn/art/2026/9/4/art_103585_10328790.html" in urls
        assert "http://kjt.shandong.gov.cn/art/2026/8/21/art_103585_10327410.html" in urls

    def test_parse_listing_datastore_skips_jpaas_module_endpoints(self):
        """鲁港通 - datastore 的 nextgroup 里是 dataproxy.jsp 分页端点（CMS 内部管线，
        非文档页）；若当候选会被抓取，轻则浪费配额，重则把动态端点误存成“政策文档”。"""
        items = parse_listing(
            JPAAS_DATASTORE_SAMPLE, "http://kjt.shandong.gov.cn/col/col103585/index.html"
        )
        urls = [i.url for i in items]
        assert not any("/module/" in u for u in urls)

    def test_parse_api_json_extracts_embedded_body(self):
        """api_json：列表 rows 直接内嵌全文，解析出 canonical_url + title + body_html。"""
        items = parse_api_json(API_JSON_SAMPLE, API_PARSE_CFG)
        assert len(items) == 2
        first = items[0]
        # canonical_url 用实测真实详情 API + id（唯一/稳定/域名内/返回权威 JSON）
        assert first.url == (
            "https://rc.jinan.gov.cn/prod-api/portal/policyInfo/getInfo?id=2072156012114726914"
        )
        assert first.title == "博士后人才来济创业启动支持计划"
        # 内嵌正文：字段按中文标签拼成 HTML，供 pipeline 直接入库（跳过详情页抓取）
        assert first.body_html is not None
        assert "博士后人才来济创业启动支持计划" in first.body_html
        assert "重点类一次性给予创业支持资金50万元" in first.body_html
        assert "适用对象" in first.body_html

    def test_parse_api_json_skips_id_less_rows_and_bad_payload(self):
        """无 id 的行跳过（无法构造稳定 canonical_url）；非法 JSON/缺 rows 返回空不抛。"""
        payload = json.dumps(
            {"rows": [{"zcmc": "无 id"}, {"id": "9", "zcmc": "有 id"}]}, ensure_ascii=False
        ).encode("utf-8")
        items = parse_api_json(payload, API_PARSE_CFG)
        assert len(items) == 1 and items[0].title == "有 id"
        # 政府接口偶发返回 500 HTML 或空结果：解析失败按 0 条处理，绝不抛异常中断同步
        assert parse_api_json(b"<html>500 Internal Server Error</html>", API_PARSE_CFG) == []
        assert parse_api_json(json.dumps({"total": 0}).encode(), API_PARSE_CFG) == []

    def test_parse_api_json_without_body_fields_leaves_body_none(self):
        """鲁港通 - 两段式采集：列表接口只给元数据、无内嵌全文时（济南市政府文件库
        do-search 的 results[] 无正文字段），不配 body_fields → body_html 必须为 None，
        以触发 pipeline 二次抓取详情页（detail?iid= + content_selector 提正文）。
        现状 _compose_body_html 总返回至少 <h1>title</h1>，会让两段式误判为“已内嵌全文”
        而跳过详情抓取，导致入库正文只剩一个标题。"""
        items = parse_api_json(JINAN_WJK_SAMPLE, JINAN_WJK_CFG)
        assert len(items) == 2
        # 嵌套 rows_path（data.bean.results）正确解析；canonical_url 指向实测详情端点
        assert items[0].url == (
            "https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/"
            "front/info/detail?iid=425296cff1094b02a69e01b82e92c051"
        )
        assert items[0].title.startswith("济南市工业和信息化局")
        # 关键：无 body_fields → body_html=None（而非 <h1>标题</h1>），交给 stage-2 抓详情页
        assert items[0].body_html is None
        assert items[1].body_html is None

    def test_parse_js_menu_extracts_allowlisted_pages(self):
        """js_menu：TID 栏目树在静态 .js 菜单文件里（栏目页是 JS 空壳抓不到链接），
        只取政策栏目白名单下的文章页，排除通告/统计/站务栏目。"""
        items = parse_js_menu(JS_MENU_SAMPLE, JS_MENU_CFG)
        assert [i.url for i in items] == [
            "https://www.tid.gov.hk/tc/our_work/import_export_licensing_control/overview.html",
            "https://www.tid.gov.hk/tc/our_work/import_export_licensing_control/licensing.html",
            "https://www.tid.gov.hk/tc/our_work/support_for_trade_industry/sme.html",
        ]
        # 菜单标题是栏目名不是文章标题 → 不带 title（由 extract 从文章页提取）
        assert all(i.title is None for i in items)

    def test_parse_js_menu_skips_non_html_external_and_duplicates(self):
        """PDF/站外链接/查询串跳转不产生候选；跨 var 重复路径按 URL 去重。"""
        items = parse_js_menu(JS_MENU_SAMPLE, JS_MENU_CFG)
        urls = [i.url for i in items]
        assert not any(u.endswith(".pdf") for u in urls)
        assert not any("www.gov.hk" in u for u in urls)   # 站外绝对链接
        assert not any("?" in u for u in urls)
        # licensing.html 在 tc_topMenu 与 menuItems 两个 var 里重复出现 → 只保留一条
        assert urls.count(
            "https://www.tid.gov.hk/tc/our_work/import_export_licensing_control/licensing.html"
        ) == 1

    def test_parse_js_menu_malformed_returns_empty(self):
        """菜单文件 404 错误页/截断 JSON → 空列表，绝不抛异常（发现层纪律）。"""
        assert parse_js_menu(b"", JS_MENU_CFG) == []
        assert parse_js_menu(b"<html><body>404 Not Found</body></html>", JS_MENU_CFG) == []
        assert parse_js_menu(b'var x = {"1":["a","b.html"', JS_MENU_CFG) == []

    def test_parse_js_menu_excludes_prefixes(self):
        """exclude_prefixes：白名单栏目内仍要排除的子目录（实测 TID 的陈旧链接页与宣传物料）。"""
        cfg = {**JS_MENU_CFG, "exclude_prefixes": ["our_work/support_for_trade_industry/"]}
        urls = [i.url for i in parse_js_menu(JS_MENU_SAMPLE, cfg)]
        assert urls == [
            "https://www.tid.gov.hk/tc/our_work/import_export_licensing_control/overview.html",
            "https://www.tid.gov.hk/tc/our_work/import_export_licensing_control/licensing.html",
        ]

    def test_parse_js_menu_excludes_substrings(self):
        """exclude_substrings：按文件名片段排除链接集合页（实测 TID：「相關網址/有用連結」等
        reference_links/useful_links 页是纯外链导航，散布在多个栏目目录下，无公共前缀）。"""
        sample = (
            'var m = {"1":["貿易關係","our_work/trade_relations/overview.html","","1","N",{'
            '"2":["相關網址","our_work/trade_relations/americas/us/us_reference_links.html","","2","N",{}],'
            '"3":["有用連結","our_work/trade_relations/asean/useful_links.html","","3","N",{}]}],'
            '"9":["其他","our_work/trade_and_investment_agreements/ftas/chile/useful_links.html","","9","N",{}]};'
        ).encode("utf-8")
        cfg = {
            "base_url": "https://www.tid.gov.hk/tc/",
            "allow_prefixes": [
                "our_work/trade_relations/",
                "our_work/trade_and_investment_agreements/",
            ],
            "exclude_substrings": ["reference_links.html", "useful_links.html"],
        }
        urls = [i.url for i in parse_js_menu(sample, cfg)]
        assert urls == ["https://www.tid.gov.hk/tc/our_work/trade_relations/overview.html"]


# ---------------------------------------------------------------------------
# 内容提取
# ---------------------------------------------------------------------------

class TestExtract:
    def test_extract_html_title_and_text(self):
        html = (
            b"<html><head><title>Test Page</title></head><body>"
            b"<script>var x=1;</script><style>.a{}</style>"
            b"<p>Hello paragraph</p><div>Second line</div></body></html>"
        )
        out = extract_html(html)
        assert out.title == "Test Page"
        assert "Hello paragraph" in out.text
        assert "Second line" in out.text
        assert "var x=1" not in out.text   # script 剔除
        assert out.language_hint == "en"

    def test_extract_html_lang_hint(self):
        html = "<html><head><title>香港特別行政區政府</title></head><body><p>政府新聞公報</p></body></html>".encode()
        out = extract_html(html)
        assert out.language_hint == "zh-Hant"

    def test_extract_html_strips_configured_title_prefix(self):
        """TID 实测：<title> 全站统一「工業貿易署 - 」繁体前缀，而 org 是简体名匹配不上，
        故用 title_strip_prefixes 显式剥离，避免每篇标题都带冗余站点名。"""
        html = (
            "<html><head><title>工業貿易署 - 取消許可證</title></head><body>"
            "<p>工業貿易署宣布取消許可證安排即日生效，業界可向該署查詢詳情。</p></body></html>"
        ).encode("utf-8")
        out = extract_html(html, title_strip_prefixes=["工業貿易署 - "])
        assert out.title == "取消許可證"


# ---------------------------------------------------------------------------
# pipeline 全流程（假 fetcher）
# ---------------------------------------------------------------------------

# 鲁港通 - pipeline 有 MIN_CONTENT_CHARS 正文门槛（实测栏目页 28~59 字、文章页 900+ 字），
# 测试样本必须模拟真实文章长度，否则会被噪声页过滤挡掉。
_LONG_EN = (
    "The Government announced today that the Belt and Road Summit concluded successfully. "
    "Over fifty delegations attended the two-day event to discuss infrastructure investment, "
    "financial cooperation and professional services. The Chief Executive highlighted that "
    "Hong Kong enjoys unique advantages under the one country, two systems framework, including "
    "a common law legal system, free flow of capital and information, and a deep pool of "
    "international talent. She emphasised that continued national support is the strongest "
    "backing for the long-term prosperity and stability of the city."
)
_LONG_ZH = (
    "省商务厅今日发布通知，为深入推进鲁港经贸合作，进一步扩大双向投资规模，现就有关事项"
    "通知如下。一、加强产业对接，聚焦高端装备、现代海洋、医养健康等重点领域，组织企业赴港"
    "开展精准对接活动。二、优化营商环境，落实外商投资准入前国民待遇加负面清单管理制度，"
    "依法保护投资者合法权益。三、强化服务保障，建立重点外资项目服务专员制度，及时协调解决"
    "项目落地过程中的困难和问题。四、各地商务主管部门要切实履行职责，加强组织领导，确保各项"
    "措施落到实处，推动全省商务工作高质量发展。"
)


def _article_html(title: str, body: str) -> bytes:
    """构造一篇达标的测试文章页（正文长度超过噪声页门槛）。"""
    return (
        f"<html><head><title>{title}</title></head><body><p>{body}</p></body></html>"
    ).encode("utf-8")


def _mk_settings(**kw) -> Settings:
    return Settings(api_key_fastgpt="x", source_min_interval_s=0, **kw)


# 鲁港通 - 测试用假 DNS：白名单域名一律解析到公网 IP，不碰真实网络
_FAKE_IPS = {"www.news.gov.hk": "203.198.135.1", "commerce.shandong.gov.cn": "218.98.19.1"}


def fake_resolver(hostname: str) -> tuple[str, ...]:
    return (_FAKE_IPS.get(hostname, "203.198.135.1"),)


def _mk_fetch_result(url: str, body: bytes, content_type: str = "text/html") -> FetchResult:
    return FetchResult(
        final_url=url, http_status=200, content_type=content_type, content=body
    )


class _FakeFetcher:
    """按 URL 返回预置响应；未预置的 URL 抛网络异常。记录每次调用的 URL 与 method。"""

    def __init__(self, responses: dict[str, bytes]):
        self.responses = responses
        self.calls: list[str] = []
        self.methods: list[str] = []

    def __call__(self, url, rules, settings, method="GET"):
        self.calls.append(url)
        self.methods.append(method)
        if url in self.responses:
            return _mk_fetch_result(url, self.responses[url])
        raise ConnectionError(f"no route to {url}")


class TestPipeline:
    def _setup_source(self, db, code="hk_news_test"):
        import_sources_yaml(MINI_YAML, db)
        return db.execute(select(Source).where(Source.code == code)).scalar_one()

    def test_rss_sync_full_flow(self, db):
        src = self._setup_source(db)
        article = _article_html("HK News A", _LONG_EN)
        fetcher = _FakeFetcher({
            "https://www.news.gov.hk/en/common/html/topstories.rss.xml": RSS_SAMPLE,
            "https://www.news.gov.hk/en/2026/09/1.html": article,
            "https://www.news.gov.hk/en/2026/09/2.html": article,
        })

        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)

        # 发现 2 条 → 白名单校验通过 → 全部入库
        assert stats.discovered == 2
        assert stats.new_docs == 2
        assert stats.rejected == 0

        docs = db.execute(select(Document)).scalars().all()
        assert len(docs) == 2
        assert all(d.status == "candidate" for d in docs)
        versions = db.execute(select(DocumentVersion)).scalars().all()
        assert len(versions) == 2
        assert versions[0].extracted_text and "Belt and Road Summit" in versions[0].extracted_text

        run = db.execute(select(CrawlRun)).scalar_one()
        assert run.status == "finished"
        assert run.new_docs == 2

        tasks = db.execute(select(CrawlTask)).scalars().all()
        assert all(t.status == "new" for t in tasks)

    def test_second_sync_unchanged(self, db):
        src = self._setup_source(db)
        article = _article_html("HK News A", _LONG_EN)
        fetcher = _FakeFetcher({
            "https://www.news.gov.hk/en/common/html/topstories.rss.xml": RSS_SAMPLE,
            "https://www.news.gov.hk/en/2026/09/1.html": article,
            "https://www.news.gov.hk/en/2026/09/2.html": article,
        })
        sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                    sleeper=lambda s: None, resolver=fake_resolver)

        # 第二次同步（默认不 force）：已知文档直接跳过，不重抓
        stats2 = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                             sleeper=lambda s: None, resolver=fake_resolver)
        assert stats2.already_known == 2
        assert stats2.new_docs == 0

        # force 重抓：内容未变 → unchanged，不建新版本
        stats3 = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                             sleeper=lambda s: None, resolver=fake_resolver, force_refetch=True)
        assert stats3.unchanged_docs == 2
        assert db.execute(select(DocumentVersion)).scalars().all().__len__() == 2

    def test_content_change_creates_new_version(self, db):
        src = self._setup_source(db)
        v1 = _article_html("A", _LONG_EN)
        fetcher = _FakeFetcher({
            "https://www.news.gov.hk/en/common/html/topstories.rss.xml": RSS_SAMPLE,
            "https://www.news.gov.hk/en/2026/09/1.html": v1,
            "https://www.news.gov.hk/en/2026/09/2.html": v1,
        })
        sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                    sleeper=lambda s: None, resolver=fake_resolver)

        v2 = _article_html("A", _LONG_EN + " Updated paragraph appended.")
        fetcher.responses["https://www.news.gov.hk/en/2026/09/1.html"] = v2
        stats2 = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                             sleeper=lambda s: None, resolver=fake_resolver, force_refetch=True)

        assert stats2.updated_docs == 1
        assert stats2.unchanged_docs == 1
        assert db.execute(select(DocumentVersion)).scalars().all().__len__() == 3

        doc = db.execute(
            select(Document).where(Document.canonical_url.endswith("1.html"))
        ).scalar_one()
        # latest_version_id 指向新版本，旧版本 is_current=False
        current = db.execute(
            select(DocumentVersion).where(DocumentVersion.id == doc.latest_version_id)
        ).scalar_one()
        assert "Updated paragraph appended" in current.extracted_text

    def test_non_allowlist_url_rejected_in_pipeline(self, db):
        # RSS 条目里混入白名单外链接 → pipeline 记 rejected，不抓取
        mixed_rss = RSS_SAMPLE.replace(
            b"https://www.news.gov.hk/en/2026/09/2.html",
            b"https://evil.example.com/steal",
        )
        src = self._setup_source(db)
        article = _article_html("ok", _LONG_EN)
        fetcher = _FakeFetcher({
            "https://www.news.gov.hk/en/common/html/topstories.rss.xml": mixed_rss,
            "https://www.news.gov.hk/en/2026/09/1.html": article,
        })
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)
        assert stats.rejected == 1
        assert stats.new_docs == 1
        assert "https://evil.example.com/steal" not in fetcher.calls

        rejected_task = db.execute(
            select(CrawlTask).where(CrawlTask.reject_reason.isnot(None))
        ).scalar_one()
        assert rejected_task.reject_reason == "NOT_IN_ALLOWLIST"

    def test_http_allowed_for_shandong_source(self, db):
        # 山东来源 allow_http=True：http URL 校验通过并可抓取
        src = self._setup_source(db, code="sd_test")
        listing = (
            "<html><head><meta charset='utf-8'><title>商务厅</title></head>"
            "<body><a href='/art/2026/policy.html'>p</a></body></html>"
        ).encode("utf-8")
        # 鲁港通 - 实测山东政务站 <title> 格式：站点名 + 栏目名 + 文章标题
        article = _article_html("山东省商务厅 商务要闻 关于商务厅设立驻港办事处的通知", _LONG_ZH)
        fetcher = _FakeFetcher({
            "http://commerce.shandong.gov.cn/": listing,
            "http://commerce.shandong.gov.cn/art/2026/policy.html": article,
        })
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)
        assert stats.new_docs == 1
        doc = db.execute(select(Document)).scalar_one()
        assert doc.language == "zh-Hans"
        # 标题清洗：去掉站点名与栏目名前缀，保留真实文章标题
        assert doc.title == "关于商务厅设立驻港办事处的通知"

    def test_fetch_failure_retried_then_recorded(self, db):
        src = self._setup_source(db)
        fetcher = _FakeFetcher({
            "https://www.news.gov.hk/en/common/html/topstories.rss.xml": RSS_SAMPLE,
        })
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)
        # 详情页不可达：重试 2 次后记 failed；run 正常 finished
        assert stats.fetch_failed == 2
        assert stats.discovered == 2
        run = db.execute(select(CrawlRun)).scalar_one()
        assert run.status == "finished"
        # 每个失败 URL 调用 3 次（初次+2 重试）
        assert fetcher.calls.count("https://www.news.gov.hk/en/2026/09/1.html") == 3

    # ------------------------------------------------------------------
    # 鲁港通 - 噪声页过滤（服务器首轮采集实测发现的两类污染）
    # ------------------------------------------------------------------

    def test_entry_page_itself_skipped(self, db):
        """列表页里指向自身的链接（首页导航常见）不得当文档入库。"""
        src = self._setup_source(db, code="sd_test")
        listing = (
            "<html><head><meta charset='utf-8'><title>山东省商务厅</title></head><body>"
            "<a href='http://commerce.shandong.gov.cn/'>首页</a>"
            "<a href='/art/2026/a.html'>文章</a></body></html>"
        ).encode("utf-8")
        fetcher = _FakeFetcher({
            "http://commerce.shandong.gov.cn/": listing,
            "http://commerce.shandong.gov.cn/art/2026/a.html": _article_html(
                "山东省商务厅 商务要闻 省商务厅召开创建全国文明单位工作推进会", _LONG_ZH
            ),
        })
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)
        assert stats.new_docs == 1      # 只有文章页入库
        tasks = {t.url: t.status for t in db.execute(select(CrawlTask)).scalars()}
        assert tasks["http://commerce.shandong.gov.cn/"] == "skipped_entry"

    def test_listing_page_filtered_by_shape_before_fetch(self, db):
        """栏目/分页页按 URL 形态在抓取前挡掉。

        鲁港通 - 实测取证（diag-colpages.log）：山东政务云栏目页的正文容器里是链接
        标题堆叠，282~1930 字，足以越过 MIN_CONTENT_CHARS 入库（sd_czt 首轮 9 篇混进
        5 篇），故只能靠形态过滤；本例故意把栏目页正文做得很长，证明拦下它的不是字数门槛。
        """
        src = self._setup_source(db, code="sd_test")
        listing = (
            "<html><body><a href='/col/col1234/index.html'>通知公告</a>"
            "<a href='/col/col1234/index_1.html'>下一页</a>"
            "<a href='/art/2026/a.html'>文章</a></body></html>"
        ).encode("utf-8")
        col_page = _article_html("山东省商务厅 通知公告", _LONG_ZH * 3)   # 正文远超门槛
        fetcher = _FakeFetcher({
            "http://commerce.shandong.gov.cn/": listing,
            "http://commerce.shandong.gov.cn/col/col1234/index.html": col_page,
            "http://commerce.shandong.gov.cn/col/col1234/index_1.html": col_page,
            "http://commerce.shandong.gov.cn/art/2026/a.html": _article_html(
                "山东省商务厅 商务要闻 全省商务工作会议在济南召开", _LONG_ZH
            ),
        })
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)
        assert stats.new_docs == 1
        assert stats.skipped_non_article == 2
        tasks = {t.url: t.status for t in db.execute(select(CrawlTask)).scalars()}
        assert tasks["http://commerce.shandong.gov.cn/col/col1234/index.html"] == "skipped_non_article"
        assert tasks["http://commerce.shandong.gov.cn/col/col1234/index_1.html"] == "skipped_non_article"
        # 栏目页连抓取都不应发生：既省配额也省请求
        assert not any("/col/" in u for u in fetcher.calls)
        assert db.execute(
            select(Document).where(Document.canonical_url.like("%/col/%"))
        ).scalar_one_or_none() is None

    def test_fixed_url_source_exempt_from_shape_filter(self, db):
        """fixed_url 的入口就是目标文档：即使形态像列表页也绝不过滤。"""
        src = self._setup_source(db, code="sd_test")
        src.discovery_method = "fixed_url"
        src.discovery_config = {
            "fixed_urls": ["http://commerce.shandong.gov.cn/col/col1234/index.html"]
        }
        db.commit()
        fetcher = _FakeFetcher({
            "http://commerce.shandong.gov.cn/col/col1234/index.html": _article_html(
                "山东省商务厅 施政报告全文", _LONG_ZH
            ),
        })
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)
        assert stats.skipped_non_article == 0
        assert stats.new_docs == 1

    def test_limit_reached_stops_creating_tasks(self, db):
        """达到单轮上限后立即结束，不再为剩余候选逐条建 crawl_task。

        鲁港通 - 实测 hk_investhk 的 sitemap 有 4787 条 URL，采满 100 篇上限后仍逐条
        建了 4600+ 行 skipped_limit 并逐行 commit，白耗十几分钟且全程占着全局同步锁。
        """
        src = self._setup_source(db, code="sd_test")
        src.max_pages_per_run = 1
        db.commit()
        listing = (
            "<html><body>"
            + "".join(f"<a href='/art/2026/{i}.html'>a{i}</a>" for i in range(6))
            + "</body></html>"
        ).encode("utf-8")
        responses = {"http://commerce.shandong.gov.cn/": listing}
        for i in range(6):
            responses[f"http://commerce.shandong.gov.cn/art/2026/{i}.html"] = _article_html(
                "山东省商务厅 商务要闻 测试文章", _LONG_ZH
            )
        fetcher = _FakeFetcher(responses)
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)
        assert stats.discovered == 6
        assert stats.new_docs == 1
        assert stats.skipped_limit == 5                       # 剩余只计数
        assert len(db.execute(select(CrawlTask)).scalars().all()) == 1   # 不建行

    def test_low_content_page_not_stored(self, db):
        """正文不足门槛的页面不建 document（实测港府跳转页仅 17 字）。"""
        src = self._setup_source(db, code="sd_test")
        listing = (
            "<html><body><a href='/zwgk/redirect.html'>跳转</a>"
            "<a href='/art/2026/a.html'>文章</a></body></html>"
        ).encode("utf-8")
        thin_page = (
            "<html><head><title>山东省商务厅</title></head><body>"
            "<div>政府信息 公开指南 政府信息 公开制度 法定主动 公开内容</div></body></html>"
        ).encode("utf-8")
        assert len("政府信息 公开指南 政府信息 公开制度 法定主动 公开内容") < MIN_CONTENT_CHARS
        fetcher = _FakeFetcher({
            "http://commerce.shandong.gov.cn/": listing,
            "http://commerce.shandong.gov.cn/zwgk/redirect.html": thin_page,
            "http://commerce.shandong.gov.cn/art/2026/a.html": _article_html(
                "山东省商务厅 商务要闻 全省商务工作会议在济南召开", _LONG_ZH
            ),
        })
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)
        assert stats.new_docs == 1
        tasks = {t.url: t.status for t in db.execute(select(CrawlTask)).scalars()}
        assert tasks["http://commerce.shandong.gov.cn/zwgk/redirect.html"] == "skipped_low_content"


# ---------------------------------------------------------------------------
# 鲁港通 - api_json 发现方式（海右人社政策通：政务 JSON 接口列表项内嵌全文）
# ---------------------------------------------------------------------------

RC_YAML = """
sources:
  - id: rc_test
    name: 海右人社政策通测试
    group: sd_business_talent
    organization: 海右人社政策通
    base_domains: [rc.jinan.gov.cn]
    allowed_path_prefixes: [/]
    discovery_method: api_json
    api_config:
      endpoints:
        - "https://rc.jinan.gov.cn/prod-api/portal/policyInfo/portalList?zcsylx=1&pageNum=1&pageSize=300"
      parse:
        rows_path: rows
        id_field: id
        title_field: zcmc
        url_template: "https://rc.jinan.gov.cn/prod-api/portal/policyInfo/getInfo?id={id}"
        body_fields:
          - [政策级别, zcLevel]
          - [适用对象, applicableObjects]
          - [申请条件, applyCondition]
          - [政策支持, zczc]
          - [联系电话, phone]
    rate_limit_per_minute: 6
    max_pages_per_run: 400
    enabled: true
"""

_RC_LIST_URL = ("https://rc.jinan.gov.cn/prod-api/portal/policyInfo/"
                "portalList?zcsylx=1&pageNum=1&pageSize=300")


class TestPipelineApiJson:
    """api_json：列表接口内嵌全文直接入库，绝不爬详情页（getInfo 仅作 canonical_url）。"""

    def _setup_source(self, db):
        import_sources_yaml(RC_YAML, db)
        return db.execute(select(Source).where(Source.code == "rc_test")).scalar_one()

    def test_embedded_body_ingested_without_fetching_detail(self, db):
        src = self._setup_source(db)
        # 只预置列表端点；详情页 getInfo 故意不预置——若 pipeline 去抓它会抛 ConnectionError
        fetcher = _FakeFetcher({_RC_LIST_URL: API_JSON_SAMPLE})

        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)

        assert stats.discovered == 2
        assert stats.new_docs == 2
        docs = db.execute(select(Document)).scalars().all()
        assert len(docs) == 2
        # canonical_url = 实测真实详情 API + id
        urls = {d.canonical_url for d in docs}
        assert ("https://rc.jinan.gov.cn/prod-api/portal/policyInfo/"
                "getInfo?id=2072156012114726914") in urls
        # 标题来自 zcmc；正文来自内嵌字段（extract_html 清洗后含支持标准原文）
        titles = {d.title for d in docs}
        assert "博士后人才来济创业启动支持计划" in titles
        ver = db.execute(select(DocumentVersion)).scalars().first()
        assert ver.extracted_text and "重点类一次性给予创业支持资金50万元" in ver.extracted_text
        # 决定性断言：只抓了列表端点，没抓任何详情页
        assert fetcher.calls == [_RC_LIST_URL]

    def test_second_sync_unchanged_by_content_sha(self, db):
        src = self._setup_source(db)
        fetcher = _FakeFetcher({_RC_LIST_URL: API_JSON_SAMPLE})
        sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                    sleeper=lambda s: None, resolver=fake_resolver)
        # force 重抓：内嵌正文 sha 未变 → unchanged，不建新版本
        stats2 = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                             sleeper=lambda s: None, resolver=fake_resolver, force_refetch=True)
        assert stats2.unchanged_docs == 2
        assert stats2.new_docs == 0
        assert db.execute(select(DocumentVersion)).scalars().all().__len__() == 2

    def test_embedded_body_skips_per_item_rate_limit_sleep(self, db):
        """鲁港通 - 回归：api_json 内嵌全文候选不发任何详情页请求，逐条限速 sleep
        纯属浪费。实测 jinan_rc 首轮 source_min_interval_s=10 × 311 条 ≈ 52 分钟，
        且全程占着全局同步锁阻塞其他来源（首轮 120s 仅入库 17 篇）。内嵌项须跳过 sleep。"""
        src = self._setup_source(db)
        fetcher = _FakeFetcher({_RC_LIST_URL: API_JSON_SAMPLE})
        sleeps: list = []
        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=sleeps.append, resolver=fake_resolver)
        assert stats.new_docs == 2
        # 2 条内嵌全文候选均未发起网络请求 → 不应触发任何逐条限速 sleep
        assert sleeps == []


# ---------------------------------------------------------------------------
# 鲁港通 - api_json 分页发现 + POST + 两段式（济南市政府文件库 do-search 实测形态）
# ---------------------------------------------------------------------------

JINAN_YAML = """
sources:
  - id: jinan_gov_test
    name: 济南市政府文件库测试
    group: sd_core_gov
    organization: 济南市人民政府
    base_domains: [www.jinan.gov.cn]
    allowed_path_prefixes: [/api-gateway/]
    discovery_method: api_json
    api_config:
      method: POST
      endpoints:
        - "https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/front/info/do-search?level=0&pageSize=2&pageNo={pageNo}"
      paginate:
        page_param: pageNo
        start: 1
        max_pages: 5
      parse:
        rows_path: data.bean.results
        id_field: infoid
        title_field: title
        url_template: "https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/front/info/detail?iid={id}"
    content_selector: ".main_content"
    rate_limit_per_minute: 60
    max_pages_per_run: 10
    enabled: true
"""

_DOSEARCH = ("https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/"
             "front/info/do-search?level=0&pageSize=2&pageNo=")
_DETAIL = ("https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/"
           "front/info/detail?iid=")


def _wjk_page(rows) -> bytes:
    """构造 do-search 一页响应（data.bean.results）；rows=[(infoid,title),...]。"""
    return json.dumps({
        "success": True, "code": "200",
        "data": {"infoCount": 4, "pageNum": 1, "pageSize": 2,
                 "bean": {"results": [
                     {"infoid": iid, "title": t, "publishunit": "济南市人民政府",
                      "publishdate": "2026-09-09", "infoLevel": "-1", "validity": "0"}
                     for iid, t in rows]}},
    }, ensure_ascii=False).encode("utf-8")


def _wjk_empty() -> bytes:
    """空页（results=[]）：分页循环应据此停止翻页。"""
    return json.dumps({"success": True, "code": "200",
                       "data": {"infoCount": 4, "bean": {"results": []}}},
                      ensure_ascii=False).encode("utf-8")


def _detail_html(title: str) -> bytes:
    """构造 detail 详情全文页（实测形态：正文在 .main_content 容器内）。"""
    return (
        f'<html><head><title>{title}</title></head><body>'
        f'<div class="content clearfix"><div class="content-left">'
        f'<div class="main_content"><p>{title}</p><p>{_LONG_ZH}</p></div>'
        f'</div></div></body></html>'
    ).encode("utf-8")


class TestPipelineApiJsonPagination:
    """api_json 分页：{pageNo} 模板逐页 POST 拉取，空页停止；候选 body_html=None → 两段式抓详情。"""

    def _setup_source(self, db):
        import_sources_yaml(JINAN_YAML, db)
        return db.execute(select(Source).where(Source.code == "jinan_gov_test")).scalar_one()

    def test_paginates_post_and_two_stage_fetch(self, db):
        src = self._setup_source(db)
        fetcher = _FakeFetcher({
            _DOSEARCH + "1": _wjk_page([("aaa", "济南市人民政府关于印发A的通知"),
                                        ("bbb", "济南市人民政府关于印发B的通知")]),
            _DOSEARCH + "2": _wjk_page([("ccc", "济南市人民政府关于印发C的通知"),
                                        ("ddd", "济南市人民政府关于印发D的通知")]),
            _DOSEARCH + "3": _wjk_empty(),   # 空页 → 停止翻页
            _DETAIL + "aaa": _detail_html("A"),
            _DETAIL + "bbb": _detail_html("B"),
            _DETAIL + "ccc": _detail_html("C"),
            _DETAIL + "ddd": _detail_html("D"),
        })

        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)

        # 分页发现：pageNo=1,2,3（第 3 页空 → 停），且全部走 POST
        do_search = [(u, m) for u, m in zip(fetcher.calls, fetcher.methods) if "do-search" in u]
        assert [u for u, _ in do_search] == [_DOSEARCH + "1", _DOSEARCH + "2", _DOSEARCH + "3"]
        assert all(m == "POST" for _, m in do_search)
        # 两段式：4 条候选（body_html=None）各抓一次 detail（GET）
        assert stats.discovered == 4
        details = [(u, m) for u, m in zip(fetcher.calls, fetcher.methods) if "/detail?iid=" in u]
        assert [u for u, _ in details] == [_DETAIL + x for x in ("aaa", "bbb", "ccc", "ddd")]
        assert all(m == "GET" for _, m in details)
        # 入库 4 篇；正文来自 .main_content 容器（含 _LONG_ZH）
        assert stats.new_docs == 4
        ver = db.execute(select(DocumentVersion)).scalars().first()
        assert ver.extracted_text and "省商务厅今日发布通知" in ver.extracted_text
        # 标题来自列表接口 title 字段（权威全称）
        titles = {d.title for d in db.execute(select(Document)).scalars().all()}
        assert "济南市人民政府关于印发A的通知" in titles


# ---------------------------------------------------------------------------
# 鲁港通 - js_menu 发现方式（TID：栏目页 JS 空壳 → 静态菜单文件发现文章页）
# ---------------------------------------------------------------------------

TID_YAML = """
sources:
  - id: hk_tid_test
    name: 工业贸易署测试
    group: hk_economy_innovation
    organization: 香港工业贸易署
    base_domains: [www.tid.gov.hk]
    allowed_path_prefixes: [/tc/, /js/data/]
    discovery_method: js_menu
    js_menu_config:
      menu_urls:
        - https://www.tid.gov.hk/js/data/tc_top_menu.js
      base_url: https://www.tid.gov.hk/tc/
      allow_prefixes:
        - our_work/import_export_licensing_control/
        - our_work/support_for_trade_industry/
      exclude_prefixes:
        - our_work/support_for_trade_industry/
    content_selector: ".contentArea"
    title_strip_prefixes:
      - "工業貿易署 - "
    rate_limit_per_minute: 6
    max_pages_per_run: 50
    enabled: true
"""


def _tid_article_html(title: str) -> bytes:
    """TID 文章页形态：正文在 .contentArea（probe2 实测），容器外是导航/页脚噪声。"""
    return (
        f'<html><head><meta charset="utf-8"><title>{title}</title></head><body>'
        f'<div class="header">主頁 我們的工作 貿易通告 統計資料</div>'
        f'<div class="contentArea"><p>{_LONG_ZH}</p></div>'
        f'<div class="footer">版權所有 工業貿易署</div></body></html>'
    ).encode("utf-8")


class TestPipelineJsMenu:
    """js_menu：从静态菜单文件发现文章页；非政策栏目（統計/通告）绝不进候选。"""

    def _setup_source(self, db):
        import_sources_yaml(TID_YAML, db)
        return db.execute(select(Source).where(Source.code == "hk_tid_test")).scalar_one()

    def test_menu_discovery_ingests_only_allowlisted_pages(self, db):
        src = self._setup_source(db)
        # TID 实测文章页 <title> 全站带繁体站点名前缀「工業貿易署 - 」→ title_strip_prefixes 清洗
        article = _tid_article_html("工業貿易署 - 進出口簽證服務安排")
        base = "https://www.tid.gov.hk/tc/"
        fetcher = _FakeFetcher({
            "https://www.tid.gov.hk/js/data/tc_top_menu.js": JS_MENU_SAMPLE,
            base + "our_work/import_export_licensing_control/overview.html": article,
            base + "our_work/import_export_licensing_control/licensing.html": article,
        })

        stats = sync_source(db, src, settings=_mk_settings(), fetcher=fetcher,
                            sleeper=lambda s: None, resolver=fake_resolver)

        # 白名单内 2 条进候选；support_for_trade_industry 被 exclude_prefixes 排除（等价实测
        # trade_relations/mainland/mainland_link 陈旧 404 页与 cepa/promotional_materials 宣传页）
        assert stats.discovered == 2
        assert stats.new_docs == 2
        assert stats.fetch_failed == 0
        # 决定性断言：菜单文件之外只请求了白名单政策页；統計/通告/站外一个都没抓
        assert fetcher.calls[0] == "https://www.tid.gov.hk/js/data/tc_top_menu.js"
        assert all(("/tc/our_work/" in u) or ("/js/data/" in u) for u in fetcher.calls)
        # 标题来自文章页（繁体前缀已清洗）；正文提取走 .contentArea 容器（导航/页脚噪声被剔除）
        titles = {d.title for d in db.execute(select(Document)).scalars().all()}
        assert titles == {"進出口簽證服務安排"}
        ver = db.execute(select(DocumentVersion)).scalars().first()
        assert ver.extracted_text and "版權所有" not in ver.extracted_text


# ---------------------------------------------------------------------------
# 鲁港通 - 栏目/列表页形态判定（实测取证 diag-colpages.log 的真实 URL）
# ---------------------------------------------------------------------------

class TestIsListingPage:
    """黑名单式判定：宁可放过也不可误杀港府形态各异的文档页。"""

    @pytest.mark.parametrize("url", [
        "http://czt.shandong.gov.cn/col/col190914/index.html",   # 实测 sd_czt 栏目页
        "https://www.jinan.gov.cn/col/col2608/index.html",       # 实测 jinan_gov 入口
        "http://edu.shandong.gov.cn/col/col1234/index_1.html",   # 栏目翻页
        "http://edu.shandong.gov.cn/col/col1234/",               # 无 index.html
        "http://kjt.shandong.gov.cn/index.html",                 # 站点首页
        "https://www.wfsfaa.gov.hk/en/index.htm",                # .htm 变体
    ])
    def test_listing_pages_matched(self, url):
        assert is_listing_page(url) is True

    @pytest.mark.parametrize("url", [
        # 实测山东文章页
        "http://czt.shandong.gov.cn/art/2026/8/25/art_10579_10332325.html",
        # 实测济南市系文章页嵌在栏目路径下（probe-cols.log 2026-09-09）：形态是
        # /col/colNNNNN/art/YYYY/art_<uuid>.html，若正则把「在 /col/ 下」单独当作
        # 列表页判据，jinan_gov/jinan_hrss 两个来源将一篇也采不到。
        "https://jnhrss.jinan.gov.cn/col/col18309/art/2026/art_60aea50238d24db9b9b08617192979a0.html",
        "https://jnhrss.jinan.gov.cn/col/col39924/art/2026/art_855123c70a5c4d419d7c246c48cd77ca.html",
        # 实测港府文档页：形态各异且大量无扩展名，白名单会误杀
        "https://www.immd.gov.hk/eng/e-visa.html",
        "https://www.investhk.gov.hk/en/our-clients/five-guys-recipe-for-apac-success/",
        "https://www.info.gov.hk/gia/general/202609/09/P2026090900732.htm",
        "https://www.edb.gov.hk/en/7-learning-goals/primary/default.html",
        "https://www.gov.hk/en/theme/multilanguage/mlp/hindi_residents.htm",
        "https://www.news.gov.hk/eng/2026/09/20260909/20260909_191900_462.html",
        "https://www.policyaddress.gov.hk/",
    ])
    def test_document_pages_not_matched(self, url):
        assert is_listing_page(url) is False


# ---------------------------------------------------------------------------
# 鲁港通 - 标题清洗（实测山东政务站 <title> = 站点名 + 栏目名 + 文章标题）
# ---------------------------------------------------------------------------

class TestCleanTitle:
    ORG = "山东省商务厅"

    def test_shandong_title_format_cleaned(self):
        raw = "山东省商务厅 商务要闻 省商务厅召开创建全国文明单位工作推进会"
        assert clean_title(raw, self.ORG) == "省商务厅召开创建全国文明单位工作推进会"

    def test_underscore_separator_cleaned(self):
        assert clean_title("山东省商务厅_全省商务工作会议在济南召开", self.ORG) == "全省商务工作会议在济南召开"

    def test_org_with_parenthetical_suffix_cleaned(self):
        # 鲁港通 - 实测教育厅 org="山东省教育厅（省委教育工委）"带括号后缀，而站点 <title>
        # 前缀只用核心名"山东省教育厅"，旧 startswith(完整org) 失败 → 44 篇标题带冗余前缀未清洗
        org = "山东省教育厅（省委教育工委）"
        raw = "山东省教育厅 其他文件 关于印发《山东省中小学人工智能通识教育教学指导纲要》的通知"
        assert clean_title(raw, org) == "关于印发《山东省中小学人工智能通识教育教学指导纲要》的通知"

    def test_year_range_dash_not_truncated(self):
        # 鲁港通 - 实测科技/工信标题含年份区间破折号（2026—2028年），旧“取最长段”在 — 处截断，
        # 损坏 19 篇（如“…行动计划（2026”丢了“—2028年）》的通知”）。剥栏目名后标题须原样保留。
        raw = "山东省科学技术厅 政策发布 关于印发《山东省轻工纺织产业科技创新行动计划（2026—2028年）》的通知"
        assert clean_title(raw, "山东省科学技术厅") == "关于印发《山东省轻工纺织产业科技创新行动计划（2026—2028年）》的通知"

    def test_title_internal_space_not_truncated(self):
        # 鲁港通 - 实测教育标题《…》内含空格（多条款政策），旧“取最长段”按空格切碎只留一段、
        # 丢失标题其余部分。剥栏目名后标题（含内部空格）须完整保留。
        org = "山东省教育厅（省委教育工委）"
        raw = "山东省教育厅 其他文件 关于印发《深化高校专利转化运用 服务现代化产业体系建设的若干措施》的通知"
        assert clean_title(raw, org) == "关于印发《深化高校专利转化运用 服务现代化产业体系建设的若干措施》的通知"

    def test_english_title_never_split(self):
        # 英文标题自带空格：不含机构名前缀时必须原样返回，绝不按空格切碎
        raw = "CE spotlights HK at Belt-Road Summit"
        assert clean_title(raw, "香港特别行政区政府新闻处") == raw
        assert clean_title(raw, None) == raw

    def test_title_equal_to_organization_kept(self):
        # 标题就是站点名（栏目页）：无可清洗，原样返回
        assert clean_title("山东省商务厅", self.ORG) == "山东省商务厅"

    def test_empty_title_returns_none(self):
        assert clean_title(None, self.ORG) is None
        assert clean_title("   ", self.ORG) is None

    def test_configured_prefix_stripped_before_org_matching(self):
        # 鲁港通 - TID 繁体站点名前缀「工業貿易署 - 」与简体 org「香港工业贸易署」匹配不上，
        # 由 title_strip_prefixes 显式剥离（配置在 sources.yaml，实测全站标题统一此格式）
        raw = "工業貿易署 - 粵港澳大灣區標準（「灣區標準」）"
        assert clean_title(raw, "香港工业贸易署", ["工業貿易署 - "]) == "粵港澳大灣區標準（「灣區標準」）"


# ---------------------------------------------------------------------------
# 鲁港通 - 正文容器提取（实测山东文章页正文在 id="zoom"，外居面包屑/字号控件）
# ---------------------------------------------------------------------------

_SD_ARTICLE_HTML = (
    "<html><head><meta charset='utf-8'>"
    "<title>山东省商务厅 商务要闻 省商务厅召开创建全国文明单位工作推进会</title></head>"
    "<body>"
    "<div class='main'>当前位置：首页 &gt; 新闻动态 &gt; 商务要闻</div>"
    "<div class='bt-article-02'>信息来源：山东省商务厅浏览次数：次字体：【大 中 小】</div>"
    f"<div id='zoom'><p>{_LONG_ZH}</p><div class='inner'><p>附注段落仍然在容器内。</p></div></div>"
    "<div class='main_right'>相关报道：其他文章链接噪声</div>"
    "</body></html>"
).encode("utf-8")


class TestContentSelector:
    ORG = "山东省商务厅"

    def test_selector_extracts_container_only(self):
        out = extract_html(_SD_ARTICLE_HTML, content_selector="#zoom", organization=self.ORG)
        assert out.title == "省商务厅召开创建全国文明单位工作推进会"
        # 容器内正文（含嵌套标签）完整保留
        assert "省商务厅今日发布通知" in out.text
        assert "附注段落仍然在容器内" in out.text
        # 容器外 UI 噪声全部剔除
        assert "当前位置" not in out.text
        assert "浏览次数" not in out.text
        assert "相关报道" not in out.text

    def test_class_selector_supported(self):
        html = (
            "<html><body><div class='nav'>导航噪声文字</div>"
            f"<div class='article content'><p>{_LONG_ZH}</p></div></body></html>"
        ).encode("utf-8")
        out = extract_html(html, content_selector=".content")
        assert "省商务厅今日发布通知" in out.text
        assert "导航噪声文字" not in out.text

    def test_selector_miss_falls_back_to_full_text(self):
        # 站点改版导致容器不存在：回退全文，不能返回空正文
        out = extract_html(_SD_ARTICLE_HTML, content_selector="#nonexistent", organization=self.ORG)
        assert out.text and "省商务厅今日发布通知" in out.text
        assert "当前位置" in out.text      # 全文回退时噪声仍在（优于空正文）

    def test_no_selector_keeps_legacy_behaviour(self):
        out = extract_html(_SD_ARTICLE_HTML, organization=self.ORG)
        assert "当前位置" in out.text
        # 标题清洗不依赖容器选择器
        assert out.title == "省商务厅召开创建全国文明单位工作推进会"
