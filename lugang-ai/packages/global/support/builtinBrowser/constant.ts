// 鲁港通 - 办事浏览器常量（内置浏览器 P1）
/** 单次会话时长上限（分钟）：到期自动关台，可重开 */
export const BUILTIN_BROWSER_SESSION_MAX_MINUTES = 30;
/** 到期提醒阈值（分钟）：剩余不足该值时面板提示 */
export const BUILTIN_BROWSER_REMIND_BEFORE_MINUTES = 5;
/** 灰度账号用户名白名单（P1 先测 root + jinhui，稳定后扩；注意为完整登录名） */
export const BUILTIN_BROWSER_ALLOWED_USERNAMES = ['root', 'jinhui@airscend.com'];
