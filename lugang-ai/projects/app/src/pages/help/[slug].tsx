// 鲁港通 - 帮助中心文章页
import React from 'react';
import type { GetServerSidePropsContext } from 'next';
import { serviceSideProps } from '@/web/common/i18n/utils';
import HelpShell from '@/pageComponents/help/HelpShell';
import HelpArticle from '@/pageComponents/help/HelpArticle';
import HelpHead from '@/pageComponents/help/HelpHead';
import { useHelpTranslate } from '@/pageComponents/help/HelpI18n';
import { getHelpArticleData, type HelpArticleData } from '@/pageComponents/help/content';
import { getHelpLocale } from '@/pageComponents/help/HelpServer';

type HelpArticlePageProps = {
  data: HelpArticleData;
  showLangNotice: boolean;
};

const HelpArticlePage = ({ data, showLangNotice }: HelpArticlePageProps) => {
  const t = useHelpTranslate();

  return (
    <>
      <HelpHead
        title={t('meta.articleTitle', { title: data.article.title })}
        description={data.article.summary}
        path={`/help/${data.article.slug}`}
      />
      <HelpShell showLangNotice={showLangNotice}>
        <HelpArticle data={data} />
      </HelpShell>
    </>
  );
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const slug = context.params?.slug;
  const { convert, showLangNotice } = getHelpLocale(context);
  const data = typeof slug === 'string' ? getHelpArticleData(slug, convert) : null;

  if (!data) {
    return {
      redirect: {
        destination: '/help?missing=1',
        permanent: false
      }
    };
  }

  return {
    props: {
      data,
      showLangNotice,
      ...(await serviceSideProps(context, ['help']))
    }
  };
}

export default HelpArticlePage;
