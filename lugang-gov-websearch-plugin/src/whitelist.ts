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
