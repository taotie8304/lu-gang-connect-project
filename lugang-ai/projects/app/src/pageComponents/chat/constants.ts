export enum ChatSidebarPaneEnum {
  SETTING = 's',
  ALL_APPS = 'aa',
  RECENTLY_USED_APPS = 'ra',

  // these two features are only available in the commercial version
  HOME = 'h'
}

/**
 * 0: expanded
 * 1: folded
 */
export type CollapseStatusType = 0 | 1;
export const defaultCollapseStatus: CollapseStatusType = 0; // default expanded

export enum ChatSettingTabOptionEnum {
  HOME = 'h',
  DATA_DASHBOARD = 'd',
  LOG_DETAILS = 'l',
  FAVOURITE_APPS = 'f'
}

// 鲁港通 - 品牌化：侧边栏/首页横幅默认图改用鲁港通 banner（D1 已补图片资源但漏改常量，导致全站仍显示 FastGPT 品牌）
// 该常量被 ChatSliderHeader/HomepageSetting 引用；收起态由 MobileHomeHero 使用 COLLAPSED 版本
export const DEFAULT_LOGO_BANNER_URL = '/imgs/chat/lugang_banner.svg';
export const DEFAULT_LOGO_BANNER_COLLAPSED_URL = '/imgs/chat/lugang_banner_fold.svg';
