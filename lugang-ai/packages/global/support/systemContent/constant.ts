/**
 * 鲁港通 - 系统内容常量定义
 */

export enum SystemContentKeyEnum {
  termsOfUse = 'terms_of_use',
  privacyPolicy = 'privacy_policy',
  dataCollection = 'data_collection'
}

export const systemContentKeyMap = {
  [SystemContentKeyEnum.termsOfUse]: {
    label: '使用條款',
    defaultTitle: '使用條款',
    defaultContent: '# 使用條款\n\n使用條款內容待管理員配置。'
  },
  [SystemContentKeyEnum.privacyPolicy]: {
    label: '隱私政策',
    defaultTitle: '隱私政策',
    defaultContent: '# 隱私政策\n\n隱私政策內容待管理員配置。'
  },
  [SystemContentKeyEnum.dataCollection]: {
    label: '個人資料收集聲明',
    defaultTitle: '個人資料收集聲明',
    defaultContent: '# 個人資料收集聲明\n\n個人資料收集聲明內容待管理員配置。'
  }
};
