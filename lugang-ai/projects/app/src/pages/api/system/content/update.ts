/**
 * 鲁港通 - 更新系统内容 API
 * PUT /api/system/content/update
 * 
 * 仅管理员可以访问，用于更新使用条款、隐私政策等内容
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { updateSystemContent } from '@fastgpt/service/support/systemContent/controller';
import type { SystemContentUpdateParams } from '@fastgpt/global/support/systemContent/type';
import { SystemContentKeyEnum } from '@fastgpt/global/support/systemContent/constant';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const { key, title, content, contentType } = req.body as SystemContentUpdateParams;

  if (!key || !content) {
    return Promise.reject('Missing required parameters');
  }

  // 验证 key 是否有效
  if (!Object.values(SystemContentKeyEnum).includes(key as SystemContentKeyEnum)) {
    return Promise.reject('Invalid content key');
  }

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
    const updatedContent = await updateSystemContent(
      { key, title, content, contentType },
      user._id.toString()
    );

    return updatedContent;
  } catch (error: any) {
    console.error('鲁港通：更新系统内容失败', { key, error: error.message });
    return Promise.reject('Failed to update system content');
  }
}

export default NextAPI(handler);
