// 鲁港通 - 名单查询测试（TDD）：一条龙 / 直资学费 / 幼教计划 / K1 非计划 / 附设幼儿中心
import { describe, it, expect } from 'vitest';
import { fixture, fixtureText } from './fixture';
import { decodeBytes } from '../src/decode';
import {
  parseThroughTrain,
  findThroughTrain,
  filterThroughTrainByDistrict,
  parseDssFee,
  findDssFee,
  parseKgScheme,
  findKgScheme,
  filterKgSchemeByDistrict,
  parseK1NotJoining,
  findK1NotJoining,
  parseNonAidedCcc,
  findNonAidedCcc,
  filterNonAidedCccByDistrict,
} from '../src/queries/list';

const throughTrain = parseThroughTrain(fixtureText('through-train-tc.csv'));
const dssFee = parseDssFee(fixtureText('dss-fee-tc.csv'));
const kgScheme = parseKgScheme(fixtureText('KG_SCHEME_202526.utf8.csv'));
const k1NotJoining = parseK1NotJoining(fixtureText('k1-not-joining-2026-tc.csv'));
const nonAidedCcc = parseNonAidedCcc(decodeBytes(fixture('ccckg-non-aided-tc.csv')));

describe('parseThroughTrain（一条龙名单）', () => {
  it('解析 31 条记录（15 组）', () => {
    expect(throughTrain).toHaveLength(31);
  });

  it('字段映射：新會商會學校（组 13，中西區）', () => {
    const r = throughTrain.find((x) => x.name === '新會商會學校');
    expect(r?.groupNo).toBe('13');
    expect(r?.district).toBe('中西區');
  });

  it('按校名查一条龙：返回整组（小学 + 中学）', () => {
    const list = findThroughTrain(throughTrain, '新會商會學校');
    expect(list.map((x) => x.name).sort()).toEqual(['新會商會學校', '新會商會陳白沙紀念中學'].sort());
  });

  it('简体输入：新会商会学校 → 命中', () => {
    expect(findThroughTrain(throughTrain, '新会商会学校')).toHaveLength(2);
  });

  it('未命中：喇沙書院 不在一条龙名单 → 空数组', () => {
    expect(findThroughTrain(throughTrain, '喇沙書院')).toEqual([]);
  });

  it('按区域过滤：元朗 → 10 条（含「元朗区」容错）', () => {
    expect(filterThroughTrainByDistrict(throughTrain, '元朗')).toHaveLength(10);
    expect(filterThroughTrainByDistrict(throughTrain, '元朗区')).toHaveLength(10);
  });
});

describe('parseDssFee（直资学费表）', () => {
  it('解析 163 条记录（69 所学校，一校多行）', () => {
    expect(dssFee).toHaveLength(163);
  });

  it('字段映射：拔萃男書院 中学 S1-S4（固定 63330）', () => {
    const rows = findDssFee(dssFee, '拔萃男書院').filter((x) => x.level === '中學');
    const s1s4 = rows.find((x) => x.classRange === 'S1-S4');
    expect(s1s4?.feeType).toBe('固定');
    expect(s1s4?.feeMin).toBe(63330);
    expect(s1s4?.feeMax).toBe(63330);
    const s5s6 = rows.find((x) => x.classRange === 'S5-S6');
    expect(s5s6?.feeType).toBe('範圍');
    expect(s5s6?.feeMin).toBe(63330);
    expect(s5s6?.feeMax).toBe(145090);
  });

  it('同名中小学：拔萃男書院 → 4 行（中学 3 + 小学 1）', () => {
    expect(findDssFee(dssFee, '拔萃男書院')).toHaveLength(4);
  });

  it('校名尾部空格容错：滙基書院(東九龍)', () => {
    expect(findDssFee(dssFee, '滙基書院(東九龍)')).toHaveLength(3);
  });
});

describe('parseKgScheme（幼教计划名单）', () => {
  it('解析 722 条记录（跨行表头 + 跨行引号字段）', () => {
    expect(kgScheme).toHaveLength(722);
  });

  it('字段映射：聖士提反堂小學暨幼稚園（编号 17，中西區）', () => {
    const r = findKgScheme(kgScheme, '聖士提反堂小學暨幼稚園')[0];
    expect(r?.no).toBe('17');
    expect(r?.district).toBe('中西區');
    expect(r?.districtEn).toBe('Central & Western');
  });

  it('跨行引号字段：力行幼稚園（梅窩鄉事會路校址）校名无换行', () => {
    const r = findKgScheme(kgScheme, '力行幼稚園（梅窩鄉事會路校址）')[0];
    expect(r?.nameEn).toBe('LICK HANG KINDERGARTEN (LOCATION: RURAL COMMITTEE ROAD)');
  });

  it('跨行引号字段合并：美雅幼稚園（分校）（下鄉道89號校址）英文名换行归一为空格', () => {
    const r = findKgScheme(kgScheme, '美雅幼稚園（分校）（下鄉道89號校址）')[0];
    expect(r?.nameEn).toBe('MAY NGA KINDERGARTEN (BRANCH) (LOCATION: 89 RURAL COMMITTEE ROAD)');
  });

  it('未命中：喇沙書院 不在幼教计划名单 → 空数组', () => {
    expect(findKgScheme(kgScheme, '喇沙書院')).toEqual([]);
  });

  it('按区域过滤：沙田區 → 55 条（含「沙田」容错）', () => {
    expect(filterKgSchemeByDistrict(kgScheme, '沙田區')).toHaveLength(55);
    expect(filterKgSchemeByDistrict(kgScheme, '沙田')).toHaveLength(55);
  });
});

describe('parseK1NotJoining（K1 非计划名单）', () => {
  it('解析 29 条记录', () => {
    expect(k1NotJoining).toHaveLength(29);
  });

  it('字段映射：安基司國際幼兒園（网上派表 Y，不共享空缺 N）', () => {
    const r = findK1NotJoining(k1NotJoining, '安基司國際幼兒園')[0];
    expect(r?.onlineApplication).toBe(true);
    expect(r?.oneVacancyOnly).toBe(false);
    expect(r?.shareVacancyInfo).toBe(false);
    expect(r?.address).toBe('新界大埔紅林路1號滌濤山幼稚園校舍');
  });

  it('字段映射：茵晴幼稚園（网上派表 N，共享空缺 Y）', () => {
    const r = findK1NotJoining(k1NotJoining, '茵晴幼稚園')[0];
    expect(r?.onlineApplication).toBe(false);
    expect(r?.shareVacancyInfo).toBe(true);
  });

  it('未命中返回空数组', () => {
    expect(findK1NotJoining(k1NotJoining, '不存在幼稚園')).toEqual([]);
  });
});

describe('parseNonAidedCcc（附设幼儿中心名单）', () => {
  it('解析 274 条记录（UTF-16 LE 解码 + 引号字段）', () => {
    expect(nonAidedCcc).toHaveLength(274);
  });

  it('字段映射：611小葡萄幼兒中心（荃灣/葵青，半日 3861）', () => {
    const r = findNonAidedCcc(nonAidedCcc, '611小葡萄幼兒中心')[0];
    expect(r?.orgName).toBe('611 靈糧堂有限公司');
    expect(r?.district).toBe('荃灣/葵青');
    expect(r?.halfDayKgFee).toBe(3861);
    expect(r?.phone).toBe('39568611');
  });

  it('按地区过滤：荃灣 → 24 条（斜杠分隔容错）', () => {
    expect(filterNonAidedCccByDistrict(nonAidedCcc, '荃灣')).toHaveLength(24);
  });

  it('按地区过滤：天水圍 → 7 条（地区列无此桶 → 地址包含回退）', () => {
    expect(filterNonAidedCccByDistrict(nonAidedCcc, '天水圍')).toHaveLength(7);
  });

  it('未命中返回空数组', () => {
    expect(findNonAidedCcc(nonAidedCcc, '不存在中心')).toEqual([]);
  });
});
