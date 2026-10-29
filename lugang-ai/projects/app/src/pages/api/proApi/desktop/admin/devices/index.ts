// 鲁港通 - 桌面设备总览（仅 root）：补充成员账号名，便于定位问题设备
import type { ApiRequestProps } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { listDesktopDevices } from '@fastgpt/service/support/desktopCommand/store';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import type { ListDesktopDevicesResponse } from '@fastgpt/global/support/desktopCommand/type';

async function handler(req: ApiRequestProps): Promise<ListDesktopDevicesResponse> {
  if (req.method !== 'GET') {
    throw new Error('请求方法不支持');
  }

  const { isRoot } = await authCert({ req, authToken: true });
  if (!isRoot) {
    throw new Error('仅管理员可以查看桌面设备');
  }

  const devices = await listDesktopDevices();
  if (devices.length === 0) return { devices };

  const members = await MongoTeamMember.find({
    _id: { $in: [...new Set(devices.map((device) => device.tmbId))] }
  })
    .select('name')
    .lean();
  const nameMap = new Map(members.map((member) => [String(member._id), member.name]));

  return {
    devices: devices.map((device) => ({ ...device, memberName: nameMap.get(device.tmbId) }))
  };
}

export default NextAPI(handler);
