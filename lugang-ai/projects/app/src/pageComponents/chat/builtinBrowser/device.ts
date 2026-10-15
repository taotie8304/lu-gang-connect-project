// 鲁港通 - 办事浏览器设备判定（内置浏览器 P1）：
// 口径：手机（手机网页与未来手机 App）不开放；iPad/平板与 PC/Mac 桌面（网页与客户端）可用。
// 不用宽度判断（手机横屏可达 932px、iPad 竖屏仅 768px），只看手机特征；
// iPad 桌面模式 UA 伪装成 Macintosh + Mobile，故「Mobile」仅在 Android/鸿蒙语境下才视为手机
const PHONE_ONLY_PATTERN = /iphone|ipod|windows phone|blackberry|iemobile|opera mini/i;

export const isPhoneUserAgent = (ua: string): boolean => {
  if (PHONE_ONLY_PATTERN.test(ua)) return true;
  if (/android/i.test(ua) && /mobile/i.test(ua)) return true;
  if (/openharmony/i.test(ua) && /mobile/i.test(ua)) return true;
  return false;
};
