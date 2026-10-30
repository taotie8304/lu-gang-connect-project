// 鲁港通 - 巴士/小巴/电车/渡轮车程估算
//
// 政府数据的 time 字段是「全程行车时间」，单靠站数比例会严重低估跨区快线：
// 例如 960P 屯门→中环 7 站跨 24.6 公里，站数分摊只算出 12 分钟，
// 而 B3 深圳湾口岸→屯门市中心只隔 1 个站、实际 12.6 公里。
// 站数只反映停站损耗，不反映里程，快线段（站距远大于全程平均）尤其失真。
// 因此：
//   1. 里程分摊：全程时间 × 乘坐里程 / 全程里程 —— 主口径
//   2. 物理速度模型：按逐段站距推断道路等级（市区支路/主干道/快速路）—— 校正拥堵
//   3. 站数分摊：仅在缺里程数据时兜底

export interface RideTimeInput {
  /** 官方全程行车时间（分钟），来自 data.gov.hk */
  officialMinutes?: number | null;
  /** 本次乘坐站数 */
  legStops: number;
  /** 该路线方向全程站数 */
  totalStops: number;
  /** 本次乘坐沿线里程（公里） */
  legKm: number;
  /** 该路线方向全程里程（公里） */
  totalKm: number;
  /** 逐段累计的物理耗时（分钟），有站点序列时由调用方精确计算 */
  physicalMinutes?: number | null;
}

// 每停一站的平均损耗（开门+关门+起步减速）
const DWELL_MIN_PER_STOP = 0.35;
// 任何车辆的平均速度都不可能超过 70 公里/小时（含停站）
const MAX_AVG_SPEED_KMH = 70;

/** 单段站间运行时间（分钟）：站距越短说明路况越拥堵 */
export function segmentRunMinutes(km: number): number {
  const speedKmh =
    km < 0.35 ? 10
    : km < 0.7 ? 14
    : km < 1.2 ? 18
    : km < 2 ? 23
    : km < 4 ? 30
    : km < 7 ? 40
    : 55;
  return (km / speedKmh) * 60 + DWELL_MIN_PER_STOP;
}

/** 只知道总里程与站数时的物理估算（按平均站距套用速度模型） */
export function physicalLegMinutes(legKm: number, legStops: number): number {
  if (legKm <= 0) return 0;
  const segments = Math.max(1, legStops);
  return segments * segmentRunMinutes(legKm / segments);
}

/**
 * 估算乘车时间（分钟）。
 * 里程分摊为主、物理模型校正；缺里程时退回站数分摊。
 * 再用「平均速度上限」兜住物理下界、官方全程时数兜住上界。
 */
export function estimateRideMinutes(input: RideTimeInput): number {
  const { officialMinutes, legStops, totalStops, legKm, totalKm, physicalMinutes } = input;

  if (legKm <= 0 && legStops <= 0) return 0;

  const hasOfficial = Boolean(officialMinutes && officialMinutes > 0);
  const stops = Math.max(0, legStops);

  const distanceEstimate = hasOfficial && totalKm > 0 && legKm > 0
    ? officialMinutes! * Math.min(1, legKm / totalKm)
    : null;
  const stopEstimate = hasOfficial && totalStops > 1
    ? officialMinutes! * Math.min(1, stops / (totalStops - 1))
    : null;
  const physical = physicalMinutes && physicalMinutes > 0
    ? physicalMinutes
    : physicalLegMinutes(legKm, stops);

  let blended: number;
  if (distanceEstimate !== null) {
    blended = physical > 0
      ? distanceEstimate * 0.75 + physical * 0.25
      : distanceEstimate;
  } else if (stopEstimate !== null) {
    blended = physical > 0
      ? stopEstimate * 0.5 + physical * 0.5
      : stopEstimate;
  } else if (physical > 0) {
    blended = physical;
  } else {
    return 2;
  }

  const speedFloor = legKm > 0 ? (legKm / MAX_AVG_SPEED_KMH) * 60 : 0;
  let minutes = Math.max(blended, speedFloor);
  // 官方全程时数含总站滞留，任何单段都不可能超过它
  if (hasOfficial && officialMinutes! >= speedFloor) {
    minutes = Math.min(minutes, officialMinutes!);
  }
  return Math.max(2, Math.round(minutes));
}
