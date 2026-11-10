// 鲁港通 - 帮助中心首页：搜索、快速上手、分类目录、热门问题、法律入口与联系支持
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { LUGANG_SUPPORT_EMAIL } from '@/web/common/system/constants';
import type { HelpCategory, HelpHomeData } from './content';
import { getSearchText } from './content';
import { useHelpSection, useHelpTranslate } from './HelpI18n';

type HelpHomeProps = {
  data: HelpHomeData;
  /** 文章不存在跳回首页时的提示 */
  missing?: boolean;
};

const QUICK_SLUGS = ['quick-start', 'credits', 'windows-desktop'];

const LEGAL_CHIP_KEYS = [
  'common:system_content.terms_of_use',
  'common:system_content.privacy_policy',
  'common:system_content.data_collection',
  'common:system_content.paid_service_agreement',
  'common:system_content.payment_privacy_policy',
  'common:system_content.ai_output_disclaimer'
];

const CategoryIcon = ({ icon }: { icon: HelpCategory['icon'] }) => {
  switch (icon) {
    case 'book':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 19V6.5A1.5 1.5 0 0 1 6.5 5H18v14H6.5A1.5 1.5 0 0 1 5 17.5Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 9h7M8 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'shield':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3.5 19 6v5.4c0 4.1-2.8 7.5-7 9.1-4.2-1.6-7-5-7-9.1V6l7-2.5Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="m9.2 11.8 1.9 1.9 3.7-3.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'coin':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 7.5v9M14.7 9.4c-.5-.8-1.5-1.2-2.7-1.2-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2c1.9.3 2.9 1 2.9 2.2 0 1.3-1.2 2.1-2.9 2.1-1.3 0-2.3-.5-2.8-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'device':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5" width="16" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
          <path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'user':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="9" r="3.4" stroke="currentColor" strokeWidth="1.7" />
          <path d="M5.5 19c.8-3 3.3-4.6 6.5-4.6s5.7 1.6 6.5 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 4v16M5 8h14M7 8v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
  }
};

const HelpHome = ({ data, missing = false }: HelpHomeProps) => {
  const t = useHelpTranslate();
  const quick = useHelpSection<{ title: string; sub: string }[]>('home.quick');

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const articleBySlug = useMemo(
    () => new Map(data.articles.map((article) => [article.slug, article])),
    [data.articles]
  );

  const searchIndex = useMemo(
    () =>
      data.articles.map((article) => {
        const category = data.categories.find((item) => item.id === article.category);
        const categoryTitle = category ? category.title : '';
        return { article, categoryTitle, text: getSearchText(article, categoryTitle) };
      }),
    [data.articles, data.categories]
  );

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return [];
    return searchIndex.filter((item) => item.text.includes(keyword)).slice(0, 8);
  }, [query, searchIndex]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  const hasQuery = query.trim().length > 0;

  return (
    <main>
      {missing && (
        <div className="hp-wrap">
          <div className="hp-missing-notice" role="status">
            {t('notFound')}
          </div>
        </div>
      )}

      <section className="hp-hero">
        <div className="hp-wrap">
          <span className="hp-hero-eyebrow">{t('home.eyebrow')}</span>
          <h1>{t('home.title')}</h1>
          <p className="hp-hero-sub">{t('home.sub')}</p>

          <div className="hp-search" ref={searchRef}>
            <svg className="hp-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder={t('search.placeholder')}
              autoComplete="off"
              aria-label={t('search.aria')}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => {
                if (query.trim()) setSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSearchOpen(false);
              }}
            />

            {searchOpen && hasQuery && (
              <div className="hp-search-results" role="region" aria-label={t('search.resultsAria')}>
                {results.length === 0 ? (
                  <div className="hp-result-empty">
                    {t('search.empty', { query: query.trim() })}
                    <br />
                    <span>{t('search.emptyHint')}</span>
                  </div>
                ) : (
                  results.map(({ article, categoryTitle }) => (
                    <Link
                      key={article.slug}
                      href={`/help/${article.slug}`}
                      className="hp-result-item"
                      onClick={() => setSearchOpen(false)}
                    >
                      <span className="hp-result-cat">{categoryTitle}</span>
                      <span className="hp-result-title">{article.title}</span>
                      <span className="hp-result-sum">{article.summary}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="hp-hot-chips">
            <span>{t('search.hotLabel')}</span>
            {data.hotKeywords.map((keyword) => (
              <button
                key={keyword}
                type="button"
                className="hp-chip"
                onClick={() => {
                  setQuery(keyword);
                  setSearchOpen(true);
                  inputRef.current?.focus();
                }}
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="hp-quick" aria-label={t('home.categoriesTitle')}>
        <div className="hp-wrap hp-quick-grid">
          {quick.map((item, index) => {
            const slug = QUICK_SLUGS[index];
            return (
              <Link key={slug} href={`/help/${slug}`} className="hp-quick-card">
                <span className="hp-quick-no">{`0${index + 1}`}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.sub}</p>
                </div>
                <span className="hp-quick-arrow" aria-hidden="true">→</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="hp-section">
        <div className="hp-wrap">
          <div className="hp-section-head">
            <div>
              <h2>{t('home.categoriesTitle')}</h2>
              <p>{t('home.categoriesSub')}</p>
            </div>
            <span className="hp-section-note">{t('home.categoriesNote')}</span>
          </div>

          <div className="hp-cat-grid">
            {data.categories.map((category) => {
              const isLegal = category.id === 'legal';
              return (
                <div className="hp-cat-card" key={category.id} id={`cat-${category.id}`}>
                  <div className="hp-cat-head">
                    <span className="hp-cat-icon" aria-hidden="true">
                      <CategoryIcon icon={category.icon} />
                    </span>
                    <span className="hp-cat-title">{category.title}</span>
                    <span className="hp-cat-count">
                      {isLegal
                        ? t('home.legalCount')
                        : t('home.articleCount', { count: category.slugs.length })}
                    </span>
                  </div>
                  <div className="hp-cat-links">
                    {isLegal ? (
                      <Link href="/help/legal" className="hp-cat-link">
                        {t('legal.title')} <span className="hp-arrow" aria-hidden="true">›</span>
                      </Link>
                    ) : (
                      category.slugs.map((slug) => {
                        const article = articleBySlug.get(slug);
                        if (!article) return null;
                        return (
                          <Link key={slug} href={`/help/${slug}`} className="hp-cat-link">
                            {article.title} <span className="hp-arrow" aria-hidden="true">›</span>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="hp-section">
        <div className="hp-wrap">
          <div className="hp-section-head">
            <div>
              <h2>{t('home.popularTitle')}</h2>
              <p>{t('home.popularSub')}</p>
            </div>
          </div>
          <div className="hp-popular">
            {data.popularFaqs.map((item) => (
              <details className="hp-faq" key={item.q}>
                <summary>{item.q}</summary>
                <p className="hp-faq-a">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="hp-section">
        <div className="hp-wrap hp-legal-band">
          <div>
            <h2>{t('home.legalBandTitle')}</h2>
            <p>{t('home.legalBandSub')}</p>
          </div>
          <div className="hp-legal-chips">
            {LEGAL_CHIP_KEYS.map((key, index) => (
              <Link
                key={key}
                href="/help/legal"
                className={`hp-legal-chip${index === LEGAL_CHIP_KEYS.length - 1 ? ' is-new' : ''}`}
              >
                {t(key)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="hp-section">
        <div className="hp-wrap hp-contact-band">
          <div>
            <h3>{t('home.contactTitle')}</h3>
            <p>{t('home.contactSub')}</p>
          </div>
          <div className="hp-contact-actions">
            <Link href="/account/myTickets" className="hp-btn hp-btn-primary">
              {t('home.ticket')}
            </Link>
            <a className="hp-btn hp-btn-ghost" href={`mailto:${LUGANG_SUPPORT_EMAIL}`}>
              {LUGANG_SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HelpHome;
