// 鲁港通 - 帮助中心法律与免责页
import React from 'react';
import type { GetServerSidePropsContext } from 'next';
import { serviceSideProps } from '@/web/common/i18n/utils';
import HelpShell from '@/pageComponents/help/HelpShell';
import HelpLegal from '@/pageComponents/help/HelpLegal';
import HelpHead from '@/pageComponents/help/HelpHead';
import { useHelpTranslate } from '@/pageComponents/help/HelpI18n';
import { getHelpLocale } from '@/pageComponents/help/HelpServer';

type HelpLegalPageProps = {
  showLangNotice: boolean;
};

const HelpLegalPage = ({ showLangNotice }: HelpLegalPageProps) => {
  const t = useHelpTranslate();

  return (
    <>
      <HelpHead title={t('meta.legalTitle')} description={t('legal.sub')} path="/help/legal" />
      <HelpShell showLangNotice={showLangNotice} footerNote={t('legal.footerNote')}>
        <HelpLegal />
      </HelpShell>
    </>
  );
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { showLangNotice } = getHelpLocale(context);

  return {
    props: {
      showLangNotice,
      ...(await serviceSideProps(context, ['help']))
    }
  };
}

export default HelpLegalPage;
