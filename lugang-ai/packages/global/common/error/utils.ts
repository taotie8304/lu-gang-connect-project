import { replaceSensitiveText } from '../string/tools';
import { ERROR_RESPONSE } from './errorCode';
import type { localeType } from '../i18n/type';
import { parseI18nString } from '../i18n/utils';

// Chrome/WebView、Safari、Firefox、Electron 的网络失败原文
const NETWORK_ERROR_TEXT =
  /^(failed to fetch|load failed|fetch failed|networkerror.*|net::err_\w+|the network connection was lost\.?|the request timed out\.?|a server with the specified hostname could not be found\.?)$/i;

export const getErrText = (err: any, def = '', lang?: localeType): any => {
  const parseI18nError = (value: any): string | undefined => {
    if (!lang || !value || typeof value !== 'object') return;

    if (typeof value.en === 'string') {
      return parseI18nString(value, lang);
    }
  };

  const getRawMsg = (e: any): any => {
    if (typeof e === 'string') return e;
    if (!e) return '';
    return (
      e.system_error_text ||
      e.errorText ||
      parseI18nError(e.response?.data?.error?.reason) ||
      parseI18nError(e.response?.error?.reason) ||
      parseI18nError(e.error?.reason) ||
      parseI18nError(e.response?.data?.reason) ||
      parseI18nError(e.response?.reason) ||
      parseI18nError(e.reason) ||
      e.response?.data?.message ||
      e.response?.message ||
      e.response?.data?.msg ||
      e.response?.msg ||
      e.message ||
      e.msg ||
      (typeof e.error === 'string' ? e.error : getRawMsg(e.error)) ||
      e.code ||
      ''
    );
  };

  const msg = getRawMsg(err) || def;

  // 鲁港通 - 浏览器/WebView 的原生网络错误是英文且不可操作，统一转为可翻译的友好文案
  if (typeof msg === 'string' && NETWORK_ERROR_TEXT.test(msg.trim())) {
    return 'common:error.network_unstable';
  }

  if (ERROR_RESPONSE[msg]) {
    return ERROR_RESPONSE[msg].message;
  }

  // Axios special
  if (err?.errors && Array.isArray(err.errors) && err.errors.length > 0) {
    return err.errors[0].message;
  }

  // msg && console.log('error =>', msg);
  return replaceSensitiveText(msg);
};

export const getErrResponse = (err: any): any => {
  return err?.response?.data || err?.response || err;
};

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

/**
 * 表示错误提示已经由业务侧自行展示，通用请求层应跳过重复 toast。
 */
export class ToastHandledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToastHandledError';
  }
}
