// 鲁港通 - 输出格式化测试（TDD）：summary 生成 + 来源标注 + 数据日期 + 防重试 tips（需求 8 / 9.3 / 10）
import { describe, it, expect } from 'vitest';
import { fixture, fixtureText } from './fixture';
import { decodeBytes } from '../src/decode';
import { parseSchLoc, searchSchools } from '../src/queries/search';
import { parseKgp, parseVacancy, parsePsp, parseSsp, buildDetail } from '../src/queries/detail';
import { parseNearestResponse } from '../src/queries/nearby';
import { parsePoa, parseSspa, searchPoaByArea, findSspaByName, findSspaByNet } from '../src/queries/net';
import {
  parseThroughTrain,
  findThroughTrain,
  parseDssFee,
  findDssFee,
  parseKgScheme,
  filterKgSchemeByDistrict,
  parseK1NotJoining,
  findK1NotJoining,
  parseNonAidedCcc,
  findNonAidedCcc,
} from '../src/queries/list';
import { parseStudentStats } from '../src/queries/stats';
import {
  parseRegBasic,
  parseRegPremises,
  parseRegAccommodation,
  findRegistration,
} from '../src/queries/registration';
import {
  buildToolResult,
  formatNearby,
  formatSearch,
  formatDetail,
  formatNetPoa,
  formatNetSspaSchool,
  formatNetSspaNet,
  formatList,
  formatStats,
  formatRegistration,
} from '../src/format';

// ============================================================
// 数据准备（fixtures 真实数据，不打网络）
// ============================================================

const schLoc = parseSchLoc(fixtureText('SCH_LOC_EDB.utf8.csv'));
const kgp = parseKgp(fixtureText('KGP_2025_tc.utf8.csv'));
const vacancy = parseVacancy(fixtureText('k1k3-vacancy-202627-tc.csv'));
const psp = parsePsp(fixtureText('PSP_2025_tc.utf8.csv'));
const ssp = parseSsp(fixtureText('SSP_2025_2026_tc.utf8.csv'));
const nearby = parseNearestResponse(JSON.parse(fixtureText('r28-nearest.json')), {
  lat: 22.3,
  lng: 114.17,
});
const poa = parsePoa(fixtureText('poa-schoolnet-tc.csv'));
const sspa = parseSspa(fixtureText('sspa-schsrvnet-tc.csv'));
const throughTrain = parseThroughTrain(fixtureText('through-train-tc.csv'));
const dssFee = parseDssFee(fixtureText('dss-fee-tc.csv'));
const kgScheme = parseKgScheme(fixtureText('KG_SCHEME_202526.utf8.csv'));
const k1NotJoining = parseK1NotJoining(fixtureText('k1-not-joining-2026-tc.csv'));
const nonAidedCcc = parseNonAidedCcc(decodeBytes(fixture('ccckg-non-aided-tc.csv')));
const stats = parseStudentStats(fixtureText('tab0407-tc.csv'));
const regBasic = parseRegBasic(fixtureText('SchoolBasicInfo.sample.xml'));
const regPremises = parseRegPremises(fixtureText('SchoolPremises.sample.xml'));
const regRooms = parseRegAccommodation(fixtureText('SchoolAccommodation.sample.xml'));

/** 从 SCH_LOC 精确取一条记录（fixture 缺失直接抛错） */
const findSch = (nameZh: string, level?: 'kg' | 'primary' | 'secondary' | 'other') => {
  const r = schLoc.find((s) => s.nameZh === nameZh && (!level || s.level === level));
  if (!r) throw new Error(`fixture 记录缺失：${nameZh}`);
  return r;
};

// ============================================================
// buildToolResult（统一组装）
// ============================================================

describe('buildToolResult（统一组装）', () => {
  it('缺省 items 为空数组；sources/tips 去重；dataDate 缺省空串', () => {
    const r = buildToolResult({
      summary: '测试摘要',
      sources: ['来源A', '来源A', '来源B'],
      tips: ['提示1', '提示1'],
    });
    expect(r.summary).toBe('测试摘要');
    expect(r.items).toEqual([]);
    expect(r.sources).toEqual(['来源A', '来源B']);
    expect(r.tips).toEqual(['提示1']);
    expect(r.dataDate).toBe('');
    expect(r.error).toBeUndefined();
  });

  it('error 透传', () => {
    const r = buildToolResult({ summary: '查询失败', error: '数据暂不可用，请稍后重试' });
    expect(r.error).toContain('稍后重试');
  });
});

// ============================================================
// formatNearby（附近学校）
// ============================================================

describe('formatNearby（附近学校）', () => {
  it('有结果：summary 含地点/校名/距离；来源标注 data.gov.hk；实时数据', () => {
    const r = formatNearby(nearby, '弥敦道 600 号附近');
    expect(r.summary).toContain('弥敦道 600 号附近');
    expect(r.summary).toContain('卓尔中英文幼稚园');
    expect(r.summary).toContain('米');
    expect(r.sources.some((s) => s.includes('data.gov.hk'))).toBe(true);
    expect(r.dataDate).toBe('实时数据');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.name).toBe('卓尔中英文幼稚园');
    expect(r.items[0]?.distanceMeters).toBeGreaterThan(0);
    expect(r.items[0]?.extra?.sessions).toEqual(['下午', '全日']);
  });

  it('空结果：summary 明确未找到 + tips 防重试', () => {
    const r = formatNearby([], '火星');
    expect(r.summary).toContain('未找到');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });
});

// ============================================================
// formatSearch（学校搜索）
// ============================================================

describe('formatSearch（学校搜索）', () => {
  it('按区域+级别命中：summary 含条件与数量；来源标注学校位置总表', () => {
    const result = searchSchools(schLoc, { district: '沙田区', level: 'primary' });
    const r = formatSearch(result, { district: '沙田区', level: 'primary' });
    expect(result.total).toBe(44);
    expect(r.summary).toContain('沙田区');
    expect(r.summary).toContain('44');
    expect(r.summary).toContain('小学');
    expect(r.items).toHaveLength(44);
    expect(r.items[0]?.district).toBe('沙田区');
    expect(r.sources.some((s) => s.includes('学校位置总表'))).toBe(true);
    expect(r.dataDate).toBe('不定期更新');
  });

  it('截断：summary 含总数；tips 提示收窄条件', () => {
    const result = searchSchools(schLoc, { name: '中学' });
    const r = formatSearch(result, { name: '中学' });
    expect(result.total).toBe(457);
    expect(r.summary).toContain('457');
    expect(r.tips.some((t) => t.includes('收窄'))).toBe(true);
  });

  it('无命中：summary 给出相近名称候选 + tips 防重试', () => {
    const result = searchSchools(schLoc, { name: '喇沙书完' });
    const r = formatSearch(result, { name: '喇沙书完' });
    expect(r.summary).toContain('喇沙书院');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });

  it('数量构成：沙田区小学 44 附办学类型构成（降序）', () => {
    const result = searchSchools(schLoc, { district: '沙田区', level: 'primary' });
    const r = formatSearch(result, { district: '沙田区', level: 'primary' });
    expect(r.summary).toContain('共查询到 44 所小学（范围：沙田区）');
    expect(r.summary).toContain('按办学类型：资助 37 所、私立 3 所、直资 2 所');
  });

  it('数量构成：沙田区政府小学 38（合并口径名词「政府小学」+ 构成拆分）', () => {
    const result = searchSchools(schLoc, { district: '沙田区', level: 'primary', category: 'government' });
    const r = formatSearch(result, { district: '沙田区', level: 'primary', category: 'government' });
    expect(r.summary).toBe('共查询到 38 所政府小学（范围：沙田区）；按办学类型：资助 37 所、官立 1 所。');
  });

  it('数量构成：全港政府学校 1002（合并口径附构成拆分 + 截断提示）', () => {
    const result = searchSchools(schLoc, { category: 'government' });
    const r = formatSearch(result, { category: 'government' });
    expect(r.summary).toContain('共查询到 1002 所政府学校');
    expect(r.summary).toContain('按办学类型：资助 937 所、官立 65 所');
    expect(r.summary).toContain('当前仅展示前 50 所');
  });

  it('数量构成：香港国际学校 64（级别拆分，不重复附类型构成）', () => {
    const result = searchSchools(schLoc, { category: 'international' });
    const r = formatSearch(result, { category: 'international' });
    expect(r.summary).toBe('共查询到 64 所国际学校；其中小学 42 所、中学 22 所，当前仅展示前 50 所。');
  });

  it('组合词条件：油尖旺区直资中学 4（少结果不附构成，精确摘要）', () => {
    const result = searchSchools(schLoc, { district: '油尖旺区', level: 'secondary', category: 'direct_subsidy' });
    const r = formatSearch(result, { district: '油尖旺区', level: 'secondary', category: 'direct_subsidy' });
    expect(r.summary).toBe('共查询到 4 所直资中学（范围：油尖旺区）。');
  });

  it('数量构成：油尖旺区中学 25 全类型明细（含「按额津贴」尾项）', () => {
    const result = searchSchools(schLoc, { district: '油尖旺区', level: 'secondary' });
    const r = formatSearch(result, { district: '油尖旺区', level: 'secondary' });
    expect(r.summary).toBe(
      '共查询到 25 所中学（范围：油尖旺区）；按办学类型：资助 13 所、私立 5 所、直资 4 所、官立 2 所、按额津贴 1 所。'
    );
  });

  it('数量构成：全港直资中学 62（已指定类别，不重复附构成）', () => {
    const result = searchSchools(schLoc, { level: 'secondary', category: 'direct_subsidy' });
    const r = formatSearch(result, { level: 'secondary', category: 'direct_subsidy' });
    expect(r.summary).toBe('共查询到 62 所直资中学，当前仅展示前 50 所。');
  });

  it('名称查询不附构成（即使数量较多）', () => {
    const result = searchSchools(schLoc, { name: '中学' });
    const r = formatSearch(result, { name: '中学' });
    expect(result.total).toBe(457);
    expect(r.summary).toContain('共查询到 457 所名称含「中学」的学校');
    expect(r.summary).not.toContain('按办学类型');
  });

  it('全港全量：3461 所学校附两级构成（级别拆分 + 类型 top5 + 其他合并）', () => {
    const result = searchSchools(schLoc, {});
    const r = formatSearch(result, {});
    expect(r.summary).toContain('其中幼稚园 2177 所、小学 590 所、中学 547 所、特殊学校 147 所');
    expect(r.summary).toContain('按办学类型：幼稚园 1373 所、资助 937 所');
    expect(r.summary).toContain('其他 149 所');
    expect(r.summary).toContain('当前仅展示前 50 所');
  });
});

// ============================================================
// formatDetail（学校档案）
// ============================================================

describe('formatDetail（学校档案）', () => {
  it('小学：summary 含校名/小一校网/教学语言；双来源标注；学年标注', () => {
    const detail = buildDetail(findSch('聖公會聖馬太小學'), { psp });
    const r = formatDetail(detail);
    expect(r.summary).toContain('圣公会圣马太小学');
    expect(r.summary).toContain('小一校网：11');
    expect(r.summary).toContain('中文');
    expect(r.sources.some((s) => s.includes('小学概览'))).toBe(true);
    expect(r.sources.some((s) => s.includes('学校位置总表'))).toBe(true);
    expect(r.dataDate).toContain('2025/26');
  });

  it('幼稚园：summary 含学位空缺与学费；dataDate 含数据截至日期；每周更新提示', () => {
    const detail = buildDetail(findSch('聖士提反堂小學暨幼稚園(下午)'), { kgp, vacancy });
    const r = formatDetail(detail);
    expect(r.summary).toContain('圣士提反堂小学暨幼稚园');
    expect(r.summary).toContain('学位空缺');
    expect(r.summary).toContain('54780');
    expect(r.dataDate).toContain('08/09/2026');
    expect(r.tips.some((t) => t.includes('每周更新'))).toBe(true);
  });

  it('中学：同时挂载概览（教师人数直引）', () => {
    const detail = buildDetail(findSch('拔萃男書院', 'secondary'), { ssp });
    const r = formatDetail(detail);
    expect(r.summary).toContain('拔萃男书院');
    expect(r.summary).toContain('133');
  });

  it('挂载未命中：missing 标注进入 tips（不编造）', () => {
    const detail = buildDetail(findSch('聖公會聖馬太小學'), {});
    const r = formatDetail(detail);
    expect(r.tips.some((t) => t.includes('官方数据未提供'))).toBe(true);
  });
});

// ============================================================
// 校网（POA / SSPA）
// ============================================================

describe('formatNetPoa / formatNetSspa*（校网）', () => {
  it('POA 按区域：summary 含网编号/覆盖区域/详情页链接', () => {
    const list = searchPoaByArea(poa, '沙田区');
    const r = formatNetPoa(list, '沙田区');
    expect(r.summary).toContain('88');
    expect(r.summary).toContain('89');
    expect(r.summary).toContain('91');
    expect(r.summary).toContain('大围');
    expect(r.summary).toContain('http');
    expect(r.items).toHaveLength(3);
    expect(r.sources.some((s) => s.includes('校网'))).toBe(true);
  });

  it('POA 未命中：防重试 tips', () => {
    const r = formatNetPoa([], '火星');
    expect(r.summary).toContain('未找到');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });

  it('SSPA 按校名：summary 含所属网/服务网/区域', () => {
    const rec = findSspaByName(sspa, '喇沙書院');
    const r = formatNetSspaSchool(rec, '喇沙书院');
    expect(r.summary).toContain('喇沙书院');
    expect(r.summary).toContain('KL3');
    expect(r.summary).toContain('KL1');
    expect(r.summary).toContain('九龙城区');
  });

  it('SSPA 按校名未命中：防重试 tips', () => {
    const r = formatNetSspaSchool(undefined, '不存在的学校');
    expect(r.summary).toContain('未找到');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });

  it('SSPA 按网反查：summary 含网编号与学校数', () => {
    const list = findSspaByNet(sspa, 'HK1');
    const r = formatNetSspaNet(list, 'HK1');
    expect(list).toHaveLength(46);
    expect(r.summary).toContain('HK1');
    expect(r.summary).toContain('46');
    expect(r.items).toHaveLength(46);
    expect(r.dataDate).toBe('每年更新');
  });
});

// ============================================================
// formatList（5 类名单）
// ============================================================

describe('formatList（名单查询）', () => {
  it('一条龙命中：summary 含整组（小学+中学）与学年标注', () => {
    const records = findThroughTrain(throughTrain, '新會商會學校');
    const r = formatList({ type: 'through_train', queryName: '新会商会学校', records });
    expect(r.summary).toContain('新会商会学校');
    expect(r.summary).toContain('新会商会陈白沙纪念中学');
    expect(r.summary).toContain('一条龙');
    expect(r.dataDate).toContain('2026/27');
    expect(r.sources.some((s) => s.includes('一条龙'))).toBe(true);
  });

  it('一条龙未命中：明确「未在名单中」+ 防重试', () => {
    const r = formatList({ type: 'through_train', queryName: '喇沙書院', records: [] });
    expect(r.summary).toContain('喇沙书院');
    expect(r.summary).toContain('未');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });

  it('直资学费：items 含分班学费（直引数字）', () => {
    const records = findDssFee(dssFee, '拔萃男書院');
    const r = formatList({ type: 'dss_fee', queryName: '拔萃男书院', records });
    expect(r.summary).toContain('拔萃男书院');
    const s1s4 = r.items.find((i) => i.extra?.classRange === 'S1-S4');
    expect(s1s4?.extra?.feeMin).toBe(63330);
    expect(s1s4?.extra?.feeMax).toBe(63330);
    expect(r.dataDate).toContain('2025/26');
  });

  it('幼教计划按区域：summary 含数量与区域', () => {
    const records = filterKgSchemeByDistrict(kgScheme, '沙田');
    expect(records).toHaveLength(55);
    const r = formatList({ type: 'kg_scheme', district: '沙田', records });
    expect(r.summary).toContain('55');
    expect(r.summary).toContain('沙田');
    expect(r.items).toHaveLength(55);
  });

  it('K1 非计划命中：extra 含申请安排（Y → 是）', () => {
    const records = findK1NotJoining(k1NotJoining, '安基司國際幼兒園');
    const r = formatList({ type: 'k1_not_joining', queryName: '安基司国际幼儿园', records });
    expect(r.summary).toContain('安基司');
    expect(r.items[0]?.extra?.onlineApplication).toBe('是');
  });

  it('附设幼儿中心命中：extra 含核准月费（直引）', () => {
    const records = findNonAidedCcc(nonAidedCcc, '611小葡萄幼兒中心');
    const r = formatList({ type: 'non_aided_ccc', queryName: '611小葡萄幼儿中心', records });
    expect(r.summary).toContain('611');
    expect(r.items[0]?.extra?.halfDayKgFee).toBe(3861);
  });
});

// ============================================================
// formatStats（统计）
// ============================================================

describe('formatStats（学生人数统计）', () => {
  it('单区明细：summary 含区名与各级人数（千分位直引）', () => {
    const r = formatStats(stats, { zone: '沙田' });
    expect(r.summary).toContain('沙田');
    expect(r.summary).toContain('34,998');
    expect(r.summary).toContain('中一');
    expect(r.items[0]?.extra?.total).toBe(34998);
    expect(r.dataDate).toContain('2025/26');
    expect(r.sources.some((s) => s.includes('学生人数'))).toBe(true);
  });

  it('全港对比：summary 含首末位；18 区降序', () => {
    const r = formatStats(stats, { compare: true });
    expect(r.summary).toContain('沙田');
    expect(r.summary).toContain('离岛');
    expect(r.items).toHaveLength(18);
    expect(r.items[0]?.name).toBe('沙田');
  });

  it('未命中区：防重试与建议', () => {
    const r = formatStats(stats, { zone: '火星' });
    expect(r.summary).toContain('未找到');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });
});

// ============================================================
// formatRegistration（注册资料）
// ============================================================

describe('formatRegistration（注册资料）', () => {
  it('命中：summary 含注册编号/状况/校舍容额', () => {
    const result = findRegistration(regBasic, regPremises, regRooms, '喇沙书院');
    const r = formatRegistration(result, '喇沙书院');
    expect(r.summary).toContain('喇沙书院');
    expect(r.summary).toContain('5/4456');
    expect(r.summary).toContain('注册');
    expect(r.summary).toContain('课室');
    expect(r.sources.some((s) => s.includes('注册资料'))).toBe(true);
  });

  it('非精确命中（官立不在册场景）：summary 含官立提示与候选', () => {
    const result = findRegistration(regBasic, regPremises, regRooms, '皇仁书院');
    const r = formatRegistration(result, '皇仁书院');
    expect(r.summary).toContain('官立');
    expect(r.summary).toContain('港专');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });

  it('完全查无：官立提示 + 防重试', () => {
    const r = formatRegistration(undefined, '不存在的测试学校');
    expect(r.summary).toContain('官立');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });
});
