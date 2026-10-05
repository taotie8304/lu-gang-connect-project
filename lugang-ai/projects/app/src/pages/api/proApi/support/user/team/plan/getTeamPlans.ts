// 鲁港通 - 套餐详情列表（本地顶替商业版 proApi 通道；返回当前团队全部订阅套餐记录，按过期时间升序）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamSub } from '@fastgpt/service/support/wallet/sub/schema';
import type { GetTeamPlansResponseType } from '@fastgpt/global/openapi/support/user/team/api';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<GetTeamPlansResponseType> {
  const { teamId } = await authCert({ req, authToken: true });

  const plans = await MongoTeamSub.find({ teamId }).sort({ expiredTime: 1 }).lean();

  // 鲁港通 - lean() 返回的 ObjectId 需转为字符串以匹配官方契约
  return plans.map((plan) => ({
    ...plan,
    _id: String(plan._id),
    teamId: String(plan.teamId)
  })) as unknown as GetTeamPlansResponseType;
}

export default NextAPI(handler);
