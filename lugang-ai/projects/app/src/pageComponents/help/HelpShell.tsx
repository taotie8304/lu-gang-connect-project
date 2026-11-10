// 鲁港通 - 帮助中心统一外壳：吸顶导航、语言提示与极简页脚
import React from 'react';
import Link from 'next/link';
import ThinkingFace from '@/components/common/ThinkingFace';
import { HOME_BRAND_NAME } from '@/pageComponents/login/home/homeData';
import { HELP_CSS } from './HelpCss';
import { useHelpTranslate } from './HelpI18n';

type HelpShellProps = {
  children: React.ReactNode;
  /** 非简繁界面（英文 / 韩文）显示「暂以简体中文提供」提示 */
  showLangNotice?: boolean;
  footerNote?: string;
};

const HelpShell = ({ children, showLangNotice = false, footerNote }: HelpShellProps) => {
  const t = useHelpTranslate();

  return (
    <div className="lg-help">
      <style>{HELP_CSS}</style>

      <header className="hp-header">
        <div className="hp-wrap">
          <Link href="/help" className="hp-brand" aria-label={`${HOME_BRAND_NAME} ${t('brandSub')}`}>
            <ThinkingFace size={36} />
            <span className="hp-brand-text">
              <span className="hp-brand-name">{HOME_BRAND_NAME}</span>
              <span className="hp-brand-sub">{t('brandSub')}</span>
            </span>
          </Link>

          <nav className="hp-header-nav" aria-label={t('nav.aria')}>
            <Link href="/help">{t('nav.home')}</Link>
            <Link href="/help/quick-start">{t('nav.guide')}</Link>
            <Link href="/help/credits">{t('nav.credits')}</Link>
            <Link href="/help/legal">{t('nav.legal')}</Link>
          </nav>

          <div className="hp-header-actions">
            <Link href="/" className="hp-btn hp-btn-ghost">
              {t('nav.backHome')}
            </Link>
            <Link href="/login" className="hp-btn hp-btn-primary">
              {t('nav.start')}
            </Link>
          </div>
        </div>
      </header>

      {showLangNotice && <div className="hp-lang-notice">{t('langNotice')}</div>}

      {children}

      <footer className="hp-footer">
        <div className="hp-wrap">
          <span>© {new Date().getFullYear()} {HOME_BRAND_NAME} Airscend</span>
          <span>{footerNote || t('home.footerData')}</span>
        </div>
      </footer>
    </div>
  );
};

export default HelpShell;
