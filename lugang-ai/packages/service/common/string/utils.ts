import { getLightweightWorkerPoolOptions } from '../../worker/lightweightResource';
import { WorkerNameEnum, getWorkerController } from '../../worker/utils';
import type { UploadFileHandler } from '../../worker/readFile/type';
import { getLogger, LogCategories } from '../logger';

const logger = getLogger(LogCategories.INFRA.WORKER);
const HTML_TO_MARKDOWN_TIMEOUT_MS = 300000;

type HtmlToMarkdownWorkerProps = {
  html: string;
  uploadImages?: boolean;
};

const getHtmlToMarkdownWorker = () =>
  getWorkerController<HtmlToMarkdownWorkerProps, { rawText: string }>({
    name: WorkerNameEnum.htmlStr2Md,
    ...getLightweightWorkerPoolOptions<HtmlToMarkdownWorkerProps>(),
    taskTimeoutMs: HTML_TO_MARKDOWN_TIMEOUT_MS,
    maxTasksPerWorker: 100
  });

/**
 * 将 HTML 转为 Markdown。实际转换在 worker 中执行，并在派发前记录任务大小，
 * 便于定位站点同步中是否卡在 HTML 转换阶段。
 *
 * 传入 uploadFile 时开启图片上传，避免 base64 图片留在转换结果中。
 */
export const htmlToMarkdownWithUploadFile = async (
  html?: string | null,
  uploadFile?: UploadFileHandler
) => {
  const htmlContent = html || '';
  const workerController = getHtmlToMarkdownWorker();

  logger.info('HTML to markdown worker task started', {
    htmlLength: htmlContent.length,
    workerName: WorkerNameEnum.htmlStr2Md,
    maxReservedThreads: workerController.maxReservedThreads,
    timeoutMs: HTML_TO_MARKDOWN_TIMEOUT_MS
  });

  const md = await workerController.run(
    { html: htmlContent, uploadImages: Boolean(uploadFile) },
    undefined,
    uploadFile ? { uploadFile } : undefined
  );

  return md.rawText;
};

export const htmlToMarkdown = (html?: string | null) => htmlToMarkdownWithUploadFile(html);
