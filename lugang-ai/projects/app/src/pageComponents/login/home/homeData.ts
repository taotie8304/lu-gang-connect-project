// 鲁港通 - 首页 v4 的结构常量与文案类型；文案本体位于 i18n 的 home 命名空间

export const HOME_BRAND_NAME = '鲁港通';
export const HOME_BRAND_SUB = 'LUGANG CONNECT';
export const HOME_SERVICE_MAIL = 'service@airscend.com';

export const HOME_ANCHORS = {
  top: 'home-top',
  ability: 'home-ability',
  agent: 'home-agent',
  price: 'home-price',
  download: 'home-download',
  login: 'home-login',
  faq: 'home-faq'
} as const;

export const HOME_NAV_LINKS = [
  { href: `#${HOME_ANCHORS.top}` },
  { href: `#${HOME_ANCHORS.ability}` },
  { href: `#${HOME_ANCHORS.agent}` },
  { href: `#${HOME_ANCHORS.price}` },
  { href: '/about' }
];

export const HOME_MENU_LINKS = HOME_NAV_LINKS;

/** 文案 nav.links 与 footer.columns[i].links 按此顺序取标签 */
export const HOME_FOOTER_LINKS = [
  [
    { href: `#${HOME_ANCHORS.top}` },
    { href: `#${HOME_ANCHORS.ability}` },
    { href: `#${HOME_ANCHORS.price}` },
    { href: `#${HOME_ANCHORS.download}` }
  ],
  [{ href: '/about' }, { href: `#${HOME_ANCHORS.faq}` }, { href: `#${HOME_ANCHORS.agent}` }],
  [{ href: `mailto:${HOME_SERVICE_MAIL}` }, { href: '/help' }]
];

export const HOME_DOWNLOADS = {
  windows: 'https://www.airscend.com/desktop/updates/lugang-desktop-0.14.0-setup.exe',
  android: 'https://www.airscend.com/android/updates/lugang-android-0.2.4-204.apk'
};

/** 统计数字不参与翻译，与文案 stats.items 的下标一一对应 */
export const HOME_STAT_COUNTS = [6, 1200, 3, 24];
export const HOME_STAT_PREFIXES = ['', '', '<', ''];

/** 与文案 pricing.plans 的下标一一对应；年付 = 月价 × 10 */
export const HOME_PLAN_PRICES = [
  { month: 0, year: 0 },
  { month: 10, year: 100 },
  { month: 69, year: 690 },
  { month: 98, year: 980 }
];
export const HOME_FEATURED_PLAN = 2;

/** 与文案 personas.items / flow.steps 的下标一一对应 */
export const HOME_PERSONA_COUNT = 5;
export const HOME_FLOW_COUNT = 4;
/** 材料清单第 3 项为待补状态（0 基） */
export const HOME_FLOW_MISSING_CHECK = 2;

export type HomeNavCopy = {
  brandAria: string;
  brandSub: string;
  mainAria: string;
  menuAria: string;
  menuOpen: string;
  menuClose: string;
  links: string[];
  download: string;
  login: string;
  start: string;
  menuLogin: string;
};

export type HomeHeroCopy = {
  eyebrow: string;
  titleTop: string;
  titleAccent: string;
  lede: string;
  ctaPrimary: string;
  ctaSecondary: string;
  meta: string[];
  scroll: string;
  mascotSay: string;
  floats: string[];
};

export type HomeDemoCopy = {
  live: string;
  q1: string;
  a1Title: string;
  a1Steps: string[];
  srcOrg: string;
  srcDate: string;
  routeCap: string;
  routeFrom: string;
  routeFromSub: string;
  routeTo: string;
  routeToSub: string;
  routeMeta: string[];
  docTitle: string;
  docCount: string;
  docRows: string[][];
  note: string;
};

export type HomeLoginCopy = {
  title: string;
  sub: string;
};

export type HomeDownloadCopy = {
  title: string;
  winName: string;
  winVer: string;
  androidName: string;
  androidVer: string;
  arrow: string;
  note: string;
};

export type HomeStatsCopy = {
  items: { suffix: string; label: string }[];
};

export type HomePersonaItem = {
  question: string;
  asker: string;
  answer: string;
  points: string[];
  sources: string[];
};

export type HomePersonasCopy = {
  kicker: string;
  titleA: string;
  titleB: string;
  sub: string;
  askLabel: string;
  answerLabel: string;
  tabs: string[];
  items: HomePersonaItem[];
};

export type HomeFlowStep = {
  no: string;
  label: string;
  title: string;
  body: string;
  tags: string[];
};

export type HomeFlowCopy = {
  kicker: string;
  titleA: string;
  titleB: string;
  sub: string;
  steps: HomeFlowStep[];
  mini: {
    ask: string;
    queries: string[];
    source: string;
    verified: string;
    docTitle: string;
    docBody: string;
    checks: { text: string; state: string }[];
    confirm: string;
  };
};

export type HomeAgentCopy = {
  kicker: string;
  titleA: string;
  titleB: string;
  sub: string;
  feedHead: string;
  note: string;
  orbits: string[];
  feed: { time: string; text: string; state: string }[];
};

export type HomePlanCopy = {
  name: string;
  desc: string;
  credits: string;
  badge?: string;
  cta: string;
  feats: { text: string; off?: boolean }[];
};

export type HomePricingCopy = {
  kicker: string;
  titleA: string;
  titleB: string;
  sub: string;
  month: string;
  year: string;
  yearSave: string;
  priceUnit: { permanent: string; month: string; year: string };
  plans: HomePlanCopy[];
  serviceNote: string[];
  tableHint: string;
  tableHead: string[];
  tableRows: { label: string; cells: string[] }[];
  enterprise: { title: string; body: string; cta: string };
  notes: string[];
};

export type HomeFaqCopy = {
  kicker: string;
  title: string;
  /** 列表底部的「查看完整帮助中心」入口文案 */
  more: string;
  items: { q: string; a: string }[];
};

export type HomeFooterCopy = {
  tagline: string;
  columns: { title: string; links: string[] }[];
  bottom: string[];
};

export type HomeCopy = {
  nav: HomeNavCopy;
  hero: HomeHeroCopy;
  demo: HomeDemoCopy;
  login: HomeLoginCopy;
  download: HomeDownloadCopy;
  stats: HomeStatsCopy;
  marquee: { items: string[] };
  personas: HomePersonasCopy;
  flow: HomeFlowCopy;
  agent: HomeAgentCopy;
  pricing: HomePricingCopy;
  faq: HomeFaqCopy;
  footer: HomeFooterCopy;
};
