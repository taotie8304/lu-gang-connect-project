/**
 * 鲁港通 - 获取系统内容 API
 * GET /api/system/content/{key}
 * 
 * 所有用户都可以访问，用于显示使用条款、隐私政策等内容
 */
import type { ApiRequestProps } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { getSystemContent } from '@fastgpt/service/support/systemContent/controller';
import {
  SystemContentKeyEnum,
  resolveSystemContentKey
} from '@fastgpt/global/support/systemContent/constant';
import type { SystemContentResponse } from '@fastgpt/global/support/systemContent/type';
import { getLocale } from '@fastgpt/service/common/middle/i18n';
import { getLogger, LogCategories } from '@fastgpt/service/common/logger';

const addLog = getLogger(LogCategories.SYSTEM);

type SystemContentQuery = { key: string };

async function handler(
  req: ApiRequestProps<undefined, SystemContentQuery>
): Promise<SystemContentResponse> {
  const { key } = req.query;

  // 鲁港通 - 验证 key 是否为合法基准/本地化内容键
  if (!(Object.values(SystemContentKeyEnum) as string[]).includes(key)) {
    throw new Error('无效的内容键');
  }

  try {
    // 鲁港通 - 用官方 getLocale(req) 取语言（分享头→分享Cookie→NEXT_LOCALE→自定义头→en 兜底），
    // 再解析为对应本地化 key（zh-Hant / 无对应版本回退基准，ko-KR 回退英文）
    const locale = getLocale(req);
    const contentKey = resolveSystemContentKey(key, locale);

    const content = await getSystemContent(contentKey);
    if (!content) {
      throw new Error('内容不存在');
    }
    return content;
  } catch (error) {
    addLog.error('鲁港通：获取系统内容失败', { key, error });
    throw new Error('获取系统内容失败，请稍后重试');
  }
}

export default NextAPI(handler);
