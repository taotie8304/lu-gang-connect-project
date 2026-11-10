// 鲁港通 - 帮助中心内容类型：正文以结构化块存储，便于目录、提示块与移动端渲染

export type HelpCategoryId = 'start' | 'features' | 'billing' | 'clients' | 'account' | 'legal';

export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; id: string; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'tip' | 'note' | 'official'; title?: string; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'compare'; rows: { tone: 'bad' | 'good'; label: string; text: string }[] };

export type HelpFaqItem = { q: string; a: string };

export type HelpArticle = {
  slug: string;
  category: HelpCategoryId;
  title: string;
  summary: string;
  keywords: string[];
  updatedAt: string;
  readMinutes: number;
  lead: string[];
  blocks: HelpBlock[];
  faq?: HelpFaqItem[];
  related: string[];
};

export type HelpCategory = {
  id: HelpCategoryId;
  title: string;
  icon: 'book' | 'shield' | 'coin' | 'device' | 'user' | 'legal';
  slugs: string[];
};

export type HelpHomeData = {
  categories: HelpCategory[];
  articles: HelpArticle[];
  popularFaqs: HelpFaqItem[];
  hotKeywords: string[];
};

export type HelpArticleData = {
  article: HelpArticle;
  categoryTitle: string;
  prev: HelpArticle | null;
  next: HelpArticle | null;
  related: HelpArticle[];
};
