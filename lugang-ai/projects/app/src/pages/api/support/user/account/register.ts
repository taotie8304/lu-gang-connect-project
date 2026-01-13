/**
 * 鲁港通 - 用户注册 API
 * 用户注册后自动在鲁港通后端创建对应账户
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { connectToDatabase } from '@/service/mongo';
import { addLog } from '@fastgpt/service/common/system/log';
import { verifyAuthCode } from '../inform/sendAuthCode';
import { UserAuthTypeEnum } from '@fastgpt/global/support/user/auth/constants';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { createDefaultTeam } from '@fastgpt/service/support/user/team/controller';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { hashStr } from '@fastgpt/global/common/string/tools';
import { checkPasswordRule } from '@fastgpt/global/common/string/password';
import { createJWT, setCookie } from '@fastgpt/service/support/permission/controller';
import { getTmbInfoByTmbId } from '@fastgpt/service/support/user/team/controller';
import axios from 'axios';

// 在鲁港通后端创建用户
const createUserInBackend = async (username: string, password: string): Promise<void> => {
  const oneApiUrl = process.env.ONE_API_URL;
  const oneApiToken = process.env.ONE_API_TOKEN;

  if (!oneApiUrl || !oneApiToken) {
    addLog.warn('鲁港通后端配置不完整，跳过后端用户创建');
    return;
  }

  try {
    // 调用鲁港通后端 API 创建用户
    const response = await axios.post(
      `${oneApiUrl}/api/user/register`,
      {
        username,
        password,
        display_name: username.split('@')[0] // 使用邮箱前缀作为显示名
      },
      {
        headers: {
          'Authorization': `Bearer ${oneApiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data?.success) {
      addLog.info('鲁港通后端用户创建成功', { username });
    } else {
      addLog.warn('鲁港通后端用户创建返回异常', { username, response: response.data });
    }
  } catch (error: any) {
    // 如果是用户已存在的错误，忽略
    if (error.response?.data?.message?.includes('already exists') || 
        error.response?.data?.message?.includes('已存在')) {
      addLog.info('鲁港通后端用户已存在', { username });
      return;
    }
    addLog.error('鲁港通后端用户创建失败', { username, error: error.message });
    // 不抛出错误，允许前端注册继续
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }

    await connectToDatabase();
    
    const { username, password, code, inviterId } = req.body as {
      username: string;
      password: string;
      code: string;
      inviterId?: string;
    };

    // 参数验证
    if (!username || !password || !code) {
      return jsonRes(res, { code: 400, error: '参数不完整' });
    }

    // 验证密码规则
    if (!checkPasswordRule(password)) {
      return jsonRes(res, { 
        code: 400, 
        error: '密码必须包含大小写字母和数字，长度8-20位' 
      });
    }

    // 验证邮箱验证码
    if (!verifyAuthCode(username, code, UserAuthTypeEnum.register)) {
      return jsonRes(res, { code: 400, error: '验证码错误或已过期' });
    }

    // 检查用户是否已存在
    const existingUser = await MongoUser.findOne({ username });
    if (existingUser) {
      return jsonRes(res, { code: 400, error: '该邮箱已被注册' });
    }

    // 创建用户
    const userData = await mongoSessionRun(async (session) => {
      // 创建用户
      const [user] = await MongoUser.create(
        [{
          username,
          password: hashStr(password),
          avatar: '/icon/logo.png',
          timezone: 'Asia/Shanghai',
          status: 'active',
          createTime: new Date(),
          ...(inviterId ? { inviterId } : {})
        }],
        { session }
      );

      // 创建默认团队
      const tmb = await createDefaultTeam({
        userId: user._id.toString(),
        teamName: username.split('@')[0] + '的团队',
        avatar: '/icon/logo.png',
        session
      });

      return {
        odId: user._id.toString(),
        tmbId: tmb?._id.toString()
      };
    });

    if (!userData?.tmbId) {
      return jsonRes(res, { code: 500, error: '用户创建失败' });
    }

    // 在鲁港通后端创建对应用户（异步，不阻塞注册流程）
    createUserInBackend(username, password).catch((err) => {
      addLog.error('鲁港通后端用户创建异步失败', err);
    });

    // 获取用户信息
    const tmbInfo = await getTmbInfoByTmbId({ tmbId: userData.tmbId });

    // 生成 JWT token
    const token = createJWT(tmbInfo);
    setCookie(res, token);

    addLog.info('鲁港通用户注册成功', { username });

    return jsonRes(res, {
      data: {
        user: {
          odId: tmbInfo.userId,
          tmbId: tmbInfo.tmbId,
          teamId: tmbInfo.teamId,
          teamName: tmbInfo.teamName,
          avatar: tmbInfo.avatar,
          balance: tmbInfo.balance,
          permission: tmbInfo.permission,
          team: {
            teamId: tmbInfo.teamId,
            teamName: tmbInfo.teamName,
            avatar: tmbInfo.teamAvatar,
            balance: tmbInfo.balance,
            status: 'active'
          }
        },
        token
      }
    });
  } catch (error: any) {
    addLog.error('鲁港通用户注册失败', error);
    return jsonRes(res, {
      code: 500,
      error: error.message || '注册失败，请稍后再试'
    });
  }
}
