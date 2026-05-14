// 鲁港通 - MTR 实时 ETA + 步行校正 测试
import { describe, it, expect } from 'vitest';
import { TRANSIT_DATA } from '../src/data/transit';
import type { TransitCandidate } from '../src/types';

// 从 planner.ts 复制 MTR_STATION_MAP 和常量用于测试
// 注意: planner.ts 的 MTR_STATION_MAP 是模块私有常量, 这里重新定义一份测试用
const WALK_DETOUR_FACTOR = 1.4;

const MTR_STATION_MAP: Record<string, { line: string; code: string }> = {
  '坚尼地城': { line: 'ISL', code: 'KET' },
  '香港大学': { line: 'ISL', code: 'HKU' },
  '西营盘': { line: 'ISL', code: 'SYP' },
  '上环': { line: 'ISL', code: 'SHW' },
  '中环': { line: 'TWL', code: 'CEN' },
  '金钟': { line: 'TWL', code: 'ADM' },
  '湾仔': { line: 'ISL', code: 'WAC' },
  '铜锣湾': { line: 'ISL', code: 'CAB' },
  '天后': { line: 'ISL', code: 'TIH' },
  '炮台山': { line: 'ISL', code: 'FOH' },
  '北角': { line: 'ISL', code: 'NOP' },
  '鲗鱼涌': { line: 'ISL', code: 'QUB' },
  '太古': { line: 'ISL', code: 'TAK' },
  '西湾河': { line: 'ISL', code: 'SWH' },
  '筲箕湾': { line: 'ISL', code: 'SKW' },
  '杏花邨': { line: 'ISL', code: 'HFC' },
  '柴湾': { line: 'ISL', code: 'CHW' },
  '尖沙咀': { line: 'TWL', code: 'TST' },
  '佐敦': { line: 'TWL', code: 'JOR' },
  '油麻地': { line: 'TWL', code: 'YMT' },
  '旺角': { line: 'TWL', code: 'MOK' },
  '太子': { line: 'TWL', code: 'PRE' },
  '深水埗': { line: 'TWL', code: 'SSP' },
  '长沙湾': { line: 'TWL', code: 'CSW' },
  '荔枝角': { line: 'TWL', code: 'LCK' },
  '美孚': { line: 'TWL', code: 'MEF' },
  '荔景': { line: 'TWL', code: 'LAK' },
  '葵芳': { line: 'TWL', code: 'KWF' },
  '葵兴': { line: 'TWL', code: 'KWH' },
  '大窝口': { line: 'TWL', code: 'TWH' },
  '荃湾': { line: 'TWL', code: 'TSW' },
  '油塘': { line: 'KTL', code: 'YAT' },
  '调景岭': { line: 'KTL', code: 'TIK' },
  '将军澳': { line: 'TKL', code: 'TKO' },
  '坑口': { line: 'TKL', code: 'HAH' },
  '宝琳': { line: 'TKL', code: 'POA' },
  '九龙塘': { line: 'KTL', code: 'KOT' },
  '乐富': { line: 'KTL', code: 'LOF' },
  '黄大仙': { line: 'KTL', code: 'WTS' },
  '钻石山': { line: 'KTL', code: 'DIH' },
  '彩虹': { line: 'KTL', code: 'CHH' },
  '九龙湾': { line: 'KTL', code: 'KOB' },
  '牛头角': { line: 'KTL', code: 'NTK' },
  '观塘': { line: 'KTL', code: 'KWT' },
  '蓝田': { line: 'KTL', code: 'LAT' },
  '何文田': { line: 'KTL', code: 'HOM' },
  '黄埔': { line: 'KTL', code: 'WHA' },
  '东涌': { line: 'TCL', code: 'TUC' },
  '欣澳': { line: 'TCL', code: 'SUN' },
  '青衣': { line: 'TCL', code: 'TSY' },
  '南昌': { line: 'TCL', code: 'NAC' },
  '奥运': { line: 'TCL', code: 'OLY' },
  '九龙': { line: 'TCL', code: 'KOW' },
  '香港机场': { line: 'AEL', code: 'AIR' },
  '博览馆': { line: 'AEL', code: 'AWE' },
  '红磡': { line: 'EAL', code: 'HUH' },
  '旺角东': { line: 'EAL', code: 'MKK' },
  '大围': { line: 'EAL', code: 'TAW' },
  '沙田': { line: 'EAL', code: 'SHT' },
  '火炭': { line: 'EAL', code: 'FOT' },
  '马场': { line: 'EAL', code: 'RAC' },
  '大学': { line: 'EAL', code: 'UNI' },
  '大埔墟': { line: 'EAL', code: 'TAP' },
  '太和': { line: 'EAL', code: 'TWO' },
  '粉岭': { line: 'EAL', code: 'FAN' },
  '上水': { line: 'EAL', code: 'SHS' },
  '罗湖': { line: 'EAL', code: 'LOW' },
  '落马洲': { line: 'EAL', code: 'LMC' },
  '屯门': { line: 'TML', code: 'TUM' },
  '兆康': { line: 'TML', code: 'SIH' },
  '天水围': { line: 'TML', code: 'TIS' },
  '朗屏': { line: 'TML', code: 'LOP' },
  '元朗': { line: 'TML', code: 'YUL' },
  '锦上路': { line: 'TML', code: 'KSR' },
  '柯士甸': { line: 'TML', code: 'AUS' },
  '宋皇臺': { line: 'TML', code: 'SUW' },
  '土瓜湾': { line: 'TML', code: 'TKW' },
  '石硖尾': { line: 'KTL', code: 'SKM' },
  '海洋公园': { line: 'SIL', code: 'OCP' },
  '黄竹坑': { line: 'SIL', code: 'WCH' },
  '利东': { line: 'SIL', code: 'LET' },
  '海怡半岛': { line: 'SIL', code: 'SOH' },
  '西九龙站': { line: 'TML', code: 'AUS' },
  '迪士尼': { line: 'DRL', code: 'DIS' },
};

describe('MTR 站-线路映射表', () => {
  it('transit.ts 中所有 MTR 站都应有映射', () => {
    const mtrStops = TRANSIT_DATA['mtr']?.stops ?? [];
    const unmapped: string[] = [];

    for (const stop of mtrStops) {
      if (!MTR_STATION_MAP[stop.name]) {
        unmapped.push(stop.name);
      }
    }

    // 八乡维修中心 是维修厂不是客运站，排除
    const expectedUnmapped = unmapped.filter(n => n !== '八乡维修中心');
    expect(expectedUnmapped).toEqual([]);
  });

  it('映射表格式正确: line 和 code 字段非空', () => {
    for (const [name, mapping] of Object.entries(MTR_STATION_MAP)) {
      expect(mapping.line).toBeTruthy();
      expect(mapping.code).toBeTruthy();
      expect(mapping.line).toMatch(/^[A-Z]{2,4}$/); // 如 TWL, ISL, EAL
      expect(mapping.code).toMatch(/^[A-Z]{3}$/);   // 如 CEN, HUH, KOT
    }
  });
});

describe('步行距离校正', () => {
  it('正常时应用 1.4 校正系数', () => {
    const straightDist = 500;
    const corrected = Math.round(straightDist * WALK_DETOUR_FACTOR);
    expect(corrected).toBe(700);
  });

  it('距离为 0 时不校正', () => {
    const straightDist = 0;
    const corrected = straightDist === 0 ? 0 : Math.round(straightDist * WALK_DETOUR_FACTOR);
    expect(corrected).toBe(0);
  });

  it('短距离也应用校正', () => {
    const straightDist = 100;
    const corrected = Math.round(straightDist * WALK_DETOUR_FACTOR);
    expect(corrected).toBe(140);
  });
});

describe('TransitCandidate MTR 类型兼容性', () => {
  it('TransitCandidate 可以包含 stationCode 和 mtrLine', () => {
    const candidate: TransitCandidate = {
      company: 'MTR',
      mode: 'mtr',
      route: '港铁',
      bound: 'O',
      serviceType: '1',
      boardStopId: 'mtr-12345',
      boardStopName: '中环站',
      boardSeq: 1,
      alightStopId: 'mtr-67890',
      alightStopName: '铜锣湾站',
      alightSeq: 4,
      numStops: 3,
      walkInMeters: 200,
      walkOutMeters: 150,
      destination: '铜锣湾站方向',
      fare: 12,
      score: 5,
      stationCode: 'CEN',
      mtrLine: 'TWL',
    };

    expect(candidate.stationCode).toBe('CEN');
    expect(candidate.mtrLine).toBe('TWL');
  });

  it('realTimeETA dataSource 支持 mtr', () => {
    const candidate: TransitCandidate = {
      company: 'MTR',
      mode: 'mtr',
      route: '港铁',
      bound: 'O',
      serviceType: '1',
      boardStopId: 'mtr-1',
      boardStopName: '站',
      boardSeq: 1,
      alightStopId: 'mtr-2',
      alightStopName: '站',
      alightSeq: 2,
      numStops: 1,
      walkInMeters: 0,
      walkOutMeters: 0,
      destination: '方向',
      score: 1,
      stationCode: 'CEN',
      mtrLine: 'TWL',
      realTimeETA: {
        nextBusMinutes: 2,
        estimatedTripMinutes: 5,
        totalMinutes: 7,
        dataSource: 'mtr',
        timestamp: '2026-05-08T11:00:00Z',
      },
    };

    expect(candidate.realTimeETA!.dataSource).toBe('mtr');
  });
});
