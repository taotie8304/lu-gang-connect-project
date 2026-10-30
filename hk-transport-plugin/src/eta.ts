// 鲁港通 - ETA 措辞与事实口径（估算不得伪装实时；运营商/票价/服务日用准确中文）
import type { EtaDataSource } from './types';

/** 估算说明：仅在存在静态兜底候车时间时附带 */
export const ESTIMATE_TIP =
  '部分线路暂无实时到站数据，标注「约X分钟（估算）」为按班次密度推算，非实时，请以站牌或运营方 App 为准。';

/** 数据源缺失或为 static 时一律按估算处理 */
export function isEstimatedEta(dataSource?: EtaDataSource | string): boolean {
  return !dataSource || dataSource === 'static';
}

/** 候车时间措辞：实时给确定值，估算必须显式标注 */
export function formatNextBusArrival(minutes: number, dataSource?: EtaDataSource | string): string {
  if (minutes < 0) return '暂无数据';
  const estimated = isEstimatedEta(dataSource);
  if (minutes === 0) return estimated ? '即将到达（估算）' : '即将到达';
  return estimated ? `约${minutes}分钟（估算）` : `${minutes}分钟后`;
}

/** 运营商代码 → 中文名，避免模型把 KMB 转写成别的公司 */
export function companyLabel(company?: string): string {
  if (!company) return '巴士';
  const parts = company.split('+').map((c) => c.trim().toUpperCase());
  const names = parts.map((c) => COMPANY_NAMES[c] ?? c);
  if (names.length > 1) return `${names.join('/')}联营`;
  return names[0];
}

const COMPANY_NAMES: Record<string, string> = {
  KMB: '九巴',
  CTB: '城巴',
  LWB: '龙运巴士',
  NLB: '屿巴',
  GMB: '专线小巴',
  MTR: '港铁',
  TRAM: '香港电车',
  FERRY: '渡轮',
  PTRAM: '山顶缆车',
};

/**
 * 服务日提示：只在路线命名规则能确定「非常规班次」时给出，避免误判。
 * R 字尾在香港多指假日／特别路线（92R、96R、275R）；小巴 S 字尾多为通宵或特别班次（61S、805S）。
 */
export function routeServiceHint(routeName: string, mode?: string): string | undefined {
  const name = routeName.trim().toUpperCase();
  if (mode === 'gmb' && /S$/.test(name)) {
    return 'S 字尾小巴多为通宵或特别班次，出行前请确认当日服务时间';
  }
  if (mode === 'bus' && /R$/.test(name)) {
    return 'R 字尾巴士多为假日／特别路线，出行前请确认当日是否服务';
  }
  return undefined;
}

/** 巴士／小巴票价口径：数据集只有全程票价，分段收费需提醒 */
export function fareNoteFor(mode: string | undefined, fare: number | null | undefined): string | undefined {
  if (typeof fare !== 'number' || fare <= 0) return undefined;
  if (mode === 'bus' || mode === 'gmb') {
    return `全程票价 HK$${fare}，中途上车按分段收费，以站牌为准`;
  }
  return undefined;
}
