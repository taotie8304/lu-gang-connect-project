import { useTranslation } from 'next-i18next';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import ClientI18nErrorFallback from './ClientI18nErrorFallback';
import {
  getClientLanguagePreference,
  getLangMapping,
  getRequiredI18nLanguages,
  persistLanguagePreference
} from './utils';
import { changeLanguageAtomically } from './atomicLanguageChange';
import { I18N_NAMESPACES } from './constants';
import { resolveClientI18nGateReady } from './clientI18nGateState';

type ClientI18nGateProps = {
  defaultLanguage: string;
  storageKey: string;
  fallback: ReactNode;
  children: ReactNode;
};

const ClientI18nGate = ({
  defaultLanguage,
  storageKey,
  fallback,
  children
}: ClientI18nGateProps) => {
  const { i18n } = useTranslation();
  // 鲁港通 - 目标语言只在挂载时解析一次：用户切换期间存储晚于 i18n.language 提交，
  // 若每次渲染都重新读存储，会把刚切走的语言再反向切回来，形成乒乓卡死。
  const initialLanguage = useMemo(
    () => getLangMapping(getClientLanguagePreference(storageKey) || defaultLanguage),
    [storageKey, defaultLanguage]
  );
  const [settledLanguage, setSettledLanguage] = useState<string>();
  const settled = settledLanguage !== undefined;

  const hasCompleteBundle = useCallback(
    (language: string) =>
      getRequiredI18nLanguages(getLangMapping(language)).every((requiredLanguage) =>
        I18N_NAMESPACES.every((namespace) => i18n.hasResourceBundle(requiredLanguage, namespace))
      ),
    [i18n]
  );

  const ready = resolveClientI18nGateReady({
    i18nLanguage: i18n.language || '',
    initialLanguage,
    settled,
    hasCompleteBundle
  });

  const [loadError, setLoadError] = useState<{ language: string; error: unknown }>();

  useEffect(() => {
    if (settled) return;

    let active = true;

    if (ready) {
      // SSR 已经提供完整资源时无需再次切换，但仍要把首次访问语言提交到权威存储。
      Promise.resolve()
        .then(() => persistLanguagePreference(initialLanguage, storageKey))
        .then(() => {
          if (active) setSettledLanguage(initialLanguage);
        })
        .catch((error) => {
          if (active) setLoadError({ language: initialLanguage, error });
        });
      return () => {
        active = false;
      };
    }

    changeLanguageAtomically({
      i18n,
      language: initialLanguage,
      storageKey
    })
      .then(() => {
        if (active) setSettledLanguage(initialLanguage);
      })
      .catch((error) => {
        if (active) setLoadError({ language: initialLanguage, error });
      });

    return () => {
      active = false;
    };
  }, [i18n, initialLanguage, ready, settled, storageKey]);

  if (loadError?.language === initialLanguage) {
    return <ClientI18nErrorFallback language={initialLanguage} error={loadError.error} />;
  }
  if (ready) return children;
  return fallback;
};

export default ClientI18nGate;
