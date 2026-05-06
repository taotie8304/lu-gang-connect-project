// 鲁港通 - 香港智能交通助手 src/index.ts
// FastGPT 系统插件入口（src 层）
// 导出 InputType, OutputType, tool 供根目录 index.ts 使用

import { z } from 'zod';
import { parseQuestion } from './parser';
import { geocodeRoute } from './geocoder';
import { createAPICallPlan } from './router';
import { executeBatchFetch } from './fetcher';
import {
  integrateData,
  transitCandidateToRouteOption,
  generatePaymentInfo,
  generateTips,
} from './integrator';
import { planPublicTransit } from './planner';
import type { ResponseMetadata, RouteOption, ParsedQuestion } from './types';

// ============================================================
// InputType - 插件输入参数（Zod Schema）
// 支持两种模式：
//   1. 结构化模式：LLM 直接传 origin/destination/transportMode（推荐）
//   2. 自然语言模式：传 question，插件自行解析（兜底）
// ============================================================

export const InputType = z.object({
  question: z.string().optional().describe('用户的交通问题（当 origin/destination 未提供时使用）'),
  origin: z.string().optional().describe('起点（由上层 LLM 提取，如"落马洲口岸"）'),
  destination: z.string().optional().describe('终点（由上层 LLM 提取，如"尖沙咀"）'),
  transportMode: z.string().optional().describe('交通方式偏好：bus/mtr/gmb/nlb/ferry/tram'),
  language: z.enum(['zh-CN', 'zh-HK', 'en']).default('zh-CN').describe('返回数据的语言'),
}).refine(
  (data) => !!(data.question || data.origin || data.destination),
  { message: '至少需要提供 question 或 origin/destination 中的一个' }
);

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
    // ===== 诊断：记录输入参数 =====
    const diagLines: string[] = [];
    diagLines.push(`[诊断] 收到参数: question="${input.question || '(空)'}", origin="${input.origin || '(空)'}", destination="${input.destination || '(空)'}", transportMode="${input.transportMode || '(空)'}"`);

    // 1. 解析用户问题（优先使用上层 LLM 传入的结构化参数）
    let origin = input.origin;
    let destination = input.destination;
    let transportPreference: string[] | undefined = input.transportMode
      ? [input.transportMode]
      : undefined;

    // 结构化参数不完整时，从 question 文本中解析补充
    if (!origin || !destination) {
      const parsed = parseQuestion(input.question || '', input.language);
      origin = origin || parsed.origin;
      destination = destination || parsed.destination;
      if (!transportPreference) {
        transportPreference = parsed.transportPreference;
      }
    }

    diagLines.push(`[诊断] 解析结果: origin="${origin || '(未识别)'}", destination="${destination || '(未识别)'}"`);

    // 统一 parsed 接口供下游使用
    const parsed: ParsedQuestion = {
      origin,
      destination,
      transportPreference,
      keywords: input.question ? input.question.split(/[\s,，。.!！?？]+/).filter(Boolean) : [],
    };

    // 2. 地理编码
    const { originCoord, destCoord } = geocodeRoute(parsed.origin, parsed.destination);

    if (originCoord) diagLines.push(`[诊断] 起点坐标: ${originCoord.name} (${originCoord.lat.toFixed(4)}, ${originCoord.lng.toFixed(4)})`);
    else if (origin) diagLines.push(`[诊断] 起点"${origin}"未找到坐标`);
    if (destCoord) diagLines.push(`[诊断] 终点坐标: ${destCoord.name} (${destCoord.lat.toFixed(4)}, ${destCoord.lng.toFixed(4)})`);
    else if (destination) diagLines.push(`[诊断] 终点"${destination}"未找到坐标`);

    if (!parsed.origin && !parsed.destination) {
      return buildErrorResponse(
        `无法识别起点或终点，请直接告诉我要从哪里到哪里。例如"从尖沙咀到铜锣湾怎么走"。${diagLines.join(' | ')}`,
        apisCalled, apiStatus
      );
    }

    // ========================================================
    // 3. 多模态公交规划器（使用内置的香港政府官方 GeoJSON 数据）
    //    覆盖 KMB/CTB/NLB/LWB 巴士 + 专线小巴 + 电车 + 渡轮 + 山顶缆车 + 港铁
    //    要求：起终点都有坐标
    // ========================================================
    const routeOptions: RouteOption[] = [];
    let plannerErrorDetail: string | undefined;

    if (originCoord && destCoord) {
      const planResult = await planPublicTransit(
        originCoord.lat, originCoord.lng,
        destCoord.lat, destCoord.lng
      );

      apisCalled.push('transit-planner');
      if (planResult.indexError) {
        apiStatus['transit-planner'] = 'failed';
        plannerErrorDetail = planResult.indexError;
      } else if (planResult.candidates.length === 0) {
        apiStatus['transit-planner'] = planResult.noNearbyStops ? 'skipped' : 'failed';
        plannerErrorDetail = planResult.noNearbyStops
          ? `起终点 800 米内无任何公交站点`
          : `找到附近站点但无直达路线（可能需要换乘）`;
      } else {
        apiStatus['transit-planner'] = 'success';
        // 转换为 RouteOption（不含实时 ETA，Phase 2 再对接）
        for (const cand of planResult.candidates) {
          routeOptions.push(transitCandidateToRouteOption(cand));
        }
      }
    } else {
      apisCalled.push('transit-planner');
      apiStatus['transit-planner'] = 'skipped';
    }

    // ========================================================
    // 4. 如果公交规划没有结果，尝试旧的 TDAS 作为降级参考
    //    （不再作为唯一路径来源）
    // ========================================================
    let stopETAs: z.infer<typeof OutputType>['stopETAs'] | undefined;
    if (routeOptions.length === 0) {
      const plan = createAPICallPlan(parsed, originCoord, destCoord);
      const fetchResult = await executeBatchFetch(plan);

      for (const [api, status] of Object.entries(fetchResult.apiStatus)) {
        apisCalled.push(api);
        apiStatus[api] = status;
      }

      const integrated = integrateData(fetchResult, {
        origin: parsed.origin, destination: parsed.destination,
        currentTime: new Date(),
      });
      routeOptions.push(...integrated.routes);
      stopETAs = integrated.stopETAs;
    }

    // 5. 付款信息 & tips
    const paymentInfo = generatePaymentInfo(routeOptions);
    const baseTips = generateTips(routeOptions, parsed.origin, parsed.destination, new Date());

    const metadata: ResponseMetadata = {
      dataTimestamp: new Date().toISOString(),
      apisCalled,
      apiStatus,
    };

    // 都没找到路线时的提示 — 加上诊断信息
    if (routeOptions.length === 0) {
      let errorMsg: string;
      if (apiStatus['transit-planner'] === 'skipped' && !originCoord) {
        errorMsg = `起点"${parsed.origin || '未知'}"不在已知地点词典中。`;
      } else if (apiStatus['transit-planner'] === 'skipped' && !destCoord) {
        errorMsg = `终点"${parsed.destination || '未知'}"不在已知地点词典中。`;
      } else {
        errorMsg = '附近没有找到可直达的公交路线。';
      }
      errorMsg += ' 请勿重试——这是最终结果。';
      return {
        routes: [],
        paymentInfo,
        tips: [...diagLines, ...baseTips, errorMsg],
        metadata,
        error: errorMsg,
      };
    }

    const failedAPIs = Object.entries(apiStatus)
      .filter(([, s]) => s === 'failed')
      .map(([api]) => api);

    const tips = [...diagLines, ...baseTips];
    if (failedAPIs.length > 0) {
      tips.push(`部分数据源暂不可用: ${failedAPIs.join(', ')}`);
    }
    if (plannerErrorDetail) {
      tips.push(`[诊断] 交通规划器: ${plannerErrorDetail}`);
    }

    return {
      routes: routeOptions,
      stopETAs,
      paymentInfo,
      tips,
      metadata,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return buildErrorResponse(
      `查询失败: ${errorMsg}`,
      apisCalled, apiStatus
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
