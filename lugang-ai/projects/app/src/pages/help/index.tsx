// 鲁港通 - 帮助中心首页
import React from 'react';
import type { GetServerSidePropsContext } from 'next';
import { serviceSideProps } from '@/web/common/i18n/utils';
import HelpShell from '@/pageComponents/help/HelpShell';
import HelpHome from '@/pageComponents/help/HelpHome';
import HelpHead from '@/pageComponents/help/HelpHead';
import { useHelpTranslate } from '@/pageComponents/help/HelpI18n';
import { getHelpHomeData, type HelpHomeData } from '@/pageComponents/help/content';
import { getHelpLocale } from '@/pageComponents/help/HelpServer';

type HelpPageProps = {
  data: HelpHomeData;
  showLangNotice: boolean;
  missing: boolean;
};

const HelpPage = ({ data, showLangNotice, missing }: HelpPageProps) => {
  const t = useHelpTranslate();

  return (
    <>
      <HelpHead title={t('meta.homeTitle')} description={t('meta.homeDescription')} path="/help" />
      <HelpShell showLangNotice={showLangNotice}>
        <HelpHome data={data} missing={missing} />
      </HelpShell>
    </>
  );
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { convert, showLangNotice } = getHelpLocale(context);

  return {
    props: {
      data: getHelpHomeData(convert),
      showLangNotice,
      missing: context.query.missing === '1',
      ...(await serviceSideProps(context, ['help']))
    }
  };
}

export default HelpPage;
