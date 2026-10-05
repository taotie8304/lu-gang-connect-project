// 鲁港通 - N4 用量趋势聚合（本地顶替商业版 proApi 通道，账户中心「用量明细」趋势图数据源）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { Types } from '@fastgpt/service/common/mongo';
import { MongoUsage } from '@fastgpt/service/support/wallet/usage/schema';
import type {
  GetUsageDashboardProps,
  GetUsageDashboardResponseItem
} from '@fastgpt/global/support/wallet/usage/api';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<GetUsageDashboardResponseItem[]> {
  const { teamId, tmbId, isRoot } = await authCert({ req, authToken: true });

  const {
    dateStart,
    dateEnd,
    sources,
    teamMemberIds,
    unit = 'day'
  } = req.body as GetUsageDashboardProps;

  // 鲁港通 - 个人积分账户：普通用户仅统计自己的用量趋势（忽略客户端传入的成员筛选），管理员可查团队全部
  const memberFilter = isRoot ? teamMemberIds : [String(tmbId)];

  const match = {
    teamId: new Types.ObjectId(teamId),
    ...(dateStart || dateEnd
      ? {
          time: {
            ...(dateStart ? { $gte: new Date(dateStart) } : {}),
            ...(dateEnd ? { $lte: new Date(dateEnd) } : {})
          }
        }
      : {}),
    ...(sources?.length ? { source: { $in: sources } } : {}),
    ...(memberFilter?.length
      ? { tmbId: { $in: memberFilter.map((id) => new Types.ObjectId(id)) } }
      : {})
  };

  const list = await MongoUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          // 按部署面向的东八区切日/月，避免 UTC 存储导致凌晨用量记到前一天
          $dateToString: {
            format: unit === 'month' ? '%Y-%m' : '%Y-%m-%d',
            date: '$time',
            timezone: 'Asia/Shanghai'
          }
        },
        totalPoints: { $sum: '$totalPoints' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // date 返回日期字符串：前端 dayjs 按浏览器本地时区解析，无需再做序列化换算
  return list.map((item) => ({
    date: item._id,
    totalPoints: item.totalPoints
  })) as unknown as GetUsageDashboardResponseItem[];
}

export default NextAPI(handler);
