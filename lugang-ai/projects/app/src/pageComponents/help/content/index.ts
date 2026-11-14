// 鲁港通 - 帮助中心内容汇总与本地化（简体为基准，繁体由 opencc 在服务端派生）
import type {
  HelpArticle,
  HelpArticleData,
  HelpBlock,
  HelpCategory,
  HelpFaqItem,
  HelpHomeData
} from './types';
import { START_ARTICLES } from './start';
import { FEATURE_ARTICLES } from './features';
import { BILLING_ARTICLES } from './billing';
import { ACCOUNT_ARTICLES } from './account';

export type {
  HelpArticle,
  HelpArticleData,
  HelpBlock,
  HelpCategory,
  HelpFaqItem,
  HelpHomeData
} from './types';

export const HELP_ARTICLES: HelpArticle[] = [
  ...START_ARTICLES,
  ...FEATURE_ARTICLES,
  ...BILLING_ARTICLES,
  ...ACCOUNT_ARTICLES
];

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'start', title: '开始使用', icon: 'book', slugs: ['quick-start', 'ask-better', 'sources-and-freshness'] },
  {
    id: 'features',
    title: '核心能力',
    icon: 'shield',
    slugs: ['policy-qa', 'transport', 'school-finder', 'documents', 'memory', 'desktop-agent']
  },
  {
    id: 'billing',
    title: 'Credits 与付费',
    icon: 'coin',
    slugs: ['credits', 'plans-and-topup', 'checkin-voucher', 'orders-invoice-refund']
  },
  { id: 'clients', title: '客户端', icon: 'device', slugs: ['windows-desktop', 'android'] },
  { id: 'account', title: '账号与支持', icon: 'user', slugs: ['account-security', 'support'] },
  { id: 'legal', title: '法律与免责', icon: 'legal', slugs: [] }
];

export const HELP_ARTICLE_MAP = new Map(HELP_ARTICLES.map((article) => [article.slug, article]));

const HELP_HOT_KEYWORDS = ['高才通', '强积金', 'Credits', '发票'];

export const HELP_POPULAR_FAQS: HelpFaqItem[] = [
  {
    q: '免费版能用多久？包含多少 Credits？',
    a: '免费版长期可用，注册即赠 300 Credits；用完后可以每日打卡、购买 Credits 或升级套餐。'
  },
  {
    q: 'Credits 会过期吗？',
    a: '不会。Credits 保留在账号中，套餐到期或未续费都不会清零。'
  },
  {
    q: '买了套餐多久生效？可以叠加吗？',
    a: '支付完成后立即生效。在现有套餐有效期内购买新套餐，权益与 Credits 照常累加，未到期的时长自动顺延。'
  },
  {
    q: '代金券怎么用？一单能用几张？',
    a: '购买套餐或 Credits 时，下单前选择一张代金券抵扣；单笔订单最多使用一张，抵扣金额不超过订单应付金额。'
  },
  {
    q: '文档上传有什么限制？',
    a: '单次最多 8 个文件，单个文件不超过 20MB，支持 PDF、Word、Excel 等常见格式与图片；文档读取为体验版及以上能力。'
  },
  {
    q: '政策答案的官方出处在哪里看？',
    a: '政策类回答会标注来源机构与更新时间，可以回到官方原文核对；可靠来源不足时，助手会明确说明局限。'
  },
  {
    q: 'AI 控制浏览器代办在哪些版本可用？',
    a: '进阶版及以上，且仅在 Windows 桌面版提供。每一次点击、填写与提交都需要你确认。'
  },
  {
    q: '工单多久回复？',
    a: '所有套餐统一 24 小时内响应，不区分等级，也没有加急档位。'
  }
];

const mapBlock = (block: HelpBlock, convert: (value: string) => string): HelpBlock => {
  switch (block.type) {
    case 'p':
    case 'h2':
    case 'h3':
      return { ...block, text: convert(block.text) };
    case 'ul':
    case 'ol':
      return { ...block, items: block.items.map(convert) };
    case 'tip':
    case 'note':
    case 'official':
      return block.title
        ? { ...block, title: convert(block.title), text: convert(block.text) }
        : { ...block, text: convert(block.text) };
    case 'table':
      return {
        ...block,
        head: block.head.map(convert),
        rows: block.rows.map((row) => row.map(convert))
      };
    case 'compare':
      return {
        ...block,
        rows: block.rows.map((row) => ({ ...row, label: convert(row.label), text: convert(row.text) }))
      };
  }
};

const mapArticle = (article: HelpArticle, convert: (value: string) => string): HelpArticle => {
  const mapped: HelpArticle = {
    ...article,
    title: convert(article.title),
    summary: convert(article.summary),
    keywords: article.keywords.map(convert),
    lead: article.lead.map(convert),
    blocks: article.blocks.map((block) => mapBlock(block, convert))
  };
  if (article.faq) {
    mapped.faq = article.faq.map((item) => ({ q: convert(item.q), a: convert(item.a) }));
  } else {
    delete mapped.faq;
  }
  return mapped;
};

/**
 * 生成页面所需的完整内容。
 * @param convert 文本转换函数；繁体界面传入 opencc 的繁简转换，简体界面传入恒等函数。
 */
export function getHelpHomeData(convert: (value: string) => string = (value) => value): HelpHomeData {
  return {
    categories: HELP_CATEGORIES.map((category) => ({
      ...category,
      title: convert(category.title)
    })),
    articles: HELP_ARTICLES.map((article) => mapArticle(article, convert)),
    popularFaqs: HELP_POPULAR_FAQS.map((item) => ({ q: convert(item.q), a: convert(item.a) })),
    hotKeywords: HELP_HOT_KEYWORDS.map(convert)
  };
}

export function getHelpArticleData(
  slug: string,
  convert: (value: string) => string = (value) => value
): HelpArticleData | null {
  const index = HELP_ARTICLES.findIndex((article) => article.slug === slug);
  if (index === -1) return null;

  const article = mapArticle(HELP_ARTICLES[index], convert);
  const category = HELP_CATEGORIES.find((item) => item.id === article.category);
  const related = article.related
    .map((relatedSlug) => HELP_ARTICLES.find((item) => item.slug === relatedSlug))
    .filter((item): item is HelpArticle => !!item)
    .map((item) => mapArticle(item, convert));

  const prevArticle = index > 0 ? HELP_ARTICLES[index - 1] : null;
  const nextArticle = index < HELP_ARTICLES.length - 1 ? HELP_ARTICLES[index + 1] : null;

  return {
    article,
    categoryTitle: category ? convert(category.title) : '',
    prev: prevArticle ? mapArticle(prevArticle, convert) : null,
    next: nextArticle ? mapArticle(nextArticle, convert) : null,
    related
  };
}

/** 搜索用文本，全部使用当前界面语言的内容 */
export const getSearchText = (article: HelpArticle, categoryTitle: string) =>
  [
    article.title,
    article.summary,
    categoryTitle,
    article.keywords.join(' '),
    article.lead.join(' '),
    article.blocks
      .map((block) => {
        if (block.type === 'table') return [...block.head, ...block.rows.flat()].join(' ');
        if (block.type === 'compare') return block.rows.map((row) => row.text).join(' ');
        if ('items' in block) return block.items.join(' ');
        return block.text;
      })
      .join(' ')
  ]
    .join(' ')
    .toLowerCase();
