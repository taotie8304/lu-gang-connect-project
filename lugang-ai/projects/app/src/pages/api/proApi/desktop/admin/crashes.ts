// 鲁港通 - 桌面崩溃报告列表（仅 root）：最近 50 条，补充成员账号名
import type { ApiRequestProps } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { listDesktopCrashReports } from '@fastgpt/service/support/desktopCommand/crashReportStore';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import type { ListDesktopCrashReportsResponse } from '@fastgpt/global/support/desktopCommand/type';

async function handler(req: ApiRequestProps): Promise<ListDesktopCrashReportsResponse> {
  if (req.method !== 'GET') {
    throw new Error('请求方法不支持');
  }

  const { isRoot } = await authCert({ req, authToken: true });
  if (!isRoot) {
    throw new Error('仅管理员可以查看崩溃报告');
  }

  const reports = await listDesktopCrashReports({ limit: 50 });
  if (reports.length === 0) return { reports };

  const members = await MongoTeamMember.find({
    _id: { $in: [...new Set(reports.map((report) => report.tmbId))] }
  })
    .select('name')
    .lean();
  const nameMap = new Map(members.map((member) => [String(member._id), member.name]));

  return {
    reports: reports.map((report) => ({
      ...report,
      memberName: nameMap.get(report.tmbId)
    }))
  };
}

export default NextAPI(handler);
