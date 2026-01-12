export enum SystemConfigsTypeEnum {
  fastgpt = 'fastgpt',
  fastgptPro = 'fastgptPro',
  systemMsgModal = 'systemMsgModal',
  license = 'license',
  operationalAd = 'operationalAd',
  lugangRegister = 'lugangRegister'  // 鲁港通注册配置
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
  [SystemConfigsTypeEnum.lugangRegister]: {
    label: 'lugangRegister'
  }
};
