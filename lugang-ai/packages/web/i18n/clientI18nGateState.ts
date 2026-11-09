import { getLangMapping } from './utils';

type ClientI18nGateStateInput = {
  i18nLanguage: string;
  initialLanguage: string;
  settled: boolean;
  hasCompleteBundle: (language: string) => boolean;
};

/**
 * 鲁港通 - 语言闸门就绪判定：首次挂载按存储目标语言等待就绪；
 * 初始化完成后只以 i18n 当前语言为准，避免用户切换窗口内存储未提交时被反向拉回。
 */
export const resolveClientI18nGateReady = ({
  i18nLanguage,
  initialLanguage,
  settled,
  hasCompleteBundle
}: ClientI18nGateStateInput) => {
  if (!settled) {
    return i18nLanguage === initialLanguage && hasCompleteBundle(initialLanguage);
  }
  return hasCompleteBundle(getLangMapping(i18nLanguage));
};
