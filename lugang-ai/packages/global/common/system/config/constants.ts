export enum SystemConfigsTypeEnum {
  fastgpt = 'fastgpt',
  fastgptPro = 'fastgptPro',
  systemMsgModal = 'systemMsgModal',
  license = 'license',
  operationalAd = 'operationalAd',
  activityAd = 'activityAd',
  lugangRegister = 'lugangRegister' // 鲁港通 - 注册配置（邮箱注册开关 + SMTP）
}

export const SystemConfigsTypeMap = {
  [SystemConfigsTypeEnum.fastgpt]: {
    label: 'fastgpt'
  },
  [SystemConfigsTypeEnum.fastgptPro]: {
    label: 'fastgptPro'
  },
  [SystemConfigsTypeEnum.systemMsgModal]: {
    label: 'systemMsgModal'
  },
  [SystemConfigsTypeEnum.license]: {
    label: 'license'
  },
  [SystemConfigsTypeEnum.operationalAd]: {
    label: 'operationalAd'
  },
  [SystemConfigsTypeEnum.activityAd]: {
    label: 'activityAd'
  },
  // 鲁港通 - 注册配置类型
  [SystemConfigsTypeEnum.lugangRegister]: {
    label: 'lugangRegister'
  }
};
