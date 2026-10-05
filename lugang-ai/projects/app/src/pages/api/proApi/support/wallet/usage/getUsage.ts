// 鲁港通 - N4 用量明细查询（本地顶替商业版 proApi 通道，账户中心「用量明细」页数据源）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { parsePaginationRequest } from '@fastgpt/service/common/api/pagination';
import { addSourceMember } from '@fastgpt/service/support/user/utils';
import { replaceRegChars } from '@fastgpt/global/common/string/tools';
import { MongoUsage } from '@fastgpt/service/support/wallet/usage/schema';
import { MongoUsageItem } from '@fastgpt/service/support/wallet/usage/usageItemSchema';
import type { GetUsageProps } from '@fastgpt/global/support/wallet/usage/api';
import type { UsageListItemType } from '@fastgpt/global/support/wallet/usage/type';
import type { PaginationResponse } from '@fastgpt/global/openapi/api';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<PaginationResponse<UsageListItemType>> {
  const { teamId } = await authCert({ req, authToken: true });

  const { dateStart, dateEnd, sources, teamMemberIds, projectName } = req.body as GetUsageProps;
  const { pageSize, offset } = parsePaginationRequest(req);

  const where = {
    teamId,
    ...(dateStart || dateEnd
      ? {
          time: {
            ...(dateStart ? { $gte: new Date(dateStart) } : {}),
            ...(dateEnd ? { $lte: new Date(dateEnd) } : {})
          }
        }
      : {}),
    ...(sources?.length ? { source: { $in: sources } } : {}),
    ...(teamMemberIds?.length ? { tmbId: { $in: teamMemberIds } } : {}),
    ...(projectName ? { appName: { $regex: replaceRegChars(projectName), $options: 'i' } } : {})
  };

  const [usages, total] = await Promise.all([
    MongoUsage.find(where).sort({ time: -1 }).skip(offset).limit(pageSize).lean(),
    MongoUsage.countDocuments(where)
  ]);

  const usageItems = await MongoUsageItem.find({
    usageId: { $in: usages.map((usage) => usage._id) }
  }).lean();

  const listWithMember = await addSourceMember({
    list: usages.map((usage) => ({ ...usage, tmbId: String(usage.tmbId) }))
  });

  return {
    total,
    list: listWithMember.map((usage) => ({
      id: String(usage._id),
      time: usage.time,
      appName: usage.appName,
      source: usage.source,
      totalPoints: usage.totalPoints,
      sourceMember: usage.sourceMember,
      list: usageItems
        .filter((item) => String(item.usageId) === String(usage._id))
        .map((item) => ({
          moduleName: item.name,
          amount: item.amount,
          model: item.model,
          inputTokens: item.inputTokens,
          outputTokens: item.outputTokens,
          charsLength: item.charsLength,
          duration: item.duration,
          pages: item.pages,
          count: item.count
        }))
    }))
  };
}

export default NextAPI(handler);
