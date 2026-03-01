// 鲁港通 - 系统配置控制器
import { SystemConfigsTypeEnum } from '@fastgpt/global/common/system/config/constants';
import { MongoSystemConfigs } from './schema';
import { type FastGPTConfigFileType } from '@fastgpt/global/common/system/types';
import { FastGPTProUrl } from '../constants';
import { type LicenseDataType } from '@fastgpt/global/common/system/types';

// 鲁港通 - 从数据库获取 FastGPT 配置
export const getFastGPTConfigFromDB = async (): Promise<{
  fastgptConfig: FastGPTConfigFileType;
  licenseData?: LicenseDataType;
}> => {
  // 鲁港通 - 未配置商业版时返回空配置
  if (!FastGPTProUrl) {
    return {
      fastgptConfig: {} as FastGPTConfigFileType
    };
  }

  const [fastgptConfig, licenseConfig] = await Promise.all([
    MongoSystemConfigs.findOne({
      type: SystemConfigsTypeEnum.fastgpt
    }).sort({
      createTime: -1
    }),
    MongoSystemConfigs.findOne({
      type: SystemConfigsTypeEnum.license
    }).sort({
      createTime: -1
    })
  ]);

  const config = fastgptConfig?.value || {};
  const licenseData = licenseConfig?.value?.data as LicenseDataType | undefined;

  const fastgptConfigTime = fastgptConfig?.createTime.getTime().toString();
  const licenseConfigTime = licenseConfig?.createTime.getTime().toString();
  // 鲁港通 - 利用配置文件的创建时间（更新时间）来做缓存，如果前端命中缓存，则不需要再返回配置文件
  global.systemInitBufferId = fastgptConfigTime
    ? `${fastgptConfigTime}-${licenseConfigTime}`
    : undefined;

  return {
    fastgptConfig: config as FastGPTConfigFileType,
    licenseData
  };
};

// 鲁港通 - 更新 FastGPT 配置缓存
export const updateFastGPTConfigBuffer = async () => {
  const res = await MongoSystemConfigs.findOne({
    type: SystemConfigsTypeEnum.fastgpt
  }).sort({
    createTime: -1
  });

  if (!res) return;

  res.createTime = new Date();
  await res.save();

  global.systemInitBufferId = res.createTime.getTime().toString();
};

// 鲁港通 - 重新加载 FastGPT 配置缓存
export const reloadFastGPTConfigBuffer = async () => {
  const res = await MongoSystemConfigs.findOne({
    type: SystemConfigsTypeEnum.fastgpt
  }).sort({
    createTime: -1
  });
  if (!res) return;
  global.systemInitBufferId = res.createTime.getTime().toString();
};
