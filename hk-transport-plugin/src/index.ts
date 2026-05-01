// 鲁港通 - 香港智能交通助手 src/index.ts
// FastGPT 系统插件入口（src 层）
// 导出 InputType, OutputType, tool 供根目录 index.ts 使用

import { z } from 'zod';
import { parseQuestion } from './parser';
import { geocodeRoute } from './geocoder';
import { createAPICallPlan } from './router';
import { executeBatchFetch } from './fetcher';
import { integrateData } from './integrator';
import type { ResponseMetadata } from './types';

// ============================================================
// InputType - 插件输入参数（Zod Schema）
// ============================================================

export const InputType = z.object({
  question: z.string().min(1, '问题不能为空').describe('用户的交通问题'),
  language: z.enum(['zh-CN', 'zh-HK', 'en']).default('zh-CN').describe('返回数据的语言'),
});

// ============================================================
// OutputType - 插件输出参数（Zod Schema）
// ============================================================

const RouteStepSchema = z.object({
  type: z.enum(['walk', 'bus', 'mtr', 'gmb', 'tram', 'ferry']),
  description: z.string(),
  route: z.string().optional(),
  routeDetail: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  duration: z.number(),
  stops: z.number().optional(),
  cost: z.number().optional(),
});

const RouteOptionSchema = z.object({
  id: z.string(),
  totalTime: z.number(),
  totalDistance: z.string(),
  type: z.enum(['direct', 'transfer']),
  steps: z.array(RouteStepSchema),
  estimatedCost: z.number(),
});

const NextBusInfoSchema = z.object({
  eta: z.string().nullable(),
  minutesAway: z.number(),
  remarks: z.string().optional(),
});

const StopETAItemSchema = z.object({
  route: z.string(),
  destination: z.string(),
  company: z.string(),
  nextBuses: z.array(NextBusInfoSchema),
});

const StopETAListSchema = z.object({
  stopId: z.string(),
  stopName: z.string(),
  etas: z.array(StopETAItemSchema),
});

const PaymentInfoSchema = z.object({
  octopus: z.boolean(),
  cash: z.boolean(),
  creditCard: z.boolean(),
  mobilePayment: z.boolean(),
  notes: z.array(z.string()),
});

const MetadataSchema = z.object({
  dataTimestamp: z.string(),
  apisCalled: z.array(z.string()),
  apiStatus: z.record(z.string(), z.enum(['success', 'failed', 'skipped'])).optional(),
});

export const OutputType = z.object({
  routes: z.array(RouteOptionSchema).describe('推荐的路线方案列表'),
  stopETAs: StopETAListSchema.optional().describe('站点实时到站时间'),
  paymentInfo: PaymentInfoSchema.describe('付款方式和费用信息'),
  tips: z.array(z.string()).describe('出行建议和注意事项'),
  metadata: MetadataSchema.describe('元数据'),
  error: z.string().optional().describe('错误信息（部分失败时）'),
});

// ============================================================
// tool - 插件主函数
// ============================================================

export async function tool(
  input: z.infer<typeof InputType>
): Promise<z.infer<typeof OutputType>> {
  const apisCalled: string[] = [];
  const apiStatus: Record<string, 'success' | 'failed' | 'skipped'> = {};

  try {
    // 1. 解析用户问题
    const parsed = parseQuestion(input.question, input.language);

    // 2. 地理编码
    const { originCoord, destCoord } = geocodeRoute(parsed.origin, parsed.destination);

    // 验证：无法识别起点或终点时返回错误提示（Requirements 13.3）
    if (!parsed.origin && !parsed.destination) {
      return buildErrorResponse(
        '无法识别起点或终点，请提供更具体的地点名称',
        apisCalled,
        apiStatus
      );
    }

    // 3. 智能路由 - 生成 API 调用计划
    const plan = createAPICallPlan(parsed, originCoord, destCoord);

    // 4. 并发调用 API（Promise.allSettled）
    const fetchResult = await executeBatchFetch(plan);

    // 收集 API 调用状态
    for (const [api, status] of Object.entries(fetchResult.apiStatus)) {
      apisCalled.push(api);
      apiStatus[api] = status;
    }

    // 检查是否所有 API 都失败了
    const allFailed = Object.values(fetchResult.apiStatus)
      .filter(s => s !== 'skipped')
      .every(s => s === 'failed');

    // 5. 数据整合
    const integrated = integrateData(fetchResult, {
      origin: parsed.origin,
      destination: parsed.destination,
      currentTime: new Date(),
    });

    // 构建元数据
    const metadata: ResponseMetadata = {
      dataTimestamp: new Date().toISOString(),
      apisCalled,
      apiStatus,
    };

    // 没有找到路线时的提示（Requirements 13.4）
    if (integrated.routes.length === 0 && !integrated.stopETAs) {
      const errorMsg = allFailed
        ? '所有 API 调用失败，请稍后重试'
        : parsed.origin && parsed.destination
          ? `未找到从 ${parsed.origin} 到 ${parsed.destination} 的公共交通路线`
          : '未找到匹配的路线信息';

      return {
        routes: [],
        paymentInfo: integrated.paymentInfo,
        tips: [errorMsg, ...integrated.tips],
        metadata,
        error: errorMsg,
      };
    }

    // 标注失败的数据源（Requirements 13.5）
    const failedAPIs = Object.entries(apiStatus)
      .filter(([, s]) => s === 'failed')
      .map(([api]) => api);

    const tips = [...integrated.tips];
    if (failedAPIs.length > 0) {
      tips.push(`部分数据源暂不可用: ${failedAPIs.join(', ')}，已使用其他可用数据`);
    }

    return {
      routes: integrated.routes,
      stopETAs: integrated.stopETAs,
      paymentInfo: integrated.paymentInfo,
      tips,
      metadata,
    };
  } catch (error) {
    // 顶层错误捕获 - 确保不会崩溃（Requirements 13.1, 13.2）
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return buildErrorResponse(
      `查询失败: ${errorMsg}`,
      apisCalled,
      apiStatus
    );
  }
}

/**
 * 构建错误响应（确保始终返回有效的 OutputType）
 */
function buildErrorResponse(
  errorMsg: string,
  apisCalled: string[],
  apiStatus: Record<string, 'success' | 'failed' | 'skipped'>
): z.infer<typeof OutputType> {
  return {
    routes: [],
    paymentInfo: {
      octopus: false,
      cash: false,
      creditCard: false,
      mobilePayment: false,
      notes: [],
    },
    tips: [errorMsg],
    metadata: {
      dataTimestamp: new Date().toISOString(),
      apisCalled,
      apiStatus,
    },
    error: errorMsg,
  };
}
