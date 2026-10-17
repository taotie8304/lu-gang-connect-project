// 鲁港通 - 办事浏览器常量（内置浏览器 P1）
/** 单次会话时长上限（分钟）：到期自动关台，可重开 */
export const BUILTIN_BROWSER_SESSION_MAX_MINUTES = 30;
/** 到期提醒阈值（分钟）：剩余不足该值时面板提示 */
export const BUILTIN_BROWSER_REMIND_BEFORE_MINUTES = 5;
/** 灰度账号用户名白名单（P1 先测 root + jinhui，稳定后扩；注意为完整登录名） */
export const BUILTIN_BROWSER_ALLOWED_USERNAMES = ['root', 'jinhui@airscend.com'];

// 鲁港通 - 查看器裁切几何（探针实测 probe24/25/26）：云端页面内容位于查看器坐标 (14, 99) 起，
// 面板内嵌画面按 CROP_* 偏移裁掉云窗口外框（豆包式固定画面，画面不可拖动、不可移动）
export const BUILTIN_BROWSER_CROP_TOP_PX = 100;
export const BUILTIN_BROWSER_CROP_LEFT_PX = 14;
/** 云端窗口高度 = 面板高度 + 该余量：页面底缘落到裁切窗下缘之外，防底缘露缝或被裁（实测 4 最优） */
export const BUILTIN_BROWSER_HEIGHT_EXTRA_PX = 4;

/** 面板宽度：默认 / 拖拽下限 / 拖拽上限（CSS 像素）
 * 上限与云端视口上限 1600 对齐；实际可拖到的宽度还受窗口宽度约束（见 panelWidth.ts） */
export const BUILTIN_BROWSER_PANEL_DEFAULT_WIDTH = 480;
export const BUILTIN_BROWSER_PANEL_MIN_WIDTH = 360;
export const BUILTIN_BROWSER_PANEL_MAX_WIDTH = 1600;
/** 窗口右侧保留区（侧栏 + 最小聊天区，Qoder 实测 1713 窗口面板可到 1308 = 1713 − 405） */
export const BUILTIN_BROWSER_PANEL_RESERVED_WIDTH = 405;
/** 面板宽度记忆的本地存储键 */
export const BUILTIN_BROWSER_PANEL_WIDTH_STORAGE_KEY = 'lugang_builtin_browser_panel_width';
