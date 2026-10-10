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
  'weebly.com'
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
