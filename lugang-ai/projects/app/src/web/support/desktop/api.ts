// 鲁港通 - 桌面设备与运维管理的前端请求封装
import { GET, POST } from '@/web/common/api/request';
import type {
  DesktopSwitchState,
  ListDesktopCrashReportsResponse,
  ListDesktopDevicesResponse,
  UnbindDesktopDeviceResponse,
  UpdateDesktopAiSwitchRequest
} from '@fastgpt/global/support/desktopCommand/type';

/** 管理页：AI 操控开关（仅 root） */
export const getDesktopSwitchState = () =>
  GET<DesktopSwitchState>('/proApi/desktop/admin/settings');

export const updateDesktopSwitchState = (data: UpdateDesktopAiSwitchRequest) =>
  POST<DesktopSwitchState>('/proApi/desktop/admin/settings', data);

/** 管理页：全部桌面设备（仅 root） */
export const getAdminDesktopDevices = () =>
  GET<ListDesktopDevicesResponse>('/proApi/desktop/admin/devices');

export const unbindAdminDesktopDevice = (deviceId: string) =>
  POST<UnbindDesktopDeviceResponse>('/proApi/desktop/admin/devices/unbind', { deviceId });

/** 管理页：崩溃报告（仅 root） */
export const getAdminDesktopCrashReports = () =>
  GET<ListDesktopCrashReportsResponse>('/proApi/desktop/admin/crashes');

/** 设置面板「我的设备」：只看本人绑定 */
export const getMyDesktopDevices = () => GET<ListDesktopDevicesResponse>('/proApi/desktop/devices');

export const unbindMyDesktopDevice = (deviceId: string) =>
  POST<UnbindDesktopDeviceResponse>('/proApi/desktop/devices/unbind', { deviceId });
