import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { uploadSingleFile } from '@fastgpt/web/common/file/uploader/single';

vi.mock('axios', () => ({
  default: {
    put: vi.fn(),
    isCancel: vi.fn(() => false)
  }
}));

const putMock = vi.mocked(axios.put);

const createFile = () =>
  ({
    name: '香港高才通截图.png',
    size: 5,
    slice: () => ({})
  }) as unknown as File;

const t = (key: string) => key;

const createParams = () => ({
  url: 'https://www.airscend.com/api/system/file/u/token',
  file: createFile(),
  headers: { 'content-type': 'image/png' },
  t
});

describe('uploadSingleFile', () => {
  beforeEach(() => {
    putMock.mockReset();
  });

  it('should resolve when proxy returns json success', async () => {
    putMock.mockResolvedValue({
      data: { code: 200, statusText: '', message: '', data: { success: true } },
      headers: { 'content-type': 'application/json' }
    } as any);

    await expect(uploadSingleFile(createParams())).resolves.toBeUndefined();
  });

  it('should reject html block page returned with success status', async () => {
    putMock.mockResolvedValue({
      data: '<html><body>宝塔免费WAF提醒您,Nginx缓冲区溢出</body></html>',
      headers: { 'content-type': 'text/html' }
    } as any);

    await expect(uploadSingleFile(createParams())).rejects.toBe('common:error.s3_upload_blocked');
  });

  it('should reject server error page with actionable message', async () => {
    putMock.mockRejectedValue({
      response: {
        status: 502,
        headers: { 'content-type': 'text/html' },
        data: '<html><body>502 Bad Gateway</body></html>'
      }
    });

    await expect(uploadSingleFile(createParams())).rejects.toBe(
      'common:error.s3_upload_service_unavailable'
    );
  });
});
