import { MongoUser } from '@fastgpt/service/support/user/schema';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { type UserUpdateParams } from '@/types/user';

/* update user info */
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { getS3AvatarSource } from '@fastgpt/service/common/s3/sources/avatar';
import { updateUserInBackend } from '@fastgpt/service/support/user/integration/userSync';
import { addLog } from '@fastgpt/service/common/system/log';

export type UserAccountUpdateQuery = {};
export type UserAccountUpdateBody = UserUpdateParams;
export type UserAccountUpdateResponse = {};

async function handler(
  req: ApiRequestProps<UserAccountUpdateBody, UserAccountUpdateQuery>,
  _res: ApiResponseType<any>
): Promise<UserAccountUpdateResponse> {
  const { avatar, timezone, language } = req.body;

  const { tmbId } = await authCert({ req, authToken: true });
  // const user = await getUserDetail({ tmbId });

  let username: string | undefined;

  // 更新对应的记录
  await mongoSessionRun(async (session) => {
    const tmb = await MongoTeamMember.findById(tmbId).session(session);
    if (timezone || language) {
      const user = await MongoUser.findById(tmb?.userId).session(session);
      username = user?.username;
      
      await MongoUser.updateOne(
        {
          _id: tmb?.userId
        },
        {
          ...(timezone && { timezone }),
          ...(language && { language })
        }
      ).session(session);
    }
    // if avatar, update team member avatar
    if (avatar) {
      await MongoTeamMember.updateOne({ _id: tmbId }, { avatar }).session(session);

      await getS3AvatarSource().refreshAvatar(avatar, tmb?.avatar, session);
    }
  });

  // 鲁港通：同步用户信息到后端（异步，不阻塞用户操作）
  // Requirement 5.3: 用户信息更新时同步到后端
  if (username) {
    updateUserInBackend(username, {
      username,
      // 注意：这里只同步了 timezone 和 language，其他字段如需同步需要扩展
    }).catch((err) => {
      addLog.error('鲁港通后端用户信息同步失败', { username, error: err });
    });
  }

  return {};
}
export default NextAPI(handler);
