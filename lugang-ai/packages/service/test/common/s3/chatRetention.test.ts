// 鲁港通 - 对话文件 7 天保留：环境变量边界、用户上传 TTL 与预签名解耦
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, addHours, differenceInHours } from 'date-fns';
import { createVitestStorageMock } from '@fastgpt-sdk/storage';
import {
  DEFAULT_CHAT_FILE_RETENTION_DAYS,
  MAX_CHAT_FILE_RETENTION_DAYS,
  MIN_CHAT_FILE_RETENTION_DAYS,
  getChatFileRetentionDays
} from '@fastgpt/service/common/s3/sources/chat/retention';
import { MongoS3TTL } from '@fastgpt/service/common/s3/models/ttl';
import type { S3ChatSource } from '@fastgpt/service/common/s3/sources/chat';

// 上传/下载短链接依赖 Mongo 会话，这里只验证 TTL 与预签名参数，不触碰存储会话
vi.mock('@fastgpt/service/common/s3/accessLink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fastgpt/service/common/s3/accessLink')>();
  return {
    ...actual,
    createS3UploadAccessUrl: vi.fn(async () => 'https://storage.example.com/upload/token'),
    createS3DownloadAccessUrl: vi.fn(async () => 'https://storage.example.com/download/token')
  };
});

const { S3ChatSource: RealS3ChatSource } = await vi.importActual<
  typeof import('@fastgpt/service/common/s3/sources/chat')
>('@fastgpt/service/common/s3/sources/chat');
const { S3BaseBucket } = await vi.importActual<
  typeof import('@fastgpt/service/common/s3/buckets/base')
>('@fastgpt/service/common/s3/buckets/base');

const ORIGINAL_RETENTION = process.env.LUGANG_CHAT_FILE_RETENTION_DAYS;

const setRetention = (value?: string) => {
  if (value === undefined) {
    delete process.env.LUGANG_CHAT_FILE_RETENTION_DAYS;
    return;
  }
  process.env.LUGANG_CHAT_FILE_RETENTION_DAYS = value;
};

afterEach(() => {
  setRetention(ORIGINAL_RETENTION);
  vi.restoreAllMocks();
});

describe('getChatFileRetentionDays', () => {
  it('keeps 1..7 days as configured', () => {
    setRetention('1');
    expect(getChatFileRetentionDays()).toBe(1);
    setRetention('7');
    expect(getChatFileRetentionDays()).toBe(7);
  });

  it('falls back to the default when the variable is unset or blank', () => {
    setRetention(undefined);
    expect(getChatFileRetentionDays()).toBe(DEFAULT_CHAT_FILE_RETENTION_DAYS);
    setRetention('');
    expect(getChatFileRetentionDays()).toBe(DEFAULT_CHAT_FILE_RETENTION_DAYS);
    setRetention('   ');
    expect(getChatFileRetentionDays()).toBe(DEFAULT_CHAT_FILE_RETENTION_DAYS);
  });

  it('falls back to the default when the value is not a number', () => {
    setRetention('abc');
    expect(getChatFileRetentionDays()).toBe(DEFAULT_CHAT_FILE_RETENTION_DAYS);
  });

  it('clamps out-of-range values', () => {
    setRetention('0');
    expect(getChatFileRetentionDays()).toBe(MIN_CHAT_FILE_RETENTION_DAYS);
    setRetention('30');
    expect(getChatFileRetentionDays()).toBe(MAX_CHAT_FILE_RETENTION_DAYS);
  });

  it('floors fractional days', () => {
    setRetention('2.9');
    expect(getChatFileRetentionDays()).toBe(2);
  });
});

const chatParams = {
  sourceType: 'app' as const,
  sourceId: '65a0a3f5b6c7d8e9f0a1b2c3',
  chatId: 'chat_1',
  uId: 'user_1',
  filename: 'report.docx'
};

describe('S3ChatSource retention wiring', () => {
  it('signs user uploads with a short presigned window while keeping the 7 day object TTL', async () => {
    setRetention('7');
    const createUploadAccessUrl = vi.fn().mockResolvedValue({
      uploadMode: 'single',
      url: 'upload-url',
      key: 'file-key',
      headers: {},
      previewUrl: 'preview-url'
    });
    const context = { createUploadAccessUrl } as unknown as S3ChatSource;

    await RealS3ChatSource.prototype.createUploadChatFileURL.call(context, {
      ...chatParams,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 1024
    });

    const options = createUploadAccessUrl.mock.calls[0][1];
    expect(options.expiredHours).toBe(24);
    expect(options.ttlExpiredHours).toBe(7 * 24);
  });

  it('derives the object TTL from the explicit expiredTime', async () => {
    setRetention('7');
    const createUploadAccessUrl = vi.fn().mockResolvedValue({
      uploadMode: 'single',
      url: 'upload-url',
      key: 'file-key',
      headers: {},
      previewUrl: 'preview-url'
    });
    const context = { createUploadAccessUrl } as unknown as S3ChatSource;

    await RealS3ChatSource.prototype.createUploadChatFileURL.call(context, {
      ...chatParams,
      expiredTime: addDays(new Date(), 3)
    });

    const options = createUploadAccessUrl.mock.calls[0][1];
    expect(options.expiredHours).toBe(24);
    expect(options.ttlExpiredHours).toBe(3 * 24);
  });

  it('never signs longer than the retention window', async () => {
    const createUploadAccessUrl = vi.fn().mockResolvedValue({
      uploadMode: 'single',
      url: 'upload-url',
      key: 'file-key',
      headers: {},
      previewUrl: 'preview-url'
    });
    const context = { createUploadAccessUrl } as unknown as S3ChatSource;

    await RealS3ChatSource.prototype.createUploadChatFileURL.call(context, {
      ...chatParams,
      expiredTime: addHours(new Date(), 2)
    });

    const options = createUploadAccessUrl.mock.calls[0][1];
    expect(options.expiredHours).toBe(2);
    expect(options.ttlExpiredHours).toBe(2);
  });

  it('defaults body uploads to the retention window', async () => {
    setRetention('3');
    const uploadFileByBody = vi.fn().mockResolvedValue({ key: 'file-key', accessUrl: 'url' });
    const context = { uploadFileByBody } as unknown as S3ChatSource;

    await RealS3ChatSource.prototype.uploadChatFile.call(context, {
      ...chatParams,
      body: Buffer.from('hello')
    });

    const params = uploadFileByBody.mock.calls[0][0];
    const hours = differenceInHours(params.expiredTime, new Date());
    expect(Math.round(hours / 24)).toBe(3);
  });
});

describe('S3BaseBucket ttlExpiredHours', () => {
  it('writes the object TTL with ttlExpiredHours and signs the URL with expiredHours', async () => {
    const storage = createVitestStorageMock({
      vi,
      bucketName: 'fastgpt-private',
      baseUrl: 'https://storage.example.com'
    });
    const bucket = new S3BaseBucket(storage, undefined);
    const ttlCreate = vi.spyOn(MongoS3TTL, 'create').mockResolvedValue(undefined as never);

    await bucket.createUploadAccessUrl(
      {
        rawKey: 'chat/app/app-1/user-1/chat-1/file.bin',
        filename: 'file.bin'
      },
      { expiredHours: 24, ttlExpiredHours: 168, maxFileSize: 1024 }
    );

    const ttlRecord = ttlCreate.mock.calls[0][0] as unknown as { expiredTime: Date };
    const hours = differenceInHours(ttlRecord.expiredTime, new Date());
    expect(Math.round(hours / 24)).toBe(7);
  });
});
