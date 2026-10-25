import { describe, it, expect, vi } from 'vitest';
import { assertS3UploadResponseOk, parseS3UploadError } from '@fastgpt/global/common/error/s3';

const createTranslator = () =>
  vi.fn((key: string, params?: Record<string, string>) =>
    params ? `${key}:${JSON.stringify(params)}` : key
  );

describe('parseS3UploadError', () => {
  it('should handle raw string EntityTooLarge error', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: 'EntityTooLarge: size exceeds limit',
      maxSize: 10 * 1024 * 1024
    });

    expect(result).toBe('common:error.s3_upload_file_too_large:{"max":"10 MB"}');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_file_too_large', { max: '10 MB' });
  });

  it('should handle axios response EntityTooLarge error', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          data: '<Error><Code>EntityTooLarge</Code></Error>'
        }
      },
      maxSize: 1024
    });

    expect(result).toBe('common:error.s3_upload_file_too_large:{"max":"1 KB"}');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_file_too_large', { max: '1 KB' });
  });

  it('should handle proxy json EntityTooLarge error', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          data: {
            message: 'EntityTooLarge'
          }
        }
      },
      maxSize: 2 * 1024 * 1024
    });

    expect(result).toBe('common:error.s3_upload_file_too_large:{"max":"2 MB"}');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_file_too_large', { max: '2 MB' });
  });

  it('should handle invalid upload file type errors', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          data: {
            message: 'UploadFileTypeMismatch'
          }
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_invalid_file_type');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_invalid_file_type');
  });

  it('should handle AccessDenied error', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          data: 'AccessDenied'
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_auth_failed');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_auth_failed');
  });

  it('should handle proxy json unauthorized error', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          data: {
            statusText: 'unAuthFile',
            message: 'error.unAuthFile'
          }
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_auth_failed');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_auth_failed');
  });

  it('should handle invalid access key or signature errors', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          data: 'InvalidAccessKeyId'
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_auth_failed');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_auth_failed');
  });

  it('should handle NoSuchBucket error', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          data: 'NoSuchBucket'
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_bucket_not_found');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_bucket_not_found');
  });

  it('should handle proxy json NoSuchBucket error', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          data: {
            message: 'NoSuchBucket'
          }
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_bucket_not_found');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_bucket_not_found');
  });

  it('should handle RequestTimeout error', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          data: 'RequestTimeout'
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_timeout');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_timeout');
  });

  it('should handle proxy json RequestTimeout error', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          data: {
            statusText: 'RequestTimeout'
          }
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_timeout');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_timeout');
  });

  it('should handle network errors', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        code: 'ECONNREFUSED'
      }
    });

    expect(result).toBe('common:error.s3_upload_network_error');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_network_error');
  });

  it('should handle axios timeout errors', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        code: 'ECONNABORTED'
      }
    });

    expect(result).toBe('common:error.s3_upload_timeout');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_timeout');
  });

  it('should handle timeout message errors', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        message: 'timeout of 3000ms exceeded'
      }
    });

    expect(result).toBe('common:error.s3_upload_timeout');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_timeout');
  });

  it('should handle client side file size validation errors', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        message: 'file size is too large'
      }
    });

    expect(result).toBe('common:error.s3_upload_file_too_large:{"max":"-"}');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_file_too_large', { max: '-' });
  });

  it('should return generic upload error for unknown error', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        message: 'unknown error'
      }
    });

    expect(result).toBe('common:upload_file_error');
    expect(t).toHaveBeenCalledWith('common:upload_file_error');
  });

  it('should handle gateway blocked response error', () => {
    const t = createTranslator();
    const error = new Error('blocked');
    (error as any).code = 'S3_UPLOAD_GATEWAY_BLOCKED';

    const result = parseS3UploadError({ t, error });

    expect(result).toBe('common:error.s3_upload_blocked');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_blocked');
  });

  it('should handle server error page without json body', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          status: 500,
          headers: { 'content-type': 'text/html' },
          data: '<html><head><title>500 Internal Server Error</title></head><body></body></html>'
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_service_unavailable');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_service_unavailable');
  });

  it('should handle security filter page as blocked upload', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          status: 500,
          headers: { 'content-type': 'text/html' },
          data: '<html><body>宝塔免费WAF提醒您,Nginx缓冲区溢出</body></html>'
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_blocked');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_blocked');
  });

  it('should handle gateway status without response body', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      error: {
        response: {
          status: 504
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_service_unavailable');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_service_unavailable');
  });

  it('should explain HEIC photos are unsupported', () => {
    const t = createTranslator();
    const result = parseS3UploadError({
      t,
      filename: 'IMG_0042.HEIC',
      error: {
        response: {
          data: {
            statusText: 'InvalidUploadFileType'
          }
        }
      }
    });

    expect(result).toBe('common:error.s3_upload_heic_unsupported');
    expect(t).toHaveBeenCalledWith('common:error.s3_upload_heic_unsupported');
  });
});

describe('assertS3UploadResponseOk', () => {
  it('should accept proxy json success response', () => {
    expect(() =>
      assertS3UploadResponseOk({
        data: { code: 200, statusText: '', message: '', data: { success: true } },
        headers: { 'content-type': 'application/json' }
      })
    ).not.toThrow();
  });

  it('should accept empty success response', () => {
    expect(() => assertS3UploadResponseOk({ data: '', headers: {} })).not.toThrow();
  });

  it('should reject html page returned with success status', () => {
    expect(() =>
      assertS3UploadResponseOk({
        data: '<html><body>宝塔免费WAF提醒您,Nginx缓冲区溢出</body></html>',
        headers: { 'content-type': 'text/html' }
      })
    ).toThrow();
  });

  it('should reject html body without content type', () => {
    expect(() => assertS3UploadResponseOk({ data: '<!DOCTYPE html><html></html>' })).toThrow();
  });
});
