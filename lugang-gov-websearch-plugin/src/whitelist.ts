// 鲁港通 - 政府官网联网搜索 域名白名单/黑名单清单
// 匹配规则见 domain-filter.ts：主机名去 www、转小写后做后缀匹配（host === domain || host.endsWith('.' + domain)）。
// 清单可维护扩充：新增权威来源时，按类别加入对应数组即可。

// A 政府：后缀匹配（任何 *.gov.hk 主机）
export const GOV_SUFFIXES = ['gov.hk'];

// B 公营机构（含政府控股上市公司）：显式清单，可维护扩充
export const PUBLIC_BODIES = [
  'hkex.com.hk', // 港交所
  'mtr.com.hk', // 港铁
  'sfc.hk', // 证监会
  'hktdc.com', // 贸易发展局
  'hkairport.com', // 机场管理局
  'ha.org.hk', // 医院管理局
  'ia.org.hk', // 保险业监管局
  'mpfa.org.hk', // 积金局
  'cic.hk', // 建造业议会
  'erb.org.hk', // 雇员再培训局
  'hkicpa.org.hk', // 会计师公会
  'judiciary.hk', // 司法机构
  // 鲁港通 - 2026-10-13 公共服务清点新增（逐项核身：官网抬头或官方新闻稿确认主办主体）
  'hkstp.org', // 香港科技园公司：法定机构（香港科技园公司条例 法例第 565 章）
  'cyberport.hk', // 数码港：政府全资拥有的香港数码港管理有限公司运营
  'hkpc.org', // 香港生产力促进局：法定机构（法例第 1116 章）
  'hsitp.org', // 港深创新及科技园公司：香港科技园公司全资附属
  'discoverhongkong.com', // 香港旅游发展局（法定机构）官网
  'hongkongpost.hk', // 香港邮政（政府邮政署官方域名）
  'hkmc.com.hk', // 香港按揭证券有限公司：政府经外汇基金全资持有（含按证保险）
  'hkecic.com', // 香港出口信用保险局：法定机构（法例第 1115 章）
  'westk.hk', // 西九文化区管理局：法定机构（法例第 601 章）
  'hkhs.com' // 香港房屋协会：法定机构（法例第 1059 章）
];

// C 学术：后缀匹配 + 大学显式清单（部分大学不使用 edu.hk 后缀）
export const ACADEMIC_SUFFIXES = ['edu.hk', 'sch.hk', 'ac.hk'];
export const UNIVERSITIES = [
  'hku.hk',
  'ust.hk',
  'polyu.edu.hk',
  'cityu.edu.hk',
  'hkbu.edu.hk',
  'ln.edu.hk',
  'eduhk.hk',
  'hsu.edu.hk',
  'hkmu.edu.hk',
  'hkapa.edu.hk',
  'cihe.edu.hk'
];

// D 非盈利：后缀匹配（任何 *.org.hk 主机）
export const NONPROFIT_SUFFIXES = ['org.hk'];

// E 正规新闻媒体：显式清单，可维护扩充
export const NEWS_MEDIA = [
  'hk01.com',
  'on.cc',
  'dotdotnews.com',
  'takungpao.com',
  'aastocks.com',
  'etnet.com.hk',
  'stheadline.com',
  'mingpao.com',
  'scmp.com',
  'hket.com',
  'hkej.com',
  'am730.com.hk',
  'hkcna.hk',
  'singtao.com',
  'thestandard.com.hk',
  'chinadailyhk.com',
  'hkcd.com',
  'wenweipo.com',
  'mpfinance.com',
  // 鲁港通 - 2026-10-13 对照 DeepSeek 引用来源清点新增（逐项核身：站点抬头/版权行/平台标识）
  'jdonline.com.hk', // 经济导报（香港）：官网抬头「經濟導報」
  'skypost.hk', // 晴报（香港经济日报集团）：2023-09 转纯网媒，版权行「香港經濟日報版權所有」
  'orangenews.hk', // 橙新闻：官网抬头「橙新聞」
  'bastillepost.com', // 巴士的报（星岛新闻集团）：官网抬头「巴士的報」
  'hkheadline.com' // 星岛头条平台域（原头条日报）：页面配置 domain=stheadline.com，与 stheadline.com 同平台
];

// F 电视台网站：显式清单（明确白名单），可维护扩充
export const TV_STATIONS = [
  'tvb.com',
  'now.com',
  'nowe.com',
  'viu.tv',
  'i-cable.com',
  'cabletv.com.hk',
  'rthk.hk',
  'hkopentv.com',
  'fantv.hk',
  'phoenixtv.com',
  // 鲁港通 - 2026-10-13 对照 DeepSeek 引用来源清点新增（核身：牌照与官网抬头）
  '881903.com', // 商业电台（雷霆881/叱咤903）：官网抬头「商業電台」
  'metroradio.com.hk', // 新城电台：官网抬头「新城電台」
  'hkstv.tv' // 香港卫视：持香港非本地电视节目服务牌照，官网抬头「香港衛視」
];

// G 金融机构（银行/保险/证券基金）：显式清单，可维护扩充
// G1 银行（含虚拟银行）
export const FINANCE_BANKS = [
  'hsbc.com.hk', // 汇丰银行（香港）
  'bochk.com', // 中银香港
  'sc.com', // 渣打银行
  'hangseng.com', // 恒生银行
  'hkbea.com', // 东亚银行
  'citibank.com.hk', // 花旗银行（香港）
  'dbs.com.hk', // 星展银行（香港）
  'ocbc.com.hk', // 华侨银行（香港）
  'icbcasia.com', // 工银亚洲
  'asia.ccb.com', // 建行（亚洲）
  'hk.bankcomm.com', // 交通银行（香港）
  'shacombank.com.hk', // 上海商业银行
  'chiyubank.com', // 集友银行
  'cncbinternational.com', // 中信银行（国际）
  'dahsing.com', // 大新银行
  'cmbwinglungbank.com', // 招商永隆银行
  'ncb.com.hk', // 南洋商业银行
  'publicbank.com.hk', // 大众银行（香港）
  'fubonbank.com.hk', // 富邦银行（香港）
  'za.group', // 众安银行 ZA Bank
  'mox.com', // Mox 银行
  'welab.bank', // 汇立银行 WeLab Bank
  'livi.bank', // livi 银行
  'fusionbank.com', // 富融银行
  'paob.com.hk', // 平安壹账通银行
  'antbank.hk', // 蚂蚁银行（香港）
  'airstarbank.com' // 天星银行
];

// G2 保险（含虚拟保险公司）
export const FINANCE_INSURERS = [
  'aia.com.hk', // 友邦保险（香港）
  'prudential.com.hk', // 保诚保险（香港）
  'manulife.com.hk', // 宏利（香港）
  'fwd.com.hk', // 富卫香港
  'chinalife.com.hk', // 中国人寿（海外）
  'sunlife.com.hk', // 永明金融（香港）
  'axa.com.hk', // AXA 安盛（香港）
  'yflife.com', // 万通保险
  'boclife.com.hk', // 中银人寿
  'ctflife.com.hk', // 中国太平人寿（香港）
  'bowtie.com.hk', // 保泰人寿（虚拟保险）
  'onedegree.hk', // OneDegree（虚拟保险）
  'blue.com.hk' // Blue 保险
];

// G3 证券与基金
export const FINANCE_SECURITIES_FUNDS = [
  'futuhk.com', // 富途证券（香港）
  'phillip.com.hk', // 辉立证券
  'bsgroup.com.hk', // 耀才证券
  'gtja.com.hk', // 国泰君安国际
  'csopasset.com', // 南方东英
  'chinaamc.com.hk', // 华夏基金（香港）
  'interactivebrokers.com' // 盈透证券
];

// H 医疗机构：显式清单，可维护扩充（公营医院由 ha.org.hk 覆盖、多数私立医院由 org.hk 覆盖，此处为显式补充）
export const MEDICAL_INSTITUTIONS = [
  'hksh.com', // 养和医院
  'gleneagles.hk', // 港怡医院
  'matilda.org', // 明德国际医院
  'union.org', // 仁安医院
  'hkma.org', // 香港医学会
  'hkda.org' // 香港牙医学会
];

// 黑名单 1：社交媒体（official 模式硬拒绝，含其上的官方媒体账号；open 模式放行）
export const SOCIAL_MEDIA = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'douyin.com',
  'kuaishou.com',
  'weibo.com',
  'xiaohongshu.com',
  'xhslink.com',
  'threads.net',
  'pinterest.com',
  'reddit.com',
  'tumblr.com',
  't.me',
  'telegram.org',
  'discord.com',
  'whatsapp.com',
  'snapchat.com',
  'vk.com',
  'linkedin.com',
  'medium.com',
  'zhihu.com',
  'blogspot.com',
  'wordpress.com',
  'wixsite.com',
  'weebly.com',
  'qq.com' // 鲁港通 - 腾讯系（含微信公众号 mp.weixin.qq.com 与腾讯新闻），实测为大陆检索第一大噪音来源
];

// 黑名单 2：营销平台（仅 official 模式拒绝；open 模式完全不过滤、直接放行）
export const MARKETING_PLATFORMS = [
  'klook.com',
  'tripadvisor.com',
  'tripadvisor.com.hk',
  'booking.com',
  'agoda.com',
  'kkday.com',
  'airbnb.com',
  'openrice.com',
  'taobao.com',
  'tmall.com',
  'jd.com',
  'amazon.com',
  'price.com.hk',
  'moneyhero.com.hk',
  'jobsdb.com',
  'ctgoodjobs.hk',
  'indeed.com'
];

// ============================================================
// 大陆地域档（region=cn，山东投资创业支线专用）
// 清单只收录 2026-10-12 两轮百炼实测（25 题生活场景 + 29 题地市/部委定向 + 补发语法试验）
// 真实命中过的官方主机名；未实测到的域名一律不写，避免凭印象放行。
// 外省政务、门户、百科、公众号、房产/招工聚合站均不在名单内 → 默认拒绝。
// 极易凭拼音误加的省外域名（实测标题已确认属外省，禁止加入）：
// laiwu.gov.cn = 湖南省临武县（非山东莱芜）；cnts.gov.cn = 广东省台山市（非青岛/济南某区）。
// ============================================================

// I1 国务院门户与总局本级：规范化后主机就是 gov.cn / chinatax.gov.cn（www. 被剥离），
// 必须精确匹配。税务总局各省局是 <province>.chinatax.gov.cn，后缀匹配会放行全国 31 省，
// 严格档只保留山东（见 CN_SHANDONG_GOV 的 shandong.chinatax.gov.cn）。
export const CN_CENTRAL_EXACT = ['gov.cn', 'chinatax.gov.cn'];

// I2 中央国家机关与部委（后缀匹配，含其分支/业务子站，如 kunming.pbc.gov.cn）
export const CN_CENTRAL_GOV = [
  'ndrc.gov.cn', // 国家发展改革委
  'mohrss.gov.cn', // 人力资源社会保障部
  'moe.gov.cn', // 教育部
  'mps.gov.cn', // 公安部
  'nia.gov.cn', // 国家移民管理局
  'gqb.gov.cn', // 国务院侨办（含 qwgzyj.gqb.gov.cn 侨务办公室）
  'gwytb.gov.cn', // 国务院台办
  'fgk.chinatax.gov.cn', // 国家税务总局政策法规库（实测命中；总局本级走 I1 精确匹配）
  'pbc.gov.cn', // 中国人民银行
  'safe.gov.cn', // 国家外汇管理局
  'mofcom.gov.cn', // 商务部
  'scio.gov.cn', // 国务院新闻办
  'ccgp.gov.cn' // 中国政府采购网
];

// J 山东省级 + 16 地市 + 实测命中的区县级政务（后缀匹配覆盖全部部门子站）
export const CN_SHANDONG_GOV = [
  'shandong.gov.cn', // 山东省人民政府及省政府部门
  'sd.gov.cn', // 山东政务服务（如 wfgxzwfw.sd.gov.cn）
  'shandong.chinatax.gov.cn', // 国家税务总局山东省税务局
  'jinan.gov.cn', // 济南市
  'qingdao.gov.cn', // 青岛市
  'zibo.gov.cn', // 淄博市
  'china-zibo.gov.cn', // 淄博市政府网（实测使用独立域名）
  'zaozhuang.gov.cn', // 枣庄市
  'dongying.gov.cn', // 东营市
  'yantai.gov.cn', // 烟台市
  'weifang.gov.cn', // 潍坊市
  'jining.gov.cn', // 济宁市
  'taian.gov.cn', // 泰安市
  'weihai.gov.cn', // 威海市
  'rizhao.gov.cn', // 日照市
  'linyi.gov.cn', // 临沂市
  'dezhou.gov.cn', // 德州市
  'liaocheng.gov.cn', // 聊城市
  'binzhou.gov.cn', // 滨州市
  'heze.gov.cn', // 菏泽市
  'jiyang.gov.cn', // 济南市济阳区
  'tianqiao.gov.cn', // 济南市天桥区
  'qingdaoshibei.gov.cn', // 青岛市市北区
  'jimo.gov.cn', // 青岛市即墨区
  'pingdu.gov.cn', // 青岛平度市
  'laiyang.gov.cn', // 烟台莱阳市
  'rushan.gov.cn', // 威海乳山市
  'haiyang.gov.cn', // 烟台海阳市
  'ytfushan.gov.cn', // 烟台福山区
  'ytlaishan.gov.cn', // 烟台莱山区
  'zhangdian.gov.cn', // 淄博市张店区
  'shouguang.gov.cn', // 潍坊寿光市
  'wfgx.gov.cn', // 潍坊高新技术产业开发区
  'lanling.gov.cn', // 临沂兰陵县
  'feixian.gov.cn', // 临沂费县
  'huancui.gov.cn', // 威海环翠区
  'wendeng.gov.cn', // 威海文登区
  'dypedz.gov.cn', // 东营经济技术开发区
  'rzlanshan.gov.cn', // 日照岚山区
  'chengyang.gov.cn', // 青岛市城阳区
  'qdsn.gov.cn', // 青岛市市南区
  'zoucheng.gov.cn', // 济宁邹城市
  'yishui.gov.cn' // 临沂市沂水县
];

// K 山东高校（实测命中的部属/省属高校；外省高校如 syuct.edu.cn 不列入）
export const CN_SHANDONG_UNIVERSITIES = [
  'sdu.edu.cn', // 山东大学
  'ouc.edu.cn', // 中国海洋大学
  'qdu.edu.cn', // 青岛大学
  'qust.edu.cn', // 青岛科技大学
  'dzu.edu.cn' // 德州学院
];

// ============================================================
// L 大陆官方新闻媒体（只在 region=cn 生效；hk 档的 NEWS_MEDIA 全是港媒，两档互不串用）
// 收录标准（两条都要满足）：
//   ① 2026-10-12 两轮百炼实测（14 题山东/济南投资类自由检索 + 28 域 site: 定向）真实命中过，
//      或与已命中的站点同属一个主办主体（news.cn 与 xinhuanet.com 同为新华网股份有限公司）；
//   ② 逐个抓取站点抬头/版权行核实主管单位（注释里写的是抓到的原文），不是按域名猜。
// 证据日志：.qoder/specs/sd-assistant-integration/media-survey.log + media-verify.log。
// 商业门户、百科、公众号、学术商业库、财经营销站、外省地方网一律不入（见文末拒绝清单）。
// ============================================================

// L1 中央重点新闻网站（央媒）
export const CN_CENTRAL_MEDIA = [
  'xinhuanet.com', // 新华网（新华社）：抬头「新华网_让新闻离你更近」/「版权所有：新华网股份有限公司」
  'news.cn', // 新华社主域：抬头同上「新华网股份有限公司」，与 xinhuanet.com 同一主体
  'people.com.cn', // 人民网（人民日报社）：抬头「人民网_网上的人民日报」
  'peopleapp.com', // 人民日报客户端：抬头「人民日报-有品质的新闻」/「Copyright © 人民日报客户端」
  'cctv.com', // 央视网（中央广播电视总台）：抬头「中央广播电视总台 央视网 版权所有」
  'cnr.cn', // 央广网（中央广播电视总台）：site: 定向 5 条命中（济南科创金融政策报道）
  'gmw.cn', // 光明网（光明日报社）：抬头「光明网_新闻视野、文化视角、思想深度、理论高度」
  'ce.cn', // 中国经济网（经济日报社）：抬头「中国经济网——国家经济门户」
  'jjckb.cn', // 经济参考网（新华社《经济参考报》）：抬头「新华社《经济参考报》官方网站」
  'china.com.cn', // 中国网（国务院新闻办）：抬头「中国网--网上中国」/「中国互联网新闻中心」
  'banyuetan.org', // 半月谈网（新华社半月谈杂志社）：抬头「半月谈首页—半月谈网」/「半月谈杂志社」
  'chinaqw.com' // 中国侨网（中新社）：抬头「中国侨网」，侨务与港澳报道主力来源
];

// L2 山东省级与济南市级党媒
export const CN_SHANDONG_MEDIA = [
  'dzwww.com', // 大众网（大众报业集团）：抬头「大众网」，含 w./sdqy. 等子站
  'iqilu.com', // 齐鲁网·闪电新闻（山东广播电视台）：抬头「山东广播电视台主办」
  'sdchina.com', // 中国山东网（山东省政府新闻办）：抬头「中国山东网」，含 jinan./finance. 子站
  'qlwb.com.cn', // 齐鲁晚报网（大众报业集团）：抬头「齐鲁晚报网-山东新闻门户」
  'e23.cn' // 舜网（济南日报报业集团）：抬头「山东省重点新闻网站、济南市唯一新闻门户网站」
];

// L3 中央驻港媒体：这几个域名自 v1.1.x 起已在 hk 档 NEWS_MEDIA 在册并核验过，
// 此处独立列出，让 cn 档自洽可审（山东题常命中它们对「港澳山东周」等活动的报道）。
export const CN_HK_RESIDENT_MEDIA = [
  'takungpao.com', // 大公文汇网：抬头「今日大公 - 大公文匯網」
  'hkcd.com', // 香港商报
  'wenweipo.com', // 文汇报
  'chinadailyhk.com', // 中国日报香港版（央媒驻港）
  'hkcna.hk' // 中国评论通讯社
];

// ------------------------------------------------------------
// 已实测但**不收录**（附理由，避免下次重复评估或凭拼音误加）：
//   lznews.cn          抬头实证为「鲁中网」（淄博市级新闻网站），不是常被误认的「鲁网」省级站；
//                      鲁ICP备05034096号-6，与投资创业主线相关性低。
//   ficc.org.cn        站点从生产出口不可达、身份无法核实；site: 命中内容全是转发的济南市政府
//                      正式文件（镜像/聚合嫌疑）——引它不如直接引 jinan.gov.cn，故不入。
//   chinareform.org.cn 身份无法核实，自由检索仅 1 次命中。
//   sd.china.com       中华网（商业门户）；163.com 网易（商业门户）。
//   baike.baidu.com / mp.weixin.qq.com / wanfangdata.com.cn / cnki.com.cn / stock.10jqka.com.cn
//   / *.b2b.11467.com / mnw.cn（闽南网=福建，外省）
//                      百科、公众号、学术商业库、财经营销、B2B 黄页、外省地方网 → 维持拒绝。
//   zgbk.com（紫荆杂志）/ xhhnews.com（新黄河）/ haibaonews.com（海报新闻）/ sdenet.com.cn
//                      site: 定向零命中，暂无收录依据；日后可复测再评估。
// ------------------------------------------------------------
// 香港档已核身但**不收录**（附理由，避免下次重复评估或凭印象补录）：
//   singpao.com        成报：2015 年清盘风波后编采主体几经变更、立场争议大，本轮 DeepSeek
//                      来源抽样亦零命中，暂不作为权威媒体纳入。
//   metrohk.com.hk     都市日报旧域名：2021-05 起被第三方重注册，现站含「示例数字，尚待
//                      接驳股票报价来源」等模板文案，具聚合/测试特征，非新闻机构官网。
//   cmdevfund.hk       中小企发展支援基金类域名：多轮检索无法核实站点主办身份；同类政策
//                      信息以 sme.gov.hk / tid.gov.hk 官方页为准，不入本名单。
// ------------------------------------------------------------
