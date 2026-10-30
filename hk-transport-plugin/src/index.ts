// 鲁港通 - 香港智能交通助手 src/index.ts
// FastGPT 系统插件入口（src 层）
// 导出 InputType, OutputType, tool 供根目录 index.ts 使用

import { z } from 'zod';
import { parseQuestion } from './parser';
import { geocode, geocodeRoute, geocodeRouteWithFallback, isOrganizationName } from './geocoder';
import { createAPICallPlan } from './router';
import { executeBatchFetch, fetchKMBStopETA, enrichCandidatesWithRealTimeETA } from './fetcher';
import {
  integrateData,
  transitCandidateToRouteOption,
  generatePaymentInfo,
  generateTips,
} from './integrator';
import { planPublicTransit, isHongKongDaytime } from './planner';
import { findStopByName } from './stop-db';
import { formatNextBusArrival, isEstimatedEta } from './eta';
import type { ResponseMetadata, RouteOption, ParsedQuestion, TransitCandidate } from './types';

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

export const RouteStepSchema = z.object({
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

export const RouteOptionSchema = z.object({
  id: z.string(),
  totalTime: z.number(),
  totalDistance: z.string(),
  type: z.enum(['direct', 'transfer']),
  steps: z.array(RouteStepSchema),
  estimatedCost: z.number(),
  // 鲁港通 - 补齐与 types.ts RouteOption 一致的字段，避免新插件按 outputSchema 剥离推荐标记与实时数据
  recommended: z.boolean().optional(),
  fareNote: z.string().optional().describe('票价口径（巴士/小巴为全程票价，中途上车按分段收费）'),
  realTimeData: z.object({
    nextBusArrival: z.string(),
    totalTravelTime: z.number(),
    dataTimestamp: z.string(),
    dataBasis: z.enum(['realtime', 'estimate']).optional().describe('候车时间依据：实时到站或静态估算'),
  }).optional(),
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

export const StopETAListSchema = z.object({
  stopId: z.string(),
  stopName: z.string(),
  etas: z.array(StopETAItemSchema),
});

export const PaymentInfoSchema = z.object({
  octopus: z.boolean(),
  cash: z.boolean(),
  creditCard: z.boolean(),
  mobilePayment: z.boolean(),
  notes: z.array(z.string()),
});

export const MetadataSchema = z.object({
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
  _debug: z.array(z.string()).optional().describe('调试诊断信息（仅管理员）'),
});

// ============================================================
// 输出层：候车措辞按数据来源区分（估算不得伪装实时）
// ============================================================

export function buildRealTimeData(
  eta: NonNullable<TransitCandidate['realTimeETA']>
): NonNullable<RouteOption['realTimeData']> {
  return {
    nextBusArrival: formatNextBusArrival(eta.nextBusMinutes, eta.dataSource),
    totalTravelTime: eta.totalMinutes,
    dataTimestamp: eta.timestamp,
    dataBasis: isEstimatedEta(eta.dataSource) ? 'estimate' : 'realtime',
  };
}

/** 候选路线 → 输出路线（首条标记推荐；候车时间按实时/估算分档措辞） */
export function buildRouteOptions(candidates: TransitCandidate[]): RouteOption[] {
  return candidates.map((cand, index) => {
    const routeOption = transitCandidateToRouteOption(cand);
    if (index === 0) routeOption.recommended = true;
    if (cand.realTimeETA) {
      routeOption.realTimeData = buildRealTimeData(cand.realTimeETA);
      routeOption.totalTime = cand.realTimeETA.totalMinutes;
    }
    return routeOption;
  });
}

// ============================================================
// 候选路线统一排序（鲁港通 - 深夜排序：白天把通宵线沉底）
// ============================================================

/**
 * 排序规则：香港日间（06:00–23:59）通宵线（N/NA 字头）整体沉底（车程短但白天停开）；
 * 其余按实时总时长 → 实时数据优先 → 票价。夜间时段不做沉底（通宵线正是首选）。
 */
export function sortEnrichedCandidates(
  candidates: TransitCandidate[],
  now: Date = new Date()
): void {
  const daytime = isHongKongDaytime(now);
  candidates.sort((a, b) => {
    if (daytime && Boolean(a.isOvernight) !== Boolean(b.isOvernight)) {
      return a.isOvernight ? 1 : -1;
    }
    const timeA = a.realTimeETA?.totalMinutes ?? 999;
    const timeB = b.realTimeETA?.totalMinutes ?? 999;
    if (timeA !== timeB) return timeA - timeB;
    // 时间相同时，优先实时数据
    if (a.realTimeETA?.dataSource !== 'static' && b.realTimeETA?.dataSource === 'static') return -1;
    if (a.realTimeETA?.dataSource === 'static' && b.realTimeETA?.dataSource !== 'static') return 1;
    // 都相同时，按费用排序
    return (a.fare ?? 999) - (b.fare ?? 999);
  });
}

// ============================================================
// tool - 插件主函数
// ============================================================

export async function tool(
  input: z.infer<typeof InputType>
): Promise<z.infer<typeof OutputType>> {
  const apisCalled: string[] = [];
  const apiStatus: Record<string, 'success' | 'failed' | 'skipped'> = {};

  try {
    // ===== 诊断信息收集（不暴露给用户） =====
    const diagLines: string[] = [];
    diagLines.push(`收到参数: question="${input.question || '(空)'}", origin="${input.origin || '(空)'}", destination="${input.destination || '(空)'}", transportMode="${input.transportMode || '(空)'}"`);

    // 1. 解析用户问题（优先使用上层 LLM 传入的结构化参数）
    let origin = input.origin;
    let destination = input.destination;
    let transportPreference: string[] | undefined = input.transportMode
      ? [input.transportMode]
      : undefined;

    // 从 question 文本中解析（获取完整解析结果含 routeNumbers/isETAQuery）
    let questionParsed = input.question
      ? parseQuestion(input.question, input.language)
      : null;

    // 结构化参数不完整时，从文本解析结果中补充
    if (questionParsed) {
      origin = origin || questionParsed.origin;
      destination = destination || questionParsed.destination;
      if (!transportPreference) {
        transportPreference = questionParsed.transportPreference;
      }
    }

    diagLines.push(`解析结果: origin="${origin || '(未识别)'}", destination="${destination || '(未识别)'}"`);

    // 统一 parsed 接口供下游使用（保留 routeNumbers/isETAQuery）
    const parsed: ParsedQuestion = {
      origin,
      destination,
      transportPreference,
      keywords: input.question ? input.question.split(/[\s,，。.!！?？]+/).filter(Boolean) : [],
      routeNumbers: questionParsed?.routeNumbers,
      isETAQuery: questionParsed?.isETAQuery,
    };

    // ===== ETA 查询：单地点 + 路线编号 + 到站时间关键词 =====
    if (parsed.isETAQuery && parsed.routeNumbers && parsed.routeNumbers.length > 0) {
      const stopName = parsed.origin || parsed.destination;
      const routeNum = parsed.routeNumbers[0];

      if (stopName && routeNum) {
        diagLines.push(`ETA查询: stop="${stopName}", route="${routeNum}"`);
        const stopEntry = findStopByName(stopName);

        if (stopEntry) {
          const stopId = String(stopEntry.sid);
          diagLines.push(`找到站点: ${stopEntry.name} (sid=${stopId})`);
          apisCalled.push('kmb');

          try {
            const kmbResult = await fetchKMBStopETA(stopId);
            if (kmbResult.success && kmbResult.data) {
              const matchingETAs = kmbResult.data.filter(
                item => item.route.toUpperCase() === routeNum.toUpperCase()
              );

              if (matchingETAs.length > 0) {
                const nextBuses = matchingETAs.map(item => {
                  let minutesAway = -1;
                  if (item.eta) {
                    const etaTime = new Date(item.eta);
                    const diffMs = etaTime.getTime() - Date.now();
                    minutesAway = Math.max(0, Math.round(diffMs / 60000));
                  }
                  return { eta: item.eta, minutesAway, remarks: item.rmk_tc || undefined };
                });

                apiStatus['kmb'] = 'success';
                return {
                  routes: [],
                  stopETAs: {
                    stopId,
                    stopName: stopEntry.name,
                    etas: [{
                      route: routeNum,
                      destination: matchingETAs[0].dest_tc,
                      company: matchingETAs[0].co,
                      nextBuses,
                    }],
                  },
                  paymentInfo: generatePaymentInfo([]),
                  tips: [
                    `${routeNum}路线：往${matchingETAs[0].dest_tc}方向`,
                    ...nextBuses.map((b, i) =>
                      b.eta
                        ? `第${i + 1}班预计${b.minutesAway}分钟后到达`
                        : `第${i + 1}班暂无预计到站时间`
                    ),
                  ],
                  metadata: { dataTimestamp: new Date().toISOString(), apisCalled, apiStatus },
                  _debug: diagLines,
                };
              }
              diagLines.push(`路线${routeNum}在站点${stopId}无ETA数据`);
            } else {
              diagLines.push(`KMB ETA查询失败: ${kmbResult.error}`);
              apiStatus['kmb'] = 'failed';
            }
          } catch (etaErr) {
            diagLines.push(`ETA查询异常: ${etaErr}`);
            apiStatus['kmb'] = 'failed';
          }

          return {
            routes: [],
            paymentInfo: generatePaymentInfo([]),
            tips: [
              `已识别车站"${stopEntry.name}"`,
              `暂无法获取${routeNum}路线的实时到站信息，请稍后查询。`,
            ],
            metadata: { dataTimestamp: new Date().toISOString(), apisCalled, apiStatus },
            _debug: diagLines,
          };
        }
        diagLines.push(`未在数据库中匹配到站点"${stopName}"`);
      }
    }

    // 2. 地理编码（带 OSM Nominatim 外网回退）
    const { originCoord, destCoord } = await geocodeRouteWithFallback(parsed.origin, parsed.destination);

    if (originCoord) {
      const sourceNote = isOrganizationName(parsed.origin || '') ? ' [Nominatim联网搜索]' : '';
      diagLines.push(`起点坐标: ${originCoord.name} (${originCoord.lat.toFixed(4)}, ${originCoord.lng.toFixed(4)})${sourceNote}`);
    } else if (origin) diagLines.push(`起点"${origin}"未找到坐标`);
    if (destCoord) {
      const sourceNote = isOrganizationName(parsed.destination || '') ? ' [Nominatim联网搜索]' : '';
      diagLines.push(`终点坐标: ${destCoord.name} (${destCoord.lat.toFixed(4)}, ${destCoord.lng.toFixed(4)})${sourceNote}`);
    } else if (destination) diagLines.push(`终点"${destination}"未找到坐标`);

    if (!parsed.origin && !parsed.destination) {
      return buildErrorResponse(
        '无法识别您想去的地点，请直接告诉我起点和终点。例如"从中环到铜锣湾怎么走"。',
        apisCalled, apiStatus, diagLines
      );
    }

    // ========================================================
    // 3. 多模态公交规划器（使用内置的香港政府官方 GeoJSON 数据）
    //    覆盖 KMB/CTB/NLB/LWB 巴士 + 专线小巴 + 电车 + 渡轮 + 山顶缆车 + 港铁
    //    要求：起终点都有坐标
    // ========================================================
    const routeOptions: RouteOption[] = [];
    let plannerErrorDetail: string | undefined;
    let overnightOnly = false;

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
        overnightOnly = Boolean(planResult.overnightOnly);
        apiStatus['transit-planner'] = planResult.noNearbyStops ? 'skipped' : 'failed';
        plannerErrorDetail = planResult.noNearbyStops
          ? `起终点 800 米内无任何公交站点`
          : overnightOnly
            ? `日间无日间线路，仅通宵线覆盖（白天停开）`
            : `找到附近站点但无直达路线（可能需要换乘）`;
      } else {
        apiStatus['transit-planner'] = 'success';
        
        // ========================================================
        // 3.1 实时数据注入：为候选路线查询实时 ETA
        // ========================================================
        diagLines.push(`开始为 ${planResult.candidates.length} 条路线注入实时数据`);
        const enrichedCandidates = await enrichCandidatesWithRealTimeETA(planResult.candidates);
        
        // 记录实时数据获取情况
        const realTimeCount = enrichedCandidates.filter(c => c.realTimeETA?.dataSource !== 'static').length;
        diagLines.push(`实时数据获取成功: ${realTimeCount}/${enrichedCandidates.length} 条路线`);
        
        // ========================================================
        // 3.2 智能排序：基于实时总时长重新排序（白天通宵线沉底）
        // ========================================================
        sortEnrichedCandidates(enrichedCandidates);
        
        // 转换为 RouteOption 并标记推荐路线
        routeOptions.push(...buildRouteOptions(enrichedCandidates));
        
        diagLines.push(`推荐路线: ${enrichedCandidates[0]?.route} (总时长 ${enrichedCandidates[0]?.realTimeETA?.totalMinutes}分钟)`);
      }
    } else {
      apisCalled.push('transit-planner');
      apiStatus['transit-planner'] = 'skipped';
    }

    // ========================================================
    // 4. 智能地名扩展：当第一次规划无结果时，尝试用后缀变体重试 geocode + 规划
    //    例："石门" → 尝试 "石门站""石門站""石门巴士总站" → 重新查坐标 → 重新规划
    // ========================================================
    if (routeOptions.length === 0 && originCoord && destCoord) {
      const expandNames = (name: string): string[] => {
        const base = name.replace(/(?:站|巴士站|巴士總站|巴士总站|地鐵站|地铁站|總站|总站)$/, '');
        const isTC = /[門東島線頭馬廣車雲園碼會場樂蘭廟觀黃紅體區樓醫學長飛萬華國處點時機運動務號業發來説開間關裏過邊還進連聯鄉農總舊橋嶺嶼廈寶達榮豐興設舖鋪歷慶節藍綠錦銀銅鑽鐘鑼鵝鳳鶴雞魚蝦貓窩邨碩徑閣瀝匯薈]/.test(base);
        if (isTC) {
          return [`${base}站`, `${base}巴士總站`, `${base}巴士站`, `${base}總站`, base];
        }
        return [`${base}站`, `${base}巴士总站`, `${base}巴士站`, `${base}总站`, base];
      };

      for (const expandedOrigin of expandNames(parsed.origin || '')) {
        if (expandedOrigin === (parsed.origin || '')) continue;
        const newOriginCoord = geocode(expandedOrigin);
        if (!newOriginCoord) continue;

        for (const expandedDest of expandNames(parsed.destination || '')) {
          if (expandedDest === (parsed.destination || '') && expandedOrigin === (parsed.origin || '')) continue;
          const newDestCoord = geocode(expandedDest);
          if (!newDestCoord) continue;

          diagLines.push(`地名扩展重试: origin="${expandedOrigin}" → (${newOriginCoord.lat.toFixed(4)}, ${newOriginCoord.lng.toFixed(4)}), dest="${expandedDest}" → (${newDestCoord.lat.toFixed(4)}, ${newDestCoord.lng.toFixed(4)})`);
          const retryResult = await planPublicTransit(
            newOriginCoord.lat, newOriginCoord.lng,
            newDestCoord.lat, newDestCoord.lng
          );

          if (retryResult.candidates.length > 0) {
            apiStatus['transit-planner'] = 'success';
            const enrichedRetry = await enrichCandidatesWithRealTimeETA(retryResult.candidates);
            sortEnrichedCandidates(enrichedRetry);
            routeOptions.push(...buildRouteOptions(enrichedRetry));
            diagLines.push(`地名扩展成功: 找到 ${routeOptions.length} 条路线`);
            break;
          }
        }
        if (routeOptions.length > 0) break;
      }
    }

    // ========================================================
    // 5. 如果公交规划 + 地名扩展都没有结果，尝试旧的 TDAS 作为降级参考
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

    // 都没找到路线时的提示
    if (routeOptions.length === 0) {
      let errorMsg: string;
      if (apiStatus['transit-planner'] === 'skipped' && !originCoord && origin) {
        errorMsg = `未找到"${origin}"附近的公共交通站点。`;
      } else if (apiStatus['transit-planner'] === 'skipped' && !destCoord && destination) {
        errorMsg = `未找到"${destination}"附近的公共交通站点。`;
      } else if (overnightOnly) {
        errorMsg = `从"${origin || '起点'}"到"${destination || '终点'}"只有通宵巴士线路（N/NA 字头）覆盖，这类线路白天不发车，建议改乘港铁或分段出行。`;
      } else {
        // 不再建议"换更大范围查询"——该措辞会导致 LLM 反复调用工具
        errorMsg = `暂未查询到从"${origin || '起点'}"到"${destination || '终点'}"的公共交通直达路线，建议改用其他出行方式或尝试分段查询不同路段。`;
      }
      return {
        routes: [],
        paymentInfo,
        tips: [...baseTips, errorMsg],
        metadata,
        error: errorMsg,
        _debug: diagLines,
      };
    }

    const failedAPIs = Object.entries(apiStatus)
      .filter(([, s]) => s === 'failed')
      .map(([api]) => api);

    const tips = [...baseTips];
    if (failedAPIs.length > 0) {
      tips.push(`部分数据源暂不可用，可能影响实时信息的准确性。`);
    }
    if (plannerErrorDetail) {
      diagLines.push(`交通规划器: ${plannerErrorDetail}`);
    }

    return {
      routes: routeOptions,
      stopETAs,
      paymentInfo,
      tips,
      metadata,
      _debug: diagLines,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return buildErrorResponse(
      '查询时遇到技术问题，请稍后重试。',
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
  apiStatus: Record<string, 'success' | 'failed' | 'skipped'>,
  debugLines?: string[]
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
    _debug: debugLines,
  };
}
