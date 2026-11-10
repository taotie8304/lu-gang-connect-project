// 鲁港通 - 帮助中心文案读取：help 命名空间为对象分节结构，统一在此收窄类型
import { useTranslation } from 'next-i18next';

export type HelpTranslate = (
  key: string,
  options?: Record<string, string | number | boolean | undefined>
) => string;

export const useHelpTranslate = (): HelpTranslate => {
  const { t } = useTranslation('help');
  return t as unknown as HelpTranslate;
};

export const useHelpSection = <T,>(key: string): T => {
  const { t } = useTranslation('help');
  const translateSection = t as unknown as (
    sectionKey: string,
    options: { returnObjects: true }
  ) => unknown;
  return translateSection(key, { returnObjects: true }) as T;
};
