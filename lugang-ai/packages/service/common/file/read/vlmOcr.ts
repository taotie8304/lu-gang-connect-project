import { getLogger, LogCategories } from '../../logger';
import { getVlmModel } from '../../../core/ai/model';
import { createChatCompletion } from '../../../core/ai/llm/request/createChatCompletion';

const logger = getLogger(LogCategories.MODULE.AI.LLM);

const VLM_OCR_TIMEOUT = 120000;
const VLM_OCR_EMPTY_MARKER = 'NO_TEXT';
// 鲁港通 - 读图固定优先专用 OCR 视觉模型：通用大模型带思考且按旗舰价计费，不适合逐页 OCR
const VLM_OCR_PREFERRED_MODEL = 'qwen3.5-ocr';

/**
 * 鲁港通 - 解析读图模型：优先专用视觉模型，缺失时退回任一已启用的视觉模型
 */
const getOcrVlmModel = () => getVlmModel(VLM_OCR_PREFERRED_MODEL);

/**
 * 鲁港通 - 视觉读图提示词：只识别内容，不要求还原版式
 */
const VLM_OCR_PROMPT = `请提取这张图片中出现的全部文字内容。

要求：
1. 只输出图片中真实存在的文字，不要翻译、不要补充、不要总结、不要猜测。
2. 按人类阅读顺序（从上到下、从左到右）逐行输出，保留原有的段落换行。
3. 表格内容按单元格顺序输出，同一行内用制表符分隔。
4. 如果图片里没有任何文字，只输出 ${VLM_OCR_EMPTY_MARKER}。`;

/**
 * 鲁港通 - 是否具备视觉读图能力（已登记启用的视觉模型）
 */
export const isVlmOcrAvailable = () => Boolean(getOcrVlmModel());

/**
 * 鲁港通 - 识别空白页时模型可能吐出版式 JSON（rotate_rect + text），
 * 它不是图片里的真实文字，必须按无文字处理，避免把幻觉内容交给下游。
 */
const isLayoutJsonNoise = (text: string) => {
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();
  if (!candidate.startsWith('[') && !candidate.startsWith('{')) return false;

  try {
    const parsed: unknown = JSON.parse(candidate);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return (
      items.length > 0 &&
      items.every(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          'rotate_rect' in item &&
          'text' in item
      )
    );
  } catch {
    return false;
  }
};

/**
 * 鲁港通 - 归一化读图结果：空内容、无文字标记与版式 JSON 统一视为读不出
 */
const normalizeOcrText = (raw: string) => {
  const text = raw.trim();
  if (!text || text.toUpperCase() === VLM_OCR_EMPTY_MARKER) return '';
  if (isLayoutJsonNoise(text)) return '';
  return text;
};

/**
 * 鲁港通 - 调用视觉模型识别图片中的文字内容。
 *
 * 任何异常都归一化为空字符串，由调用方决定是否向用户诚实说明无法识别；
 * 绝不根据文件名或上下文编造内容。
 */
export const recognizeImageWithVlm = async ({
  buffer,
  mime
}: {
  buffer: Buffer;
  mime: string;
}): Promise<string> => {
  const modelData = getOcrVlmModel();
  if (!modelData) return '';

  try {
    const { response, isStreamResponse } = await createChatCompletion({
      modelData,
      body: {
        model: modelData.model,
        stream: false,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VLM_OCR_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mime};base64,${buffer.toString('base64')}`
                }
              }
            ]
          }
        ]
      },
      timeout: VLM_OCR_TIMEOUT
    });

    if (isStreamResponse) return '';

    const rawContent = (response as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]
      ?.message?.content;
    const text = typeof rawContent === 'string' ? rawContent : '';

    return normalizeOcrText(text);
  } catch (error) {
    logger.warn('VLM OCR failed', { model: modelData.model, error });
    return '';
  }
};
