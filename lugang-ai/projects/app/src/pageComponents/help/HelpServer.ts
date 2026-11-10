// 鲁港通 - 帮助中心 SSR 语言处理：繁体由 opencc 派生，英文/韩文显示语言提示
import type { GetServerSidePropsContext } from 'next';
import { getLangMapping, LANG_KEY } from '@fastgpt/web/i18n/utils';
import { LangEnum } from '@fastgpt/global/common/i18n/type';
import { simplifiedToTraditional } from '@fastgpt/service/common/string/cjkNormalizer';

export const getHelpLocale = (context: GetServerSidePropsContext) => {
  const lang = getLangMapping(context.req.cookies?.[LANG_KEY] || context.locale || '');
  return {
    convert: lang === LangEnum.zh_Hant ? simplifiedToTraditional : (value: string) => value,
    showLangNotice: lang === LangEnum.en || lang === LangEnum.ko_KR
  };
};
