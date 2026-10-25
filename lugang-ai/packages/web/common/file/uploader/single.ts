import axios from 'axios';
import { assertS3UploadResponseOk, parseS3UploadError } from '@fastgpt/global/common/error/s3';
import { SINGLE_REQUEST_TIMEOUT } from './constants';
import type { S3FileUploaderSingleParams } from './types';
import { isUploadAbortError, throwIfAborted } from './utils';

/** 执行单 PUT 上传，并将 Axios 进度事件转换成统一的字节进度回调。 */
export const uploadSingleFile = async (params: S3FileUploaderSingleParams): Promise<void> => {
  try {
    throwIfAborted(params.signal);
    params.onProgress?.(0, params.file.size);

    const response = await axios.put(params.url, params.file, {
      headers: {
        ...params.headers
      },
      onUploadProgress: (event) => {
        params.onProgress?.(Math.min(event.loaded, params.file.size), params.file.size);
      },
      signal: params.signal,
      timeout: SINGLE_REQUEST_TIMEOUT
    });
    assertS3UploadResponseOk(response);
  } catch (error) {
    if (isUploadAbortError(error, params.signal)) {
      throw error;
    }

    throw parseS3UploadError({
      t: params.t,
      error,
      maxSize: params.maxSize,
      filename: params.file.name
    });
  }

  params.onProgress?.(params.file.size, params.file.size);
  params.onSuccess?.();
};
