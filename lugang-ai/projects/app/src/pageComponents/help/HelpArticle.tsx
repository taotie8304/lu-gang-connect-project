// 鲁港通 - 帮助中心文章页：目录跳转、结构化正文、常见问题、反馈与上下篇
import React, { useState } from 'react';
import Link from 'next/link';
import { LUGANG_SUPPORT_EMAIL } from '@/web/common/system/constants';
import type { HelpArticleData, HelpBlock } from './content';
import { useHelpTranslate } from './HelpI18n';

type HelpArticleProps = {
  data: HelpArticleData;
};

const renderInline = (text: string): React.ReactNode => {
  const parts = text.split('**');
  if (parts.length === 1) return text;
  return parts.map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : <React.Fragment key={index}>{part}</React.Fragment>
  );
};

const HelpArticle = ({ data }: HelpArticleProps) => {
  const t = useHelpTranslate();
  const { article, categoryTitle, prev, next, related } = data;
  const [helpful, setHelpful] = useState<'yes' | 'no' | null>(null);

  const tocItems = article.blocks
    .filter((block): block is Extract<HelpBlock, { type: 'h2' }> => block.type === 'h2')
    .map((block) => ({ id: block.id, text: block.text.replace(/\*\*/g, '') }));
  if (article.faq?.length) {
    tocItems.push({ id: 'faq', text: t('article.faq') });
  }

  const renderBlock = (block: HelpBlock, index: number) => {
    switch (block.type) {
      case 'p':
        return <p key={index}>{renderInline(block.text)}</p>;
      case 'h2':
        return (
          <h2 key={index} id={block.id}>
            {renderInline(block.text)}
          </h2>
        );
      case 'h3':
        return <h3 key={index}>{renderInline(block.text)}</h3>;
      case 'ul':
        return (
          <ul key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ))}
          </ul>
        );
      case 'ol':
        return (
          <ol key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      case 'tip':
      case 'note':
      case 'official': {
        const titles = {
          tip: t('article.calloutTip'),
          note: t('article.calloutNote'),
          official: t('article.calloutOfficial')
        };
        return (
          <div key={index} className={`hp-callout ${block.type}`}>
            <strong>{block.title || titles[block.type]}</strong>
            {renderInline(block.text)}
          </div>
        );
      }
      case 'table':
        return (
          <div key={index} className="hp-table-wrap">
            <div className="hp-table-hint">{t('article.tableHint')}</div>
            <div className="hp-table-scroll">
              <table>
                <thead>
                  <tr>
                    {block.head.map((cell, cellIndex) => (
                      <th key={cellIndex}>{renderInline(cell)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{renderInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'compare':
        return (
          <div key={index} className="hp-compare">
            {block.rows.map((row, rowIndex) => (
              <div key={rowIndex} className={`hp-compare-row ${row.tone}`}>
                <span className="hp-compare-label">{row.label}</span>
                <p>{renderInline(row.text)}</p>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <main>
      <div className="hp-wrap">
        <nav className="hp-breadcrumb" aria-label={t('article.crumbHome')}>
          <Link href="/help">{t('article.crumbHome')}</Link>
          <span aria-hidden="true">/</span>
          <span>{categoryTitle}</span>
          <span aria-hidden="true">/</span>
          <span>{article.title}</span>
        </nav>

        <details className="hp-mobile-toc">
          <summary>{t('article.toc')}</summary>
          <div>
            {tocItems.map((item) => (
              <a key={item.id} href={`#${item.id}`}>
                {item.text}
              </a>
            ))}
          </div>
        </details>

        <div className="hp-article-layout">
          <aside className="hp-toc" aria-label={t('article.toc')}>
            <div className="hp-toc-title">{t('article.toc')}</div>
            {tocItems.map((item) => (
              <a key={item.id} href={`#${item.id}`}>
                {item.text}
              </a>
            ))}
          </aside>

          <article className="hp-article">
            <span className="hp-article-tag">{categoryTitle}</span>
            <h1>{article.title}</h1>
            <div className="hp-article-meta">
              <span>{t('article.updated', { date: article.updatedAt })}</span>
              <span>{t('article.read', { count: article.readMinutes })}</span>
            </div>

            <div className="hp-article-lead">
              <strong>{t('article.lead')}</strong>
              <ul>
                {article.lead.map((item, index) => (
                  <li key={index}>{renderInline(item)}</li>
                ))}
              </ul>
            </div>

            {article.blocks.map((block, index) => renderBlock(block, index))}

            {article.faq && article.faq.length > 0 && (
              <>
                <h2 id="faq">{t('article.faq')}</h2>
                {article.faq.map((item) => (
                  <div className="hp-qa" key={item.q}>
                    <p className="q">{renderInline(item.q)}</p>
                    <p className="a">{renderInline(item.a)}</p>
                  </div>
                ))}
              </>
            )}

            <div className="hp-helpful">
              <span>{t('article.helpful')}</span>
              <button
                type="button"
                className={helpful === 'yes' ? 'is-selected' : undefined}
                aria-pressed={helpful === 'yes'}
                onClick={() => setHelpful('yes')}
              >
                {t('article.helpfulYes')}
              </button>
              <button
                type="button"
                className={helpful === 'no' ? 'is-selected' : undefined}
                aria-pressed={helpful === 'no'}
                onClick={() => setHelpful('no')}
              >
                {t('article.helpfulNo')}
              </button>
              {helpful && (
                <span className="hp-helpful-note">
                  {helpful === 'yes' ? t('article.helpfulThanks') : t('article.helpfulRecorded')}
                </span>
              )}
            </div>

            {related.length > 0 && (
              <div className="hp-related">
                <strong>{t('article.related')}</strong>
                {related.map((item) => (
                  <Link key={item.slug} href={`/help/${item.slug}`}>
                    {item.title} <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            )}

            <div className="hp-prev-next">
              <span>
                {t('article.prev')}：
                {prev ? <Link href={`/help/${prev.slug}`}>{prev.title}</Link> : t('article.none')}
              </span>
              <span>
                {t('article.next')}：
                {next ? <Link href={`/help/${next.slug}`}>{next.title} →</Link> : t('article.none')}
              </span>
            </div>

            <div className="hp-article-contact">
              <div>
                <strong>{t('article.contact')}</strong>
                <p>{t('article.contactSub')}</p>
              </div>
              <div className="hp-contact-actions">
                <Link href="/account/myTickets" className="hp-btn hp-btn-primary hp-btn-sm">
                  {t('home.ticket')}
                </Link>
                <a className="hp-btn hp-btn-ghost hp-btn-sm" href={`mailto:${LUGANG_SUPPORT_EMAIL}`}>
                  {LUGANG_SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          </article>
        </div>
      </div>

      <Link href="/account/myTickets" className="hp-mobile-contact">
        {t('home.ticket')}
      </Link>
    </main>
  );
};

export default HelpArticle;
