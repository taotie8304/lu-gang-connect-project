// 鲁港通 - 帮助中心法律与免责页：复用系统内容弹窗，不在帮助中心重复维护正文
import React, { useState } from 'react';
import Link from 'next/link';
import { SystemContentKeyEnum } from '@fastgpt/global/support/systemContent/constant';
import SystemContentModal from '@/components/SystemContentModal';
import { useHelpTranslate } from './HelpI18n';

type LegalRow = {
  key: `${SystemContentKeyEnum}`;
  copyKey: string;
  isNew?: boolean;
};

export const LEGAL_ROWS: LegalRow[] = [
  { key: SystemContentKeyEnum.termsOfUse, copyKey: 'terms_of_use' },
  { key: SystemContentKeyEnum.privacyPolicy, copyKey: 'privacy_policy' },
  { key: SystemContentKeyEnum.dataCollection, copyKey: 'data_collection' },
  { key: SystemContentKeyEnum.paidServiceAgreement, copyKey: 'paid_service_agreement' },
  { key: SystemContentKeyEnum.paymentPrivacyPolicy, copyKey: 'payment_privacy_policy' },
  { key: SystemContentKeyEnum.aiOutputDisclaimer, copyKey: 'ai_output_disclaimer', isNew: true }
];

const HelpLegal = () => {
  const t = useHelpTranslate();
  const [activeKey, setActiveKey] = useState<`${SystemContentKeyEnum}` | null>(null);

  return (
    <main>
      <div className="hp-wrap">
        <nav className="hp-breadcrumb" aria-label={t('legal.crumb')}>
          <Link href="/help">{t('article.crumbHome')}</Link>
          <span aria-hidden="true">/</span>
          <span>{t('legal.crumb')}</span>
        </nav>

        <section className="hp-legal-hero">
          <span className="hp-article-tag">{t('legal.tag')}</span>
          <h1>{t('legal.title')}</h1>
          <p>{t('legal.sub')}</p>
        </section>

        <div className="hp-legal-list">
          {LEGAL_ROWS.map((row, index) => {
            const title = t(`common:system_content.${row.copyKey}`);
            return (
              <div className="hp-legal-row" key={row.key}>
                <span className="hp-legal-num">{`0${index + 1}`.slice(-2)}</span>
                <div className="hp-legal-main">
                  <h2>
                    {title}
                    {row.isNew && <span className="hp-badge-new">{t('legal.new')}</span>}
                  </h2>
                  <p>{t(`legal.desc.${row.copyKey}`)}</p>
                </div>
                <span className="hp-legal-meta">{row.isNew ? t('legal.draftMeta') : t('legal.reuse')}</span>
                <button type="button" className="hp-btn hp-btn-ghost hp-btn-sm" onClick={() => setActiveKey(row.key)}>
                  {t('legal.view')}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <SystemContentModal
        isOpen={activeKey !== null}
        onClose={() => setActiveKey(null)}
        contentKey={activeKey ?? SystemContentKeyEnum.termsOfUse}
        title={activeKey ? t(`common:system_content.${LEGAL_ROWS.find((row) => row.key === activeKey)?.copyKey}`) : ''}
      />
    </main>
  );
};

export default HelpLegal;
