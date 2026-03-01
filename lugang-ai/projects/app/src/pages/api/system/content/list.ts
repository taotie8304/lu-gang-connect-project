/**
 * 鲁港通 - 获取系统内容列表 API
 * GET /api/system/content/list
 * 
 * 仅管理员可以访问，用于管理后台显示所有系统内容
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { getAllSystemContents } from '@fastgpt/service/support/systemContent/controller';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  // 鲁港通：验证用户身份和管理员权限
  const { tmbId } = await authCert({ req, authToken: true });
  
  const tmb = await MongoTeamMember.findById(tmbId);
  if (!tmb) {
    return Promise.reject('User not found');
  }

  const user = await MongoUser.findById(tmb.userId);
  if (!user) {
    return Promise.reject('User not found');
  }

  // 鲁港通：检查是否为管理员（username === 'root'）
  if (user.username !== 'root') {
    return Promise.reject('Permission denied: Admin only');
  }

  try {
    const contents = await getAllSystemContents();
    return contents;
  } catch (error: any) {
    console.error('鲁港通：获取系统内容列表失败', { error: error.message });
    return Promise.reject('Failed to get system contents');
  }
}

export default NextAPI(handler);
