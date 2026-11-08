// 鲁港通 - 首页 v4：营销首屏、工作台、能力、流程、智能体、价格与常见问题
import React, { useRef } from 'react';
import { useTranslation } from 'next-i18next';
import type { LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';
import HomeNav from './HomeNav';
import HomeHero from './HomeHero';
import HomeWorkbench from './HomeWorkbench';
import HomeStats from './HomeStats';
import HomePersonas from './HomePersonas';
import HomeFlow from './HomeFlow';
import HomeAgent from './HomeAgent';
import HomePricing from './HomePricing';
import HomeFaq from './HomeFaq';
import HomeFooter from './HomeFooter';
import type { HomeCopy } from './homeData';
import { HOME_ANCHORS } from './homeData';
import { HOME_CSS } from './HomeCss';
import { useHomeEffects } from './useHomeEffects';

const HomePage = ({
  onSuccess
}: {
  onSuccess: (res: LoginSuccessResponseType) => void | Promise<void>;
}) => {
  const { t } = useTranslation('home');
  const rootRef = useRef<HTMLDivElement>(null);
  // 鲁港通 - 文案按段落整体取回对象，避免逐个键映射
  const translateSection = t as unknown as (
    key: string,
    options: { returnObjects: true }
  ) => unknown;
  const section = <K extends keyof HomeCopy>(key: K) =>
    translateSection(key, { returnObjects: true }) as HomeCopy[K];

  const copy: HomeCopy = {
    nav: section('nav'),
    hero: section('hero'),
    demo: section('demo'),
    login: section('login'),
    download: section('download'),
    stats: section('stats'),
    marquee: section('marquee'),
    personas: section('personas'),
    flow: section('flow'),
    agent: section('agent'),
    pricing: section('pricing'),
    faq: section('faq'),
    footer: section('footer')
  };

  useHomeEffects(rootRef);

  return (
    <div className="lg-home" ref={rootRef}>
      <style>{HOME_CSS}</style>
      <div className="h5-progress" aria-hidden="true" />
      <HomeNav copy={copy.nav} />
      <main id={HOME_ANCHORS.top}>
        <HomeHero copy={copy.hero} />
        <HomeWorkbench
          demo={copy.demo}
          login={copy.login}
          download={copy.download}
          onSuccess={onSuccess}
        />
        <HomeStats copy={copy.stats} marquee={copy.marquee.items} />
        <HomePersonas copy={copy.personas} />
        <HomeFlow copy={copy.flow} />
        <HomeAgent copy={copy.agent} />
        <HomePricing copy={copy.pricing} />
        <HomeFaq copy={copy.faq} />
      </main>
      <HomeFooter copy={copy.footer} />
    </div>
  );
};

export default HomePage;
