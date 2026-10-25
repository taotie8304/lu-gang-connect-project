import { formatFileSize } from '../file/tools';
import { S3ErrEnum } from './code/s3';

export const S3UploadGatewayBlockedCode = 'S3_UPLOAD_GATEWAY_BLOCKED';

const isHtmlPage = (value: unknown) =>
  typeof value === 'string' &&
  /^\s*(?:<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(value);

/**
 * 上传代理正常时会返回 JSON 或空正文；返回 HTML 页面说明请求被网关或安全防护拦截，
 * 不能当作上传成功继续往下走。
 */
export function assertS3UploadResponseOk(response: { data?: unknown; headers?: unknown }): void {
  const headers = response?.headers as
    | { get?: (key: string) => unknown; ['content-type']?: unknown }
    | undefined;
  const contentType =
    typeof headers?.get === 'function'
      ? String(headers.get('content-type') ?? '')
      : String(headers?.['content-type'] ?? '');

  if (!contentType.toLowerCase().includes('text/html') && !isHtmlPage(response?.data)) return;

  const error = new Error('Upload was intercepted by the gateway') as Error & { code: string };
  error.code = S3UploadGatewayBlockedCode;
  throw error;
}

/**
 * Parse S3 upload errors from direct storage responses and the upload proxy.
 * Known errors are translated through the supplied i18n function; unknown
 * storage errors use the generic upload error instead of being reported as
 * network failures.
 */
export function parseS3UploadError({
  t,
  error,
  maxSize,
  filename
}: {
  t: any;
  error: any;
  maxSize?: number;
  filename?: string;
}): string {
  const maxSizeStr = maxSize ? formatFileSize(maxSize) : '-';

  const getResponseErrorText = (data: unknown) => {
    if (typeof data === 'string') return data;
    if (!data || typeof data !== 'object') return '';

    const response = data as Record<string, unknown>;
    const nestedError =
      response.error && typeof response.error === 'object'
        ? (response.error as Record<string, unknown>)
        : undefined;

    return [
      response.message,
      response.statusText,
      response.msg,
      response.error,
      nestedError?.message,
      nestedError?.statusText
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
  };

  const responseErrorText = getResponseErrorText(error?.response?.data);
  const errorText = [
    typeof error === 'string' ? error : '',
    error?.message,
    responseErrorText
  ].join(' ');

  // 网关拦截标记优先，避免被正文中的其他字样误判成网络或超时。
  if (error?.code === S3UploadGatewayBlockedCode) {
    return t('common:error.s3_upload_blocked');
  }

  // S3 may return XML directly, while the proxy returns the same details in JSON fields.
  if (errorText.includes('EntityTooLarge')) {
    return t('common:error.s3_upload_file_too_large', { max: maxSizeStr });
  }
  if (
    errorText.includes(S3ErrEnum.uploadFileTypeMismatch) ||
    errorText.includes(S3ErrEnum.invalidUploadFileType)
  ) {
    // iPhone 相册默认导出 HEIC，直接说清格式限制比笼统的“不受支持”更容易处理。
    if (/\.(heic|heif)$/i.test(filename ?? '')) {
      return t('common:error.s3_upload_heic_unsupported');
    }
    return t('common:error.s3_upload_invalid_file_type');
  }
  if (errorText.includes(S3ErrEnum.fileUploadDisabled)) {
    return t('common:error.file_upload_disabled');
  }

  if (
    errorText.includes('unAuthFile') ||
    errorText.includes('unAuthorization') ||
    errorText.includes('AccessDenied') ||
    errorText.includes('InvalidAccessKeyId') ||
    errorText.includes('SignatureDoesNotMatch')
  ) {
    return t('common:error.s3_upload_auth_failed');
  }
  if (errorText.includes('NoSuchBucket')) {
    return t('common:error.s3_upload_bucket_not_found');
  }
  if (errorText.includes('RequestTimeout')) {
    return t('common:error.s3_upload_timeout');
  }

  // 安全防护或网关返回的 HTML 拦截页没有固定错误码，只能按页面特征识别。
  if (errorText.includes('宝塔') || /\bWAF\b/i.test(responseErrorText)) {
    return t('common:error.s3_upload_blocked');
  }
  const responseStatus = Number(error?.response?.status);
  if (Number.isFinite(responseStatus) && responseStatus >= 500) {
    return t('common:error.s3_upload_service_unavailable');
  }

  // Handle network errors
  if (
    [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'ERR_NETWORK',
      'ERR_CONNECTION_RESET',
      'ERR_CONNECTION_REFUSED',
      'ERR_NAME_NOT_RESOLVED'
    ].includes(error?.code) ||
    error?.message === 'Network Error'
  ) {
    return t('common:error.s3_upload_network_error');
  }

  // Handle axios timeout
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return t('common:error.s3_upload_timeout');
  }

  // Handle file size validation error (client-side)
  if (error?.message?.includes('file size') || error?.message?.includes('too large')) {
    return t('common:error.s3_upload_file_too_large', { max: maxSizeStr });
  }

  // 未识别的后端错误不一定来自网络，避免把存储服务返回的其他错误误报为网络异常。
  return t('common:upload_file_error');
}
