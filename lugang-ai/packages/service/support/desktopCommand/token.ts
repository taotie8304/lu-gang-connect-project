// 鲁港通 - 桌面设备令牌（P2 阶段一）：只在注册时返回明文，服务端仅保存 sha256
import { createHash, randomBytes } from 'node:crypto';
import { DESKTOP_TOKEN_PREFIX } from './constant';

export const DESKTOP_TOKEN_PATTERN = /^lgd_[A-Za-z0-9_-]{43}$/;

export const createDesktopToken = () =>
  `${DESKTOP_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;

export const hashDesktopToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export const parseBearerToken = (authorization?: string | string[]) => {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!header) return undefined;

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1];
};
