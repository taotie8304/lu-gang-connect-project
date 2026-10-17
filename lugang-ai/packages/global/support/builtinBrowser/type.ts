// 鲁港通 - 办事浏览器类型（内置浏览器 P1）：
// 用户侧一律称「办事浏览器」，不暴露底层服务商；云端会话 ID 仅服务端使用。
export type BuiltinBrowserSessionStatus = 'active' | 'closed' | 'expired' | 'error';
export type BuiltinBrowserCloseReason = 'user' | 'timeout' | 'error';

export type BuiltinBrowserSessionSchemaType = {
  _id: string;
  teamId: string;
  tmbId: string;

  /** 云端会话 ID（仅服务端使用，不下发给前端） */
  cloudSessionId: string;
  /** 画面查看地址（含会话凭证，仅下发给会话归属人；关台后失效） */
  resourceUrl: string;
  /** 会话状态：进行中 / 用户关闭 / 到期回收 / 云端异常回收 */
  status: BuiltinBrowserSessionStatus;

  /** 开台时间 */
  openTime: Date;
  /** 到期时间（开台 + 时长上限；进程内巡检与请求时校验双向兜底关台） */
  expiresAt: Date;
  /** 关台时间 */
  closeTime?: Date;
  /** 关台原因：用户主动 / 到达时长上限 / 云端异常回收 */
  closeReason?: BuiltinBrowserCloseReason;
  /** 实际使用时长（毫秒，P2 计费结算依据） */
  durationMs?: number;

  createTime: Date;
  updateTime: Date;
};

/** 面板视口（CSS 像素）：前端实测右栏容器尺寸，服务端换算为云端窗口尺寸 */
export type BuiltinBrowserViewport = {
  width: number;
  height: number;
};

/** 开台（POST）请求体：面板实测视口（可缺省；缺省按服务端默认尺寸适配） */
export type OpenBuiltinBrowserSessionRequest = {
  viewport?: BuiltinBrowserViewport;
};

/** 开台（POST）响应：画面地址 + 剩余可用时长 */
export type OpenBuiltinBrowserSessionResponse = {
  /** 画面查看地址 */
  resourceUrl: string;
  /** 剩余分钟（向上取整，最小 1） */
  remainingMinutes: number;
  /** 到期时间（ISO 字符串） */
  expiresAt: string;
  /** 是否复用了已打开中的会话（双击/重复点击时不重复建台） */
  reused: boolean;
};

/** 查询（GET）响应：当前台状态（无会话时仅 active=false） */
export type GetBuiltinBrowserSessionStatusResponse = {
  active: boolean;
  /** 进行中时的画面地址 */
  resourceUrl?: string;
  /** 进行中时的剩余分钟（向上取整，最小 1） */
  remainingMinutes?: number;
  /** 进行中时的到期时间（ISO 字符串） */
  expiresAt?: string;
};

/** 视口跟随（PUT）响应：resized=false 表示当前无进行中会话或云端贴合失败（前端静默忽略） */
export type ResizeBuiltinBrowserSessionResponse = {
  resized: boolean;
};

/** 网址跳转（PATCH）请求体：用户在面板网址栏输入的网址（服务端归一化校验） */
export type NavigateBuiltinBrowserSessionRequest = {
  url: string;
};

/** 网址跳转（PATCH）响应：navigated=false 表示无进行中会话 / 网址非法 / 云端跳转失败（前端提示） */
export type NavigateBuiltinBrowserSessionResponse = {
  navigated: boolean;
};

/** 网页原地刷新（POST）响应：reloaded=false 表示无进行中会话 / 云端失败（前端提示） */
export type ReloadBuiltinBrowserSessionResponse = {
  reloaded: boolean;
};

/** 关台（DELETE）响应（幂等：无进行中会话时 closed=false） */
export type CloseBuiltinBrowserSessionResponse = {
  closed: boolean;
  /** 本次使用时长（分钟，向上取整，最小 1；P2 计费展示用） */
  durationMinutes?: number;
};

/** 用户可见标签页（隐藏占位标签不下发） */
export type BuiltinBrowserTab = {
  index: number;
  title: string;
  url: string;
  current: boolean;
};

/** 标签列表（GET）/ 新建标签（POST）响应 */
export type GetBuiltinBrowserTabsResponse = {
  tabs: BuiltinBrowserTab[];
};
export type NewBuiltinBrowserTabResponse = {
  tabs: BuiltinBrowserTab[];
};

/** 切换标签（PATCH）请求 / 响应：selected=false 表示无会话 / 索引非法 / 云端失败 */
export type SelectBuiltinBrowserTabRequest = {
  index: number;
};
export type SelectBuiltinBrowserTabResponse = {
  selected: boolean;
  /** 最新标签列表（前端据此对齐页面态） */
  tabs: BuiltinBrowserTab[];
};

/** 关闭标签（DELETE）请求 / 响应：closed=false 表示无会话 / 索引非法 / 云端失败 */
export type CloseBuiltinBrowserTabRequest = {
  index: number;
};
export type CloseBuiltinBrowserTabResponse = {
  closed: boolean;
  /** 剩余标签；关掉最后一个用户标签时服务端自动补空白标签 */
  tabs: BuiltinBrowserTab[];
};
