# 鲁港通 - 容器探测工具的算法测试（离线，不发网络请求）
from __future__ import annotations

from app.ingest.discover import (
    DiscoveredItem,
    _decode_html,
    is_column_page,
    is_listing_page,
)
from app.ingest.extract import MIN_CONTENT_CHARS
from app.models import Source
from app.security.fetcher import FetchResult
from app.security.url_validator import DomainRule
from tools.probe_columns import _MAX_ANCHOR_CHARS, collect_links, in_scope, probe_source
from tools.probe_selectors import (
    _body_chain,
    _in_allowlist,
    _pick_article_urls,
    analyze_html,
    suggest_selector,
)

# 山东政务站实测结构：外层 .article 包裹噪声条与 #zoom 正文容器
_LONG_BODY = (
    "省商务厅今日发布通知，为深入推进鲁港经贸合作，进一步扩大双向投资规模，现就有关事项"
    "通知如下。一、加强产业对接，聚焦高端装备、现代海洋、医养健康等重点领域，组织企业赴港"
    "开展精准对接活动。二、优化营商环境，落实外商投资准入前国民待遇加负面清单管理制度，"
    "依法保护投资者合法权益。三、强化服务保障，建立重点外资项目服务专员制度，及时协调解决"
    "项目落地过程中的困难和问题。四、各地商务主管部门要切实履行职责，加强组织领导，确保各项"
    "措施落到实处，推动全省商务工作高质量发展。"
)

_SD_STRUCTURE_HTML = (
    "<html><head><title>山东省商务厅 商务要闻 测试文章标题</title></head><body>"
    "<div class='main'>当前位置：首页 &gt; 新闻动态</div>"
    "<div class='article'>"
    "<div class='bt-article-02'>信息来源：山东省商务厅浏览次数：次字体：【大 中 小】</div>"
    f"<div id='zoom'><p>{_LONG_BODY}</p></div>"
    "</div>"
    "<div class='main_right'>相关报道：其他文章链接</div>"
    "</body></html>"
).encode("utf-8")


class TestSuggestSelector:
    def test_picks_innermost_content_container(self):
        """外层 .article 与内层 #zoom 字数相同时，必须靠栈深选中更精确的 #zoom。"""
        selector, detail = suggest_selector([analyze_html(_SD_STRUCTURE_HTML)])
        assert selector == "#zoom"
        assert detail["hits"] == 1
        assert detail["avg_ratio"] >= 0.5
        assert detail["basis"] == "body"

    def test_navigation_only_container_rejected(self):
        """导航类容器即使占比达标也不得被建议（名称含 nav/menu/footer 等）。"""
        html = (
            "<html><body>"
            "<div id='nav'>" + "导航菜单项目文字内容。" * 40 + "</div>"
            "<div id='zoom'><p>正文很短。</p></div>"
            "</body></html>"
        ).encode("utf-8")
        selector, _ = suggest_selector([analyze_html(html)])
        assert selector != "#nav"

    def test_navigation_dense_page_returns_none(self):
        """实测回归：hk_wfsfaa 的 #page_bg 占全文 86% 却全是栏目短链接。

        这种页面不是文章页，必须返回 None，绝不能把导航容器写进配置。
        """
        html = (
            "<html><body><div id='page_bg'>"
            + "".join(f"<a href='/s{i}'>Working Family Allowance 栏目{i}</a>" for i in range(30))
            + "</div></body></html>"
        ).encode("utf-8")
        report = analyze_html(html)
        selector, detail = suggest_selector([report])
        assert selector is None
        assert detail["reason"] == "no_body_text"
        assert report.total_chars > 0 and report.body_total == 0

    def test_cross_article_consensus_prefers_inner_content(self):
        """实测回归：港府新闻网视频页外层 .newsdetail-wrap 含控件噪声，
        内层 .newsdetail-content 才是干净正文；多篇共识必须选内层。"""
        video_page = (
            "<html><body><div class='newsdetail-wrap'>"
            "<div class='video'>Download Video| TranscriptVoiceover:</div>"
            f"<div class='newsdetail-content'><p>{_LONG_BODY}</p></div>"
            "</div></body></html>"
        ).encode("utf-8")
        text_page = (
            "<html><body><div class='newsdetail-wrap'>"
            "<div class='subject'>行政长官发表声明</div>"
            f"<div class='newsdetail-content'><p>{_LONG_BODY}</p></div>"
            "</div></body></html>"
        ).encode("utf-8")
        selector, detail = suggest_selector(
            [analyze_html(video_page), analyze_html(text_page)]
        )
        assert selector == ".newsdetail-content"
        assert detail["articles"] == 2 and detail["hits"] == 2

    def test_no_qualified_container_returns_none(self):
        """全文碎片化、无任何容器占比达标时返回 None（交人工判断）。"""
        html = (
            "<html><body>"
            + "".join(f"<div class='c{i}'>零散文字片段{i}</div>" for i in range(30))
            + "</body></html>"
        ).encode("utf-8")
        selector, detail = suggest_selector([analyze_html(html)])
        assert selector is None
        assert detail["reason"] == "no_body_text"

    def test_class_selector_when_no_id(self):
        """页面无 id 容器时回退建议 class 容器。"""
        html = (
            "<html><body><div class='wrapper'><div class='head'>页头</div>"
            f"<div class='content'><p>{_LONG_BODY}</p></div></div></body></html>"
        ).encode("utf-8")
        selector, _ = suggest_selector([analyze_html(html)])
        assert selector == ".content"

    def test_script_and_style_not_counted(self):
        """script/style 内文字不得计入全文或容器字数（否则占比失真）。"""
        html = (
            "<html><head><style>" + "a" * 5000 + "</style>"
            "<script>" + "var x=1;" * 500 + "</script></head>"
            f"<body><div id='zoom'><p>{_LONG_BODY}</p></div></body></html>"
        ).encode("utf-8")
        report = analyze_html(html)
        selector, detail = suggest_selector([report])
        assert selector == "#zoom"
        assert detail["avg_ratio"] > 0.9      # 噪声不计入，正文容器占比接近全文

    def test_dynamic_id_across_pages_rejected(self):
        """实测回归：TYPO3 每页生成唯一 id（#c1592898853517 / #c1639719045193），
        跨篇不稳定的 id 必须排除，改用稳定 class。"""
        page_a = (
            "<html><body><div class='article-body'>"
            f"<div id='c1592898853517'><p>{_LONG_BODY}</p></div></div></body></html>"
        ).encode("utf-8")
        page_b = (
            "<html><body><div class='article-body'>"
            f"<div id='c1639719045193'><p>{_LONG_BODY}</p></div></div></body></html>"
        ).encode("utf-8")
        selector, detail = suggest_selector([analyze_html(page_a), analyze_html(page_b)])
        assert selector == ".article-body"
        assert detail["hits"] == 2

    def test_only_dynamic_ids_returns_none(self):
        """实测回归：VSB 建站系统（山东财大/济南大学）的 #vsb_content_* 每页不同，
        无稳定容器时必须返回 None 而不是建议一个无效 id。"""
        page_a = (
            f"<html><body><div id='vsb_content_1031_u81'><p>{_LONG_BODY}</p></div></body></html>"
        ).encode("utf-8")
        page_b = (
            f"<html><body><div id='vsb_content_1032_u81'><p>{_LONG_BODY}</p></div></body></html>"
        ).encode("utf-8")
        selector, detail = suggest_selector([analyze_html(page_a), analyze_html(page_b)])
        assert selector is None
        assert detail["reason"] == "only_dynamic_ids"

    def test_tiny_container_rejected_by_absolute_size(self):
        """实测回归：某来源建议了 .mobile_all_over_search（2 篇共 97 字），
        占比虽达 51% 但绝对字数远低于正文门槛，必须排除。"""
        page_a = (
            "<html><body>"
            "<div class='mobile_all_over_search'><p>搜尋 進階搜尋 關鍵字</p></div>"
            "<div class='bottom'>版權所有</div>"
            "</body></html>"
        ).encode("utf-8")
        selector, detail = suggest_selector([analyze_html(page_a)])
        assert selector is None
        assert detail["reason"] == "body_too_small"
        assert detail["max_avg_chars"] < MIN_CONTENT_CHARS

    def test_unclosed_paragraph_does_not_leak(self):
        """政务站常见不写 </p>：块级标签必须隐式闭合，否则导航会被归入正文。"""
        html = (
            "<html><body><div id='zoom'>"
            f"<p>{_LONG_BODY}"
            "<div class='pager'>上一页 下一页 返回首页 打印本页 关闭窗口</div>"
            "</div></body></html>"
        ).encode("utf-8")
        report = analyze_html(html)
        assert report.body["#zoom"] < report.counts["#zoom"]   # 分页导航未计入正文

    def test_outer_id_wrapper_not_preferred_over_inner_class(self):
        """实测回归：入境处 TYPO3 的 #element1 是包住整页的 id（导航均为短句，
        不计入 body，故与内层正文字数并列）。旧版「有 id 候选就忽略 class」会选中它，
        导致实测日志里「无选择器」与「用建议后」的正文完全一样（含 Skip to main content）。
        """
        html = (
            "<html><body><div id='element1'>"
            "<div class='skip'>Skip to main content</div>"
            "<div class='crumb'>Home &gt; About Us</div>"
            f"<div class='content-area'><p>{_LONG_BODY}</p></div>"
            "</div></body></html>"
        ).encode("utf-8")
        report = analyze_html(html)
        assert report.body["#element1"] == report.body[".content-area"]   # 字数并列
        selector, detail = suggest_selector([report])
        assert selector == ".content-area"
        assert detail["depth"] > 1

    def test_repeated_container_rejected_as_not_unique(self):
        """实测回归：提取器只取「第一个」命中容器的内容，同名容器出现多次时
        （如 Bootstrap 的 .col-md-12）配成选择器会把入库正文截断为第一段。"""
        html = (
            "<html><body>"
            f"<div class='col-md-12'><p>{_LONG_BODY}</p></div>"
            f"<div class='col-md-12'><p>{_LONG_BODY}</p></div>"
            "</body></html>"
        ).encode("utf-8")
        report = analyze_html(html)
        assert report.occ[".col-md-12"] == 2
        selector, detail = suggest_selector([report])
        assert selector is None
        assert detail["reason"] == "not_unique_per_page"
        assert detail["occ"][".col-md-12"] == 2

    def test_container_absent_on_some_pages_still_allowed(self):
        """实测回归：济南大学/山师的部分页面是图片型（无正文容器），
        不得因「某篇没有该容器」而否定它在其他篇的有效性。"""
        long_page = (
            f"<html><body><div class='arc-con'><p>{_LONG_BODY * 2}</p></div></body></html>"
        ).encode("utf-8")
        image_page = (
            "<html><body><div class='location'>首页 &gt; 学校概况</div></body></html>"
        ).encode("utf-8")
        selector, detail = suggest_selector(
            [analyze_html(long_page), analyze_html(image_page)]
        )
        assert selector == ".arc-con"
        assert detail["articles"] == 2 and detail["hits"] == 1


class TestBodyChain:
    """正文链：人工从外层 wrapper 逐层看到最内层正文容器的依据。"""

    def test_orders_outer_to_inner(self):
        report = analyze_html(_SD_STRUCTURE_HTML)
        chain = _body_chain(report)
        keys = [item[0] for item in chain]
        depths = [item[2] for item in chain]
        assert depths == sorted(depths)                       # 栈深升序
        assert ".article" in keys and "#zoom" in keys
        assert keys.index(".article") < keys.index("#zoom")   # 外层在前
        assert report.body[".article"] == report.body["#zoom"]  # 文字冒泡，字数并列

    def test_marks_repeated_and_bad_containers(self):
        """链条需暴露「出现次数」与「导航类名称」，供人工判定为何某容器不可用。"""
        html = (
            "<html><body><div class='main-nav'>首页 学校概况</div>"
            f"<div class='col-md-12'><p>{_LONG_BODY}</p></div>"
            f"<div class='col-md-12'><p>{_LONG_BODY}</p></div>"
            "</body></html>"
        ).encode("utf-8")
        report = analyze_html(html)
        chain = dict((item[0], item) for item in _body_chain(report))
        assert chain[".col-md-12"][3] == 2          # 出现两次
        assert ".main-nav" not in chain             # 导航短句不计入 body


class TestInAllowlist:
    """白名单粗筛：避开必然被拒的跨域外链，不浪费探测请求。"""

    _CZT = (DomainRule(hostname="czt.shandong.gov.cn", allow_http=True, path_prefix="/"),)
    _EDB = (
        DomainRule(hostname="www.edb.gov.hk", path_prefix="/en/"),
        DomainRule(hostname="www.edb.gov.hk", path_prefix="/tc/"),
    )

    def test_cross_domain_link_rejected(self):
        """实测回归：财政厅首页候选几乎全是 www.shandong.gov.cn / www.gov.cn 外链。"""
        assert not _in_allowlist(
            "http://www.shandong.gov.cn/art/2026/9/8/art_116655_751479.html", self._CZT
        )
        assert not _in_allowlist(
            "https://www.gov.cn/home/toutu/202608/content_7079589.htm", self._CZT
        )
        assert _in_allowlist(
            "http://czt.shandong.gov.cn/art/2026/9/1/art_94505_1.html", self._CZT
        )

    def test_http_rejected_when_not_allowed(self):
        """实测回归：sd_sdnu 未开 allow_http，站内 http 链接全部被拒（配置缺陷信号）。"""
        rules = (DomainRule(hostname="www.sdnu.edu.cn", path_prefix="/"),)
        assert not _in_allowlist("http://www.sdnu.edu.cn/overview/introduction.htm", rules)
        assert _in_allowlist("https://www.sdnu.edu.cn/overview/introduction.htm", rules)

    def test_sitemap_entry_outside_path_prefix(self):
        """实测回归：hk_edb 的 /sitemap.xml 不在 /en/ /tc/ 前缀内，发现入口自身被拒。"""
        assert not _in_allowlist("https://www.edb.gov.hk/sitemap.xml", self._EDB)
        assert _in_allowlist("https://www.edb.gov.hk/en/news/2026/x.html", self._EDB)

    def test_subdomain_matching_is_suffix_safe(self):
        rules = (DomainRule(hostname="sdu.edu.cn", allow_subdomains=True, path_prefix="/"),)
        assert _in_allowlist("https://www.nc.sdu.edu.cn/yxdl.htm", rules)
        # 域名后缀伪造：不得因 endswith 字串包含而误放行
        assert not _in_allowlist("https://www.sdu.edu.cn.evil.example/a.htm", rules)

    def test_non_http_scheme_rejected(self):
        rules = (DomainRule(hostname="czt.shandong.gov.cn", allow_http=True, path_prefix="/"),)
        assert not _in_allowlist("javascript:void(0)", rules)
        assert not _in_allowlist("ftp://czt.shandong.gov.cn/a.html", rules)


class TestPickArticleUrls:
    _SD = (DomainRule(hostname="commerce.shandong.gov.cn", allow_http=True, path_prefix="/"),)
    _GIA = (DomainRule(hostname="www.info.gov.hk", path_prefix="/gia/general/"),)

    def test_filters_listing_and_interface_urls(self):
        items = [
            DiscoveredItem(url="http://commerce.shandong.gov.cn/col/col16256/index.html"),
            DiscoveredItem(url="http://commerce.shandong.gov.cn/art/2026/9/8/art_16256_1.html"),
            DiscoveredItem(url="http://commerce.shandong.gov.cn/module/web/jpage/dataproxy.jsp?page=1"),
            DiscoveredItem(url="http://commerce.shandong.gov.cn/jact/front/main.do?sysid=151"),
            DiscoveredItem(url="http://commerce.shandong.gov.cn/art/2026/9/7/art_16256_2.html"),
            DiscoveredItem(url="http://commerce.shandong.gov.cn/"),
        ]
        picked = _pick_article_urls(
            items, {"http://commerce.shandong.gov.cn"}, self._SD, limit=2
        )
        assert picked == [
            "http://commerce.shandong.gov.cn/art/2026/9/8/art_16256_1.html",
            "http://commerce.shandong.gov.cn/art/2026/9/7/art_16256_2.html",
        ]

    def test_cross_domain_candidates_skipped(self):
        """实测回归：财政厅首页候选以外链为主，粗筛后只剩本域文章。"""
        items = [
            DiscoveredItem(url="http://www.shandong.gov.cn/art/2026/9/8/art_116655_751479.html"),
            DiscoveredItem(url="https://www.gov.cn/home/toutu/202608/content_7079589.htm"),
            DiscoveredItem(url="http://czt.shandong.gov.cn/art/2026/9/1/art_94505_1.html"),
        ]
        rules = (DomainRule(hostname="czt.shandong.gov.cn", allow_http=True, path_prefix="/"),)
        assert _pick_article_urls(items, set(), rules, limit=2) == [
            "http://czt.shandong.gov.cn/art/2026/9/1/art_94505_1.html"
        ]

    def test_modern_urls_without_extension_accepted(self):
        """实测回归：HKMA/InvestHK/data.gov.hk 的内容 URL 无扩展名（路径 ≥3 段），
        只认 .html 后缀会让这三个来源完全探不到样本。"""
        items = [
            DiscoveredItem(url="https://www.hkma.gov.hk/eng/"),
            DiscoveredItem(
                url="https://www.hkma.gov.hk/eng/regulatory-resources/circulars/2000/01/c123"
            ),
            DiscoveredItem(url="https://www.investhk.gov.hk/en/our-clients/a-new-chapter/"),
            DiscoveredItem(url="https://data.gov.hk/en-data/dataset/hk-gld-x/resource/uuid-1"),
        ]
        rules = (
            DomainRule(hostname="www.hkma.gov.hk", path_prefix="/eng/"),
            DomainRule(hostname="www.investhk.gov.hk", path_prefix="/en/"),
            DomainRule(hostname="data.gov.hk", path_prefix="/en-data/"),
        )
        picked = _pick_article_urls(items, set(), rules, limit=4)
        assert len(picked) == 3                      # 首页 /eng/ 被排除
        assert "https://www.hkma.gov.hk/eng/" not in picked

    def test_respects_limit_and_entry_exclusion(self):
        items = [
            DiscoveredItem(url="https://www.info.gov.hk/gia/general/202609/09/a.htm"),
            DiscoveredItem(url="https://www.info.gov.hk/gia/general/202609/09/b.htm"),
            DiscoveredItem(url="https://www.info.gov.hk/gia/general/202609/09/c.htm"),
        ]
        picked = _pick_article_urls(items, set(), self._GIA, limit=2)
        assert len(picked) == 2
        assert all(u.endswith(".htm") for u in picked)


# ---------------------------------------------------------------------------
# 鲁港通 - 栏目页发现工具（为山东厅局找「政策文件/通知公告」入口）
# ---------------------------------------------------------------------------

class TestCollectLinks:
    """锚文本提取：栏目名只存在于锚文本里，是换入口的唯一判据。"""

    _BASE = "http://czt.shandong.gov.cn/"

    def test_extracts_anchor_text_and_resolves_relative(self):
        html = (
            "<html><body>"
            "<a href='/col/col190914/index.html'>通知公告</a>"
            "<a href='./col/col17084/index.html'>政策文件</a>"
            "</body></html>"
        ).encode("utf-8")
        links = {lk.url: lk.text for lk in collect_links(html, self._BASE)}
        assert links["http://czt.shandong.gov.cn/col/col190914/index.html"] == "通知公告"
        assert links["http://czt.shandong.gov.cn/col/col17084/index.html"] == "政策文件"

    def test_gb18030_page_decoded_for_chinese_anchor(self):
        """实测部分山东政务站声明 gb18030：不解对就拿不到中文栏目名。"""
        html = (
            "<html><head><meta charset='gb18030'></head><body>"
            "<a href='/col/col1/index.html'>通知公告</a></body></html>"
        ).encode("gb18030")
        links = collect_links(html, self._BASE)
        assert links[0].text == "通知公告"

    def test_gb2312_page_decoded_for_chinese_anchor(self):
        html = (
            "<html><head><meta charset='gb2312'></head><body>"
            "<a href='/col/col1/index.html'>政策文件</a></body></html>"
        ).encode("gb18030")
        assert _decode_html(html).count("政策文件") == 1
        assert collect_links(html, self._BASE)[0].text == "政策文件"

    def test_nested_tags_contribute_to_text(self):
        """政务站模板常把栏目名包在 <span>/<em> 里。"""
        html = (
            "<html><body><a href='/col/col9/index.html'>"
            "<span>通知</span><em>公告</em></a></body></html>"
        ).encode("utf-8")
        assert collect_links(html, self._BASE)[0].text == "通知公告"

    def test_skips_non_http_and_dedups(self):
        html = (
            "<html><body>"
            "<a href='javascript:void(0)'>弹层</a>"
            "<a href='mailto:x@gov.cn'>邮件</a>"
            "<a href='/col/col1/index.html#top'>通知公告</a>"
            "<a href='/col/col1/index.html'>通知公告</a>"
            "</body></html>"
        ).encode("utf-8")
        links = collect_links(html, self._BASE)
        assert len(links) == 1                     # fragment 归一后去重
        assert links[0].url == "http://czt.shandong.gov.cn/col/col1/index.html"

    def test_unclosed_anchor_still_yields_url_with_truncated_text(self):
        """未闭合 <a>（政务站模板缺标签常见）仍要拿到 URL，锚文本截断防吞全页。"""
        html = (
            "<html><body><a href='/col/col1/index.html'>通知公告"
            f"<div>{'导航项' * 200}</div></body></html>"
        ).encode("utf-8")
        links = collect_links(html, self._BASE)
        assert len(links) == 1                     # 不丢失候选
        assert links[0].url == "http://czt.shandong.gov.cn/col/col1/index.html"
        assert links[0].text.startswith("通知公告")
        assert len(links[0].text) <= _MAX_ANCHOR_CHARS


class TestColumnClassification:
    def test_column_page_shapes(self):
        """栏目页必须同时满足「/col/ 路径下」与「末段是 index 页」。"""
        assert is_column_page("http://czt.shandong.gov.cn/col/col190914/index.html")
        assert is_column_page("https://www.jinan.gov.cn/col/col2608/index.html")
        assert is_column_page("http://edu.shandong.gov.cn/col/col1234/index_1.html")
        assert not is_column_page("http://czt.shandong.gov.cn/art/2026/8/25/art_1_2.html")
        assert not is_column_page("http://kjt.shandong.gov.cn/index.html")   # 首页不在 /col/ 下

    def test_jinan_article_pages_not_mistaken_for_columns(self):
        """实测回归：济南市系文章页嵌在栏目路径下，只看 /col/ 会全部误杀。

        实测 URL（probe-cols.log）：jnhrss.jinan.gov.cn 首页链出的「文章」绝大多数形如
        /col/col18309/art/2026/art_<uuid>.html；若归为栏目页，jinan_gov/jinan_hrss
        两个来源将一篇也采不到。
        """
        jinan_articles = [
            "https://jnhrss.jinan.gov.cn/col/col18309/art/2026/art_60aea50238d24db9b9b08617192979a0.html",
            "https://jnhrss.jinan.gov.cn/col/col39924/art/2026/art_855123c70a5c4d419d7c246c48cd77ca.html",
            "https://jnhrss.jinan.gov.cn/col/col18578/art/2026/art_5ed4e7a291d44d9d98e625f0d5cca20e.html",
        ]
        for url in jinan_articles:
            assert is_column_page(url) is False
            assert is_listing_page(url) is False

    def test_in_scope_matches_policy_columns(self):
        assert in_scope("通知公告")
        assert in_scope("政策文件")
        assert in_scope("规范性文件")
        assert in_scope("政策法规")

    def test_in_scope_rejects_navigation_and_service(self):
        assert not in_scope("首页")
        assert not in_scope("更多>>")
        assert not in_scope("山东省财政学会")     # 实测 sd_czt 首页干扰项
        assert not in_scope("政府信息公开指南")
        assert not in_scope("办事服务")
        assert not in_scope("")                    # 图片链接常无锚文本


# ---------------------------------------------------------------------------
# 鲁港通 - --urls 模式：人工候选入口覆盖 sources.yaml 配置
# ---------------------------------------------------------------------------

# 入口页：一个栏目页链接 + 一个文档页链接
_ENTRY_HTML = (
    "<html><body>"
    "<a href='/col/col85343/sub/index.html'>规章</a>"
    "<a href='/art/2026/9/1/art_1_2.html'>某决定</a>"
    "</body></html>"
).encode("utf-8")
# 栏目页：2 篇文档 + 1 个翻页（翻页必须被排除在 docs 计数外）
_COL_HTML = (
    "<html><body>"
    "<a href='/col/col85343/art/2026/art_a.html'>济南市餐厨垃圾管理规定</a>"
    "<a href='/col/col85343/art/2026/art_b.html'>济南市低空经济发展促进办法</a>"
    "<a href='/col/col85343/index_1.html'>下一页</a>"
    "</body></html>"
).encode("utf-8")


class TestProbeSourceEntriesOverride:
    """probe_source(entries=...) 用人工入口而非配置；不传 entries 回退配置。"""

    CONFIGURED = "https://www.jinan.gov.cn/old/index.html"
    MANUAL = "https://www.jinan.gov.cn/col/col85343/index.html"

    def _source(self, db):
        src = Source(
            code="jn_test", name="测试政府", source_group="sd_core_gov",
            organization="济南市人民政府", discovery_method="listing",
            discovery_config={"listing_urls": [self.CONFIGURED]},
        )
        db.add(src)
        db.commit()
        return src

    def _patch(self, monkeypatch, calls):
        def fake_fetch(url, rules, settings, fetcher, sleeper, stats):
            calls.append(url)
            body = _COL_HTML if "/sub/" in url else _ENTRY_HTML
            return FetchResult(final_url=url, http_status=200,
                               content_type="text/html", content=body)

        monkeypatch.setattr("tools.probe_columns._fetch_with_retry", fake_fetch)
        # 鲁港通 - 白名单规则仍随来源取：--urls 只换入口，不绕过安全校验
        monkeypatch.setattr("tools.probe_columns._rules_for_source",
                            lambda db, src: [DomainRule(hostname="www.jinan.gov.cn")])

    def test_entries_override_configured_urls(self, db, monkeypatch, capsys):
        src = self._source(db)
        calls: list[str] = []
        self._patch(monkeypatch, calls)
        probe_source(db, src, None, 0, 10, entries=[self.MANUAL])
        assert calls[0] == self.MANUAL
        assert self.CONFIGURED not in calls
        assert "docs=2" in capsys.readouterr().out   # 翻页 index_1 不计入文档数

    def test_no_entries_falls_back_to_config(self, db, monkeypatch, capsys):
        src = self._source(db)
        calls: list[str] = []
        self._patch(monkeypatch, calls)
        probe_source(db, src, None, 0, 10)
        assert calls[0] == self.CONFIGURED
