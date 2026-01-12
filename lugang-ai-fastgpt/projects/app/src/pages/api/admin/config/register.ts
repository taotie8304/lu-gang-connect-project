/**
 * 鲁港通 - 注册配置管理接口
 * 
 * GET /api/admin/config/register - 获取配置
 * POST /api/admin/config/register - 保存配置
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoSystemConfigs } from '@fastgpt/service/common/system/config/schema';
import { SystemConfigsTypeEnum } from '@fastgpt/global/common/system/config/constants';
import { addLog } from '@fastgpt/service/common/system/log';

// 配置类型
export interface RegisterConfig {
  emailRegisterEnabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
}

const CONFIG_KEY = SystemConfigsTypeEnum.lugangRegister;

const defaultConfig: RegisterConfig = {
  emailRegisterEnabled: true,
  smtp: {
    host: '',
    port: 465,
    secure: true,
    user: '',
    pass: '',
    from: ''
  }
};

async function handler(
  req: ApiRequestProps<RegisterConfig, {}>,
  _res: ApiResponseType<RegisterConfig>
): Promise<RegisterConfig> {
  // 验证管理员权限
  const { isRoot } = await authCert({ req, authToken: true, authRoot: true });
  
  if (!isRoot) {
    throw new Error('Permission denied: Admin access required');
  }

  if (req.method === 'GET') {
    // 获取配置
    const configDoc = await MongoSystemConfigs.findOne({ type: CONFIG_KEY });
    
    if (configDoc?.value) {
      return configDoc.value as RegisterConfig;
    }
    
    return defaultConfig;
  }

  if (req.method === 'POST') {
    // 保存配置
    const newConfig = req.body;
    
    // 验证配置
    if (typeof newConfig.emailRegisterEnabled !== 'boolean') {
      throw new Error('Invalid emailRegisterEnabled value');
    }
    
    if (newConfig.smtp) {
      if (newConfig.smtp.port && (newConfig.smtp.port < 1 || newConfig.smtp.port > 65535)) {
        throw new Error('Invalid SMTP port');
      }
    }

    // 保存到数据库
    await MongoSystemConfigs.findOneAndUpdate(
      { type: CONFIG_KEY },
      {
        type: CONFIG_KEY,
        value: newConfig,
        updateTime: new Date()
      },
      { upsert: true }
    );

    addLog.info('Register config updated', { 
      emailRegisterEnabled: newConfig.emailRegisterEnabled,
      smtpHost: newConfig.smtp?.host 
    });

    return newConfig;
  }

  throw new Error('Method not allowed');
}

export default NextAPI(handler);
