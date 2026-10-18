// 鲁港通 - 去掉 UA 中的 Electron 与客户端标识，避免站点把内嵌浏览器判为不支持环境
export const stripElectronFromUserAgent = (ua: string): string =>
  ua
    .replace(/\sElectron\/[^\s]+/gi, '')
    .replace(/\slugang-desktop\/[^\s]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
