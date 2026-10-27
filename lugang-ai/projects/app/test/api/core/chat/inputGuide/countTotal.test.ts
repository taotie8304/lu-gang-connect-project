import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import type { ApiRequestProps } from '@fastgpt/next/type';

const mocks = vi.hoisted(() => ({
  authCert: vi.fn(),
  authApp: vi.fn(),
  countDocuments: vi.fn()
}));

vi.mock('@/service/middleware/entry', () => ({
  NextAPI: (handler: unknown) => handler
}));

vi.mock('@fastgpt/service/support/permission/auth/common', () => ({
  authCert: mocks.authCert
}));

vi.mock('@fastgpt/service/support/permission/app/auth', () => ({
  authApp: mocks.authApp
}));

vi.mock('@fastgpt/service/core/chat/inputGuide/schema', () => ({
  MongoChatInputGuide: {
    countDocuments: mocks.countDocuments
  }
}));

import handler from '@/pages/api/core/chat/inputGuide/countTotal';

const appId = '507f1f77bcf86cd799439011';
const countTotalHandler = handler as unknown as (req: ApiRequestProps) => Promise<unknown>;
const buildRequest = () => ({ query: { appId }, body: {} }) as unknown as ApiRequestProps;

describe('inputGuide countTotal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authCert.mockResolvedValue(undefined);
    mocks.authApp.mockResolvedValue({});
    mocks.countDocuments.mockResolvedValue(3);
  });

  it('requires app read permission before counting guided questions', async () => {
    const req = buildRequest();

    await expect(countTotalHandler(req)).resolves.toEqual({ total: 3 });

    expect(mocks.authApp).toHaveBeenCalledWith({
      req,
      appId,
      authToken: true,
      per: ReadPermissionVal
    });
  });

  it('does not count when the caller lacks app read permission', async () => {
    mocks.authApp.mockRejectedValue(new Error('unAuthApp'));

    await expect(countTotalHandler(buildRequest())).rejects.toThrow('unAuthApp');
    expect(mocks.countDocuments).not.toHaveBeenCalled();
  });
});
