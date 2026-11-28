// 鲁港通 - 线路服务时段判定（按出发时刻判断线路是否在服务期）
//
// 政府静态 GeoJSON 只有路线/票价/全程时数，没有首末班时间。历史缺陷：
// 深夜仍把已收车的日间线当可用方案（如 00:30 推已收车的 E41），或把
// 白天停开的通宵线当首选。这里按线路形态给保守服务窗口，宁可在不确定
// 时提示「可能已收车」，也不虚构班次。香港无夏令时，HKT 固定 UTC+8。

export type ServiceStatus = 'in-service' | 'out-of-service' | 'unverified';

export interface ServiceVerdict {
  status: ServiceStatus;
  /** 面向用户的服务说明（收车原因 / 假日专线提示），可原样转述 */
  note?: string;
}

// N/NA 字头 = 通宵巴士线（如 N23 / N21A / NA21）
const OVERNIGHT_ROUTE_RE = /^N[A-Z]?\d/;

export function isOvernightRoute(routeName: string): boolean {
  return OVERNIGHT_ROUTE_RE.test((routeName || '').trim());
}

const HK_CLOCK_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Hong_Kong',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const HK_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Hong_Kong',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const HK_WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Hong_Kong',
  weekday: 'short',
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export interface HongKongDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0=周日 … 6=周六 */
  weekday: number;
}

export function hongKongDateParts(at: Date): HongKongDateParts {
  const parts: Record<string, string> = {};
  for (const p of HK_DATE_FORMAT.formatToParts(at)) parts[p.type] = p.value;
  let hour = 0;
  let minute = 0;
  for (const p of HK_CLOCK_FORMAT.formatToParts(at)) {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
  }
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour,
    minute,
    weekday: WEEKDAY_INDEX[HK_WEEKDAY_FORMAT.format(at)] ?? 0,
  };
}

/** 香港一日内的分钟数（00:00 = 0） */
export function hongKongMinutes(at: Date): number {
  const { hour, minute } = hongKongDateParts(at);
  return hour * 60 + minute;
}

/** 用香港墙上时间构造时间点（HKT = UTC+8） */
export function fromHongKongTime(
  year: number, month: number, day: number, hour: number, minute: number
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 8 * 3600 * 1000);
}

/** 按香港日历加天数（避免服务器时区影响） */
export function addHongKongDays(at: Date, days: number): Date {
  const p = hongKongDateParts(at);
  return fromHongKongTime(p.year, p.month, p.day + days, p.hour, p.minute);
}

/** 面向用户的出发时刻标签，如「11-28 05:00」 */
export function formatHongKongDateTime(at: Date): string {
  const p = hongKongDateParts(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

// 服务窗口（分钟数，香港时间）
const MTR_FIRST = 5 * 60 + 30;   // 港铁首班约 05:30
const MTR_LAST = 60;             // 港铁末班约 01:00
const DAY_FIRST = 5 * 60 + 30;   // 常规线路首班约 05:30
const DAY_LAST = 30;             // 常规线路末班约 00:30
const NIGHT_FIRST = 15;          // 通宵线约 00:15 起开行
const NIGHT_LAST = 6 * 60;       // 通宵线服务至约 06:00

function inCrossMidnightWindow(minutes: number, first: number, last: number): boolean {
  return minutes >= first || minutes < last;
}

/**
 * 判定线路在给定出发时刻是否服务。
 * 无法静态确定的情况（如小巴 S 字尾特别班次）返回 unverified，不误杀。
 */
export function classifyService(
  routeName: string,
  mode: string | undefined,
  departure: Date
): ServiceVerdict {
  const minutes = hongKongMinutes(departure);
  const { weekday } = hongKongDateParts(departure);
  const m = mode || 'bus';
  const name = (routeName || '').trim().toUpperCase();

  if (m === 'mtr') {
    if (inCrossMidnightWindow(minutes, MTR_FIRST, MTR_LAST)) return { status: 'in-service' };
    return { status: 'out-of-service', note: '港铁末班车约 01:00 开出、首班约 05:30，此时段已停止服务' };
  }

  if (m === 'bus' && isOvernightRoute(name)) {
    if (minutes >= NIGHT_FIRST && minutes < NIGHT_LAST) {
      return { status: 'in-service', note: '通宵线（约 00:30–05:30 提供服务）' };
    }
    return { status: 'out-of-service', note: '通宵线约 00:30 后开行，此时段尚未开始服务' };
  }

  if (m === 'bus' && /R$/.test(name)) {
    const isWeekend = weekday === 0 || weekday === 6;
    if (!isWeekend) {
      return { status: 'out-of-service', note: '假日专线（R 字尾）仅星期日及公众假期服务，平日不开行' };
    }
    if (inCrossMidnightWindow(minutes, DAY_FIRST, DAY_LAST)) {
      return { status: 'in-service', note: '假日专线，仅星期日及公众假期服务，请确认当日安排' };
    }
    return { status: 'out-of-service', note: '假日专线此时段不服务' };
  }

  if (m === 'gmb' && /S$/.test(name)) {
    return { status: 'unverified', note: 'S 字尾小巴多为通宵或特别班次，请确认当日服务时间' };
  }

  if (inCrossMidnightWindow(minutes, DAY_FIRST, DAY_LAST)) return { status: 'in-service' };
  return { status: 'out-of-service', note: '常规线路约 05:30–00:30 服务，此时段已收车' };
}