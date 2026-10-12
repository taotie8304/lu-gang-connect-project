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
  'judiciary.hk' // 司法机构
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
  'mpfinance.com'
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
  'phoenixtv.com'
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
