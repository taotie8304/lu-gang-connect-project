// 鲁港通 - 个人积分账户详情（本地顶替商业版 proApi 通道，账户中心「我的积分」卡片数据源）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { getOrInitUserPoints } from '@fastgpt/service/support/wallet/points/controller';
import { StandardSubLevelEnum } from '@fastgpt/global/support/wallet/sub/constants';
import type { UserPointsDetailType } from '@fastgpt/global/support/wallet/points/type';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<UserPointsDetailType> {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  // 账户不存在时按免费档额度懒初始化（与对话门槛共用同一补水逻辑）
  const account = await getOrInitUserPoints({ teamId, tmbId });

  return {
    surplusPoints: account?.surplusPoints ?? 0,
    totalPoints: account?.totalPoints ?? 0,
    currentSubLevel: account?.currentSubLevel ?? StandardSubLevelEnum.free,
    currentMode: account?.currentMode,
    expiredTime: account?.expiredTime ?? undefined
  };
}

export default NextAPI(handler);
