// 鲁港通 - N4 用量明细导出（本地实现 CSV，顶替商业版 proApi 通道；列头固定简体中文，面向平台主要用户）
import type { ApiRequestProps } from '@fastgpt/next/type';
import type { NextApiResponse } from 'next';
import dayjs from 'dayjs';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { responseWriteController } from '@fastgpt/service/common/response';
import { sanitizeCsvField } from '@fastgpt/service/common/file/csv';
import { replaceRegChars } from '@fastgpt/global/common/string/tools';
import { getTimezoneCodeFromStr } from '@fastgpt/global/common/time/timezone';
import { MongoUsage } from '@fastgpt/service/support/wallet/usage/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import type { GetUsageProps } from '@fastgpt/global/support/wallet/usage/api';
import type { UsageSchemaType } from '@fastgpt/global/support/wallet/usage/type';
import {
  assertMemberRateLimit,
  MemberRateLimitPolicy
} from '@fastgpt/service/common/rateLimit/interface/member';

async function handler(req: ApiRequestProps, res: NextApiResponse) {
  const { teamId, tmbId } = await authCert({ req, authToken: true });
  await assertMemberRateLimit({
    policy: MemberRateLimitPolicy.ExportUsage,
    memberId: String(tmbId)
  });

  const {
    dateStart,
    dateEnd,
    sources,
    teamMemberIds,
    projectName,
    appNameMap = {},
    sourcesMap = {}
  } = (req.body ?? {}) as GetUsageProps & {
    appNameMap?: Record<string, string>;
    sourcesMap?: Record<string, { label?: string }>;
  };

  const timezoneCode = getTimezoneCodeFromStr(dateStart || '');

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

  const members = await MongoTeamMember.find({ teamId }, 'name').lean();

  res.setHeader('Content-Type', 'text/csv; charset=utf-8;');
  res.setHeader('Content-Disposition', 'attachment; filename=usage.csv; ');

  const cursor = MongoUsage.find(where).sort({ time: -1 }).limit(50000).cursor();
  const write = responseWriteController({ res, readStream: cursor });

  write(`\uFEFF时间,成员,类型,应用,消耗积分`);

  cursor.on('data', (doc) => {
    const usage = doc as unknown as UsageSchemaType;
    const time = usage.time
      ? dayjs(usage.time).utcOffset(timezoneCode).format('YYYY-MM-DD HH:mm:ss')
      : '';
    const member = members.find((item) => String(item._id) === String(usage.tmbId))?.name || '-';
    const sourceLabel = sourcesMap[usage.source]?.label || usage.source;
    const appLabel = appNameMap[usage.appName] || usage.appName;

    const row = [time, member, sourceLabel, appLabel, usage.totalPoints ?? 0]
      .map((value) => sanitizeCsvField(value == null ? '' : String(value)))
      .join(',');
    write(`\n${row}`);
  });

  cursor.on('end', () => {
    cursor.close();
    res.end();
  });

  cursor.on('error', () => {
    res.status(500);
    res.end();
  });
}

export default NextAPI(handler);
