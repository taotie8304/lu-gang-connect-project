// 鲁港通 - 智能路由模块
// 根据解析结果决定调用哪些 API，生成 API 调用计划

import { ParsedQuestion, GeoLocation, APICallPlan, ETAQuery } from './types';
import { parseQuestion } from './parser';
import { geocodeRoute } from './geocoder';

// ============================================================
// 交通偏好 → API 类型映射
// ============================================================

const PREFERENCE_TO_API: Record<string, ETAQuery['type'][]> = {
  bus: ['kmb', 'ctb'],
  mtr: ['mtr'],
  gmb: ['gmb'],
  nlb: ['nlb'],
  ferry: [],   // 渡轮暂无 ETA API
  tram: [],    // 电车暂无 ETA API
};

// 默认 ETA 查询类型（无偏好时）
const DEFAULT_ETA_TYPES: ETAQuery['type'][] = ['kmb', 'ctb'];

// ============================================================
// 路由规则引擎
// ============================================================

/**
 * 根据解析结果和坐标生成 API 调用计划
 *
 * 规则：
 * 1. 有起点+终点坐标 → 调用 TDAS 路径规划
 * 2. 有交通偏好 → 只调用对应的 ETA API
 * 3. 无偏好 → 默认调用 TDAS + KMB + CTB
 */
export function createAPICallPlan(
  parsed: ParsedQuestion,
  originCoord?: GeoLocation,
  destCoord?: GeoLocation
): APICallPlan {
  const plan: APICallPlan = {
    useTDAS: false,
    etaQueries: [],
  };

  // 规则 1：有起点和终点坐标时，调用 TDAS 路径规划
  if (originCoord && destCoord) {
    plan.useTDAS = true;
    plan.tdasParams = {
      start: { lat: originCoord.lat, long: originCoord.lng },
      end: { lat: destCoord.lat, long: destCoord.lng },
    };
  }

  // 规则 2/3：根据交通偏好决定 ETA 查询
  const etaTypes = resolveETATypes(parsed.transportPreference);

  for (const type of etaTypes) {
    plan.etaQueries.push({ type });
  }

  return plan;
}

/**
 * 将交通偏好列表转换为需要查询的 ETA API 类型列表（去重）
 */
export function resolveETATypes(preferences?: string[]): ETAQuery['type'][] {
  if (!preferences || preferences.length === 0) {
    return [...DEFAULT_ETA_TYPES];
  }

  const types = new Set<ETAQuery['type']>();

  for (const pref of preferences) {
    const mapped = PREFERENCE_TO_API[pref];
    if (mapped) {
      for (const t of mapped) {
        types.add(t);
      }
    }
  }

  // 如果偏好映射后没有任何 ETA 类型（如只选了 ferry/tram），回退到默认
  if (types.size === 0) {
    return [...DEFAULT_ETA_TYPES];
  }

  return Array.from(types);
}


// ============================================================
// 高级路由计划生成（组合 parser + geocoder + router）
// ============================================================

export interface RoutePlanResult {
  parsed: ParsedQuestion;
  plan: APICallPlan;
  errors: string[];
}

/**
 * 从用户问题直接生成完整的 API 调用计划
 * 组合 parser → geocoder → router 三个步骤
 */
export function buildRoutePlan(question: string, language: string): RoutePlanResult {
  const errors: string[] = [];

  // 1. 解析用户问题
  const parsed = parseQuestion(question, language);

  // 2. 地理编码
  const { originCoord, destCoord } = geocodeRoute(parsed.origin, parsed.destination);

  if (parsed.origin && !originCoord) {
    errors.push(`无法获取"${parsed.origin}"的坐标信息`);
  }
  if (parsed.destination && !destCoord) {
    errors.push(`无法获取"${parsed.destination}"的坐标信息`);
  }
  if (!parsed.origin && !parsed.destination) {
    errors.push('无法识别起点或终点，请提供更具体的地点名称');
  }

  // 3. 生成 API 调用计划
  const plan = createAPICallPlan(parsed, originCoord, destCoord);

  return { parsed, plan, errors };
}
