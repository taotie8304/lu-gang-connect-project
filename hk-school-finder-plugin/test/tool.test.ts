// 鲁港通 - 工具编排器端到端测试（TDD）：七意图（fixtures 注入，不打网络）+ 边界（无意图/未知地点/下载失败/过期降级）
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture, fixtureText } from './fixture';
import { SOURCES, TTL_MS } from '../src/config';
import type { ToolResult } from '../src/format';
import { runTool } from '../src/tool';

// ============================================================
// 测试桩：URL → fixtures 原始字节（与 config 注册表一一对应）
// ============================================================

const URL_TO_ID = new Map(SOURCES.map((s) => [s.url, s.id]));

/** 数据源 id → fixtures 文件名（覆盖全部 16 个可缓存源） */
const FIXTURE_FILES: Record<string, string> = {
  sch_loc: 'SCH_LOC_EDB.utf8.csv',
  kgp: 'KGP_2025_tc.utf8.csv',
  psp: 'PSP_2025_tc.utf8.csv',
  ssp: 'SSP_2025_2026_tc.utf8.csv',
  through_train: 'through-train-tc.csv',
  poa: 'poa-schoolnet-tc.csv',
  sspa: 'sspa-schsrvnet-tc.csv',
  k1_not_joining: 'k1-not-joining-2026-tc.csv',
  k1k3_vacancy: 'k1k3-vacancy-202627-tc.csv',
  kg_scheme: 'KG_SCHEME_202526.utf8.csv',
  dss_fee: 'dss-fee-tc.csv',
  non_aided_ccc: 'ccckg-non-aided-tc.csv',
  reg_basic: 'SchoolBasicInfo.sample.xml',
  reg_premises: 'SchoolPremises.sample.xml',
  reg_accommodation: 'SchoolAccommodation.sample.xml',
  tab0407: 'statistics-by-district-tc.xlsx',
};

const fetchBytes = async (url: string): Promise<Uint8Array> => {
  const id = URL_TO_ID.get(url);
  const file = id ? FIXTURE_FILES[id] : undefined;
  if (!file) throw new Error(`未映射的测试 URL：${url}`);
  return fixture(file);
};

const failingFetch = async (): Promise<Uint8Array> => {
  throw new Error('网络断开');
};

const nearestJson = (): unknown => JSON.parse(fixtureText('r28-nearest.json')) as unknown;

/** 输出形状断言（每个用例都过一遍） */
const expectShape = (r: ToolResult): void => {
  expect(typeof r.summary).toBe('string');
  expect(Array.isArray(r.items)).toBe(true);
  expect(typeof r.dataDate).toBe('string');
  expect(Array.isArray(r.sources)).toBe(true);
  expect(Array.isArray(r.tips)).toBe(true);
};

let cacheDir: string;
beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'lugang-sf-tool-'));
});
afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});

// ============================================================
// 意图 ①：附近学校（nearby）
// ============================================================

describe('nearby（附近学校）', () => {
  it('地标 → 坐标锚点 → 实时接口（fetchJson 桩）→ 格式化', async () => {
    let lastUrl = '';
    const fetchJson = async (url: string): Promise<unknown> => {
      lastUrl = url;
      return nearestJson();
    };
    const r = await runTool({ location: '尖沙咀' }, { cacheDir, fetchBytes, fetchJson });

    expectShape(r);
    expect(lastUrl).toContain('nearest-schools');
    expect(lastUrl).toContain('lat=22.2988');
    expect(r.summary).toContain('尖沙咀');
    expect(r.summary).toContain('卓尔中英文幼稚园');
    expect(r.dataDate).toBe('实时数据');
    expect(r.sources.some((s) => s.includes('data.gov.hk'))).toBe(true);
    expect(r.items[0]?.distanceMeters).toBeGreaterThan(0);
  });

  it('未知地点：给更换地点的可操作提示 + 防重试', async () => {
    const fetchJson = async (): Promise<unknown> => nearestJson();
    const r = await runTool({ location: '火星' }, { cacheDir, fetchBytes, fetchJson });

    expectShape(r);
    expect(r.error).toBeUndefined();
    expect(r.summary).toContain('无法识别');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });
});

// ============================================================
// 意图 ②：学校搜索（search）
// ============================================================

describe('search（学校搜索）', () => {
  it('区域+级别：44 所沙田区小学（来源/日期标注）', async () => {
    const r = await runTool({ district: '沙田区', level: 'primary' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('沙田区');
    expect(r.summary).toContain('44');
    expect(r.items).toHaveLength(44);
    expect(r.items[0]?.district).toBe('沙田区');
    expect(r.sources.some((s) => s.includes('学校位置总表'))).toBe(true);
    expect(r.dataDate).toBe('不定期更新');
  });

  it('显式 intent=search 优先于参数推断：按校名关键词搜索', async () => {
    const r = await runTool({ intent: 'search', schoolName: '喇沙' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('喇沙');
    expect(r.items.length).toBeGreaterThan(0);
  });

  it('原话兜底：仅 query「沙田区有哪些小学」→ 自动识别区域+级别（44 所）', async () => {
    const r = await runTool({ query: '沙田区有哪些小学' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('44');
    expect(r.items).toHaveLength(44);
  });

  it('无命中：给相近候选建议 + 防重试', async () => {
    const r = await runTool({ district: '不存在区', level: 'primary' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('未找到');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });
});

// ============================================================
// 鲁港通 - 类别与数量问法端到端（一问即答 + 数量统计）
// ============================================================

describe('类别与数量问法（一问即答 + 数量统计）', () => {
  it('① 沙田区有哪些小学：一步到位 44 所 + 办学类型构成', async () => {
    const r = await runTool({ query: '沙田区有哪些小学' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('共查询到 44 所小学（范围：沙田区）');
    expect(r.summary).toContain('按办学类型：资助 37 所');
    expect(r.items).toHaveLength(44);
  });

  it('② 香港有多少所国际学校：64 所（小学 42、中学 22）', async () => {
    const r = await runTool({ query: '香港有多少所国际学校' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('64 所国际学校');
    expect(r.summary).toContain('其中小学 42 所、中学 22 所');
    expect(r.items).toHaveLength(50);
  });

  it('③ 油尖旺区有哪些直资中学：4 所', async () => {
    const r = await runTool({ query: '油尖旺区有哪些直资中学' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('共查询到 4 所直资中学（范围：油尖旺区）');
    expect(r.items).toHaveLength(4);
  });

  it('④ 全港有多少所直资中学：62 所', async () => {
    const r = await runTool({ query: '全港有多少所直资中学' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('62 所直资中学');
    expect(r.items).toHaveLength(50);
  });

  it('⑤ 人数回归：沙田区有多少中学生 → 34,998 人（不被学校数量分流）', async () => {
    const r = await runTool({ query: '沙田区有多少中学生' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('34,998');
    expect(r.items[0]?.extra?.total).toBe(34998);
  });

  it('组合词兜底（无列表词）：「油尖旺区直资中学」→ 直资中学 4 所', async () => {
    const r = await runTool({ query: '油尖旺区直资中学' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('4 所直资中学');
    expect(r.items).toHaveLength(4);
  });

  it('intent=list 无名单类型：「沙田区有哪些小学」降级为学校列表（44 所）', async () => {
    const r = await runTool({ intent: 'list', query: '沙田区有哪些小学' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('44');
    expect(r.items).toHaveLength(44);
  });

  it('intent=stats 数量分流：「沙田区有多少所小学」转学校列表（44 所）', async () => {
    const r = await runTool({ intent: 'stats', query: '沙田区有多少所小学' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('44 所小学');
    expect(r.items).toHaveLength(44);
  });

  it('schoolCategory 直传枚举：油尖旺区直资中学 4 所', async () => {
    const r = await runTool(
      { district: '油尖旺区', level: 'secondary', schoolCategory: 'direct_subsidy' },
      { cacheDir, fetchBytes }
    );

    expectShape(r);
    expect(r.summary).toContain('4 所直资中学');
    expect(r.items).toHaveLength(4);
  });

  it('误传 dss_fee 纠偏：intent=list + listType=dss_fee +「油尖旺区有哪些直资中学」→ 4 所列表', async () => {
    const r = await runTool(
      {
        intent: 'list',
        query: '油尖旺区有哪些直资中学',
        district: '油尖旺区',
        level: 'secondary',
        listType: 'dss_fee',
      },
      { cacheDir, fetchBytes }
    );

    expectShape(r);
    expect(r.summary).toContain('共查询到 4 所直资中学（范围：油尖旺区）');
    expect(r.items).toHaveLength(4);
    // 官方总表 4 条记录：九龍三育中學（两校舍）、拔萃女書院、李國寶中學
    expect(r.items.some((i) => (i.name ?? '').includes('三育'))).toBe(true);
    expect(r.items.some((i) => (i.name ?? '').includes('拔萃女'))).toBe(true);
  });

  it('合并口径：「沙田区有哪些小学属于政府学校」→ 政府小学 38 所（资助 37 + 官立 1）', async () => {
    const r = await runTool(
      { intent: 'search', query: '沙田区有哪些小学属于政府学校' },
      { cacheDir, fetchBytes }
    );

    expectShape(r);
    expect(r.summary).toContain('共查询到 38 所政府小学（范围：沙田区）');
    expect(r.summary).toContain('资助 37 所、官立 1 所');
    expect(r.items).toHaveLength(38);
  });

  it('参数纪律：全港国际学校（不传 level）→ 64 所，而非 0 条', async () => {
    const r = await runTool(
      { intent: 'search', query: '全港有多少所国际学校', schoolCategory: 'international' },
      { cacheDir, fetchBytes }
    );

    expectShape(r);
    expect(r.summary).toContain('共查询到 64 所国际学校');
  });

  it('学费语义保护：dss_fee +「有哪些直资学校的学费」→ 不纠偏，保留名单逻辑（要求校名）', async () => {
    const r = await runTool(
      {
        intent: 'list',
        query: '油尖旺区有哪些直资学校的学费',
        district: '油尖旺区',
        listType: 'dss_fee',
      },
      { cacheDir, fetchBytes }
    );

    expectShape(r);
    expect(r.summary).toContain('查询信息不足');
    expect(r.summary).toContain('需要校名');
  });

  it('学费名单校名路径不受纠偏影响：dss_fee + 拔萃男书院 → 分班学费', async () => {
    const r = await runTool(
      { intent: 'list', query: '拔萃男书院学费', listType: 'dss_fee', schoolName: '拔萃男书院' },
      { cacheDir, fetchBytes }
    );

    expectShape(r);
    expect(r.summary).toContain('拔萃男书院');
    const s1s4 = r.items.find((i) => i.extra?.classRange === 'S1-S4');
    expect(s1s4?.extra?.feeMin).toBe(63330);
  });
});

// ============================================================
// 意图 ③：学校档案（detail）
// ============================================================

describe('detail（学校档案）', () => {
  it('小学：精确命中 → 挂载小学概览（小一校网直引）', async () => {
    const r = await runTool({ schoolName: '圣公会圣马太小学' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('圣公会圣马太小学');
    expect(r.summary).toContain('小一校网：11');
    expect(r.sources.some((s) => s.includes('学校位置总表'))).toBe(true);
    expect(r.sources.some((s) => s.includes('小学概览'))).toBe(true);
    expect(r.dataDate).toContain('2025/26');
  });

  it('校名拼写偏差：未精确命中 → 搜索候选（含「喇沙书院」建议 + 防重试）', async () => {
    const r = await runTool({ schoolName: '喇沙书完' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('喇沙书院');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });

  it('原话兜底：仅 query 校名「喇沙书院」→ 学校档案', async () => {
    const r = await runTool({ query: '喇沙书院' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('喇沙书院');
    expect(r.items[0]?.name).toContain('喇沙书院');
  });
});

// ============================================================
// 意图 ④：校网（net）
// ============================================================

describe('net（校网）', () => {
  it('poa 按区域：沙田区对应 88/89/91 网', async () => {
    const r = await runTool({ netType: 'poa', district: '沙田区' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('88');
    expect(r.summary).toContain('89');
    expect(r.summary).toContain('91');
    expect(r.summary).toContain('大围');
    expect(r.items).toHaveLength(3);
  });

  it('poa 按网编号：95 网命中', async () => {
    const r = await runTool({ netType: 'poa', query: '95' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('95 网');
  });

  it('sspa 按校名：喇沙书院所属 KL3 / 服务 KL1', async () => {
    const r = await runTool({ netType: 'sspa', schoolName: '喇沙书院' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('KL3');
    expect(r.summary).toContain('KL1');
    expect(r.summary).toContain('九龙城区');
  });

  it('sspa 按网反查：HK1 网 46 所中学', async () => {
    const r = await runTool({ netType: 'sspa', query: '服务 HK1 校网的中学有哪些' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('HK1');
    expect(r.summary).toContain('46');
    expect(r.items).toHaveLength(46);
  });
});

// ============================================================
// 意图 ⑤：名单（list，五类）
// ============================================================

describe('list（名单）', () => {
  it('一条龙命中：返回整组（小学 + 中学）', async () => {
    const r = await runTool(
      { listType: 'through_train', schoolName: '新会商会学校' },
      { cacheDir, fetchBytes }
    );

    expectShape(r);
    expect(r.summary).toContain('新会商会学校');
    expect(r.summary).toContain('新会商会陈白沙纪念中学');
    expect(r.dataDate).toContain('2026/27');
  });

  it('一条龙未命中：明确「不在名单中」+ 防重试', async () => {
    const r = await runTool({ listType: 'through_train', schoolName: '喇沙书院' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('未');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });

  it('直资学费：拔萃男书院分班学费直引（S1-S4 = 63330）', async () => {
    const r = await runTool({ listType: 'dss_fee', schoolName: '拔萃男书院' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('拔萃男书院');
    const s1s4 = r.items.find((i) => i.extra?.classRange === 'S1-S4');
    expect(s1s4?.extra?.feeMin).toBe(63330);
  });

  it('幼教计划按区域：沙田 55 所', async () => {
    const r = await runTool({ listType: 'kg_scheme', district: '沙田' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('55');
    expect(r.items).toHaveLength(55);
  });

  it('K1 非计划命中：申请安排 Y → 是', async () => {
    const r = await runTool(
      { listType: 'k1_not_joining', schoolName: '安基司国际幼儿园' },
      { cacheDir, fetchBytes }
    );

    expectShape(r);
    expect(r.summary).toContain('安基司');
    expect(r.items[0]?.extra?.onlineApplication).toBe('是');
  });

  it('附设幼儿中心命中：核准月费直引', async () => {
    const r = await runTool(
      { listType: 'non_aided_ccc', schoolName: '611小葡萄幼儿中心' },
      { cacheDir, fetchBytes }
    );

    expectShape(r);
    expect(r.summary).toContain('611');
    expect(r.items[0]?.extra?.halfDayKgFee).toBe(3861);
  });
});

// ============================================================
// 意图 ⑥：统计（stats，官方 XLSX「表3(b)」）
// ============================================================

describe('stats（学生人数统计）', () => {
  it('单区明细：沙田 34,998（官方 XLSX 直引）', async () => {
    const r = await runTool({ intent: 'stats', district: '沙田' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('沙田');
    expect(r.summary).toContain('34,998');
    expect(r.items[0]?.extra?.total).toBe(34998);
    expect(r.dataDate).toContain('2025/26');
  });

  it('无区域：全港 18 区对比（首位沙田）', async () => {
    const r = await runTool({ intent: 'stats' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('沙田');
    expect(r.items).toHaveLength(18);
    expect(r.items[0]?.name).toBe('沙田');
  });
});

// ============================================================
// 意图 ⑦：注册资料（registration）
// ============================================================

describe('registration（注册资料）', () => {
  it('喇沙书院：注册编号/校舍/容额聚合', async () => {
    const r = await runTool({ intent: 'registration', schoolName: '喇沙书院' }, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.summary).toContain('喇沙书院');
    expect(r.summary).toContain('5/4456');
    expect(r.sources.some((s) => s.includes('注册资料'))).toBe(true);
  });
});

// ============================================================
// 边界：无意图 / 参数不足 / 下载失败 / 过期降级
// ============================================================

describe('边界与降级', () => {
  it('全空输入：无法推断意图 → 引导补充信息（非最终结果）', async () => {
    const r = await runTool({}, { cacheDir, fetchBytes });

    expectShape(r);
    expect(r.error).toBeUndefined();
    expect(r.summary).toContain('补充');
    expect(r.tips.length).toBeGreaterThan(0);
  });

  it('下载失败：error 给可操作中文 + 防重试', async () => {
    const r = await runTool({ district: '沙田区', level: 'primary' }, { cacheDir, fetchBytes: failingFetch });

    expectShape(r);
    expect(r.error).toBeDefined();
    expect(r.error).toContain('暂时无法下载');
    expect(r.tips.some((t) => t.includes('不要重复调用'))).toBe(true);
  });

  it('过期缓存 + 下载失败 → 降级旧缓存并在 tips 提示「可能不是最新」', async () => {
    let nowMs = 1_700_000_000_000;
    const opts = { district: '沙田区', level: 'primary' } as const;

    const first = await runTool(opts, { cacheDir, fetchBytes, now: () => nowMs });
    expect(first.summary).toContain('44');

    nowMs += (TTL_MS.yearly ?? 0) + 1;
    const second = await runTool(opts, { cacheDir, fetchBytes: failingFetch, now: () => nowMs });

    expect(second.summary).toContain('44');
    expect(second.error).toBeUndefined();
    expect(second.tips.some((t) => t.includes('不是最新'))).toBe(true);
  });
});
