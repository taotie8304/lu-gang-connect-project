// 鲁港通 - 学校档案聚合测试（TDD）：KGP / K1-K3 空缺 / PSP / SSP 解析 + 按级别挂载
import { describe, it, expect } from 'vitest';
import { fixtureText } from './fixture';
import { parseKgp, parseVacancy, parsePsp, parseSsp, buildDetail } from '../src/queries/detail';
import { parseSchLoc } from '../src/queries/search';
import type { SchoolRecord } from '../src/queries/search';

const schLoc = parseSchLoc(fixtureText('SCH_LOC_EDB.utf8.csv'));
const kgp = parseKgp(fixtureText('KGP_2025_tc.utf8.csv'));
const vacancy = parseVacancy(fixtureText('k1k3-vacancy-202627-tc.csv'));
const psp = parsePsp(fixtureText('PSP_2025_tc.utf8.csv'));
const ssp = parseSsp(fixtureText('SSP_2025_2026_tc.utf8.csv'));

const findRecord = (kw: string, level?: SchoolRecord['level']): SchoolRecord => {
  const r = schLoc.find((s) => s.nameZh.includes(kw) && (!level || s.level === level));
  if (!r) throw new Error(`fixture record not found: ${kw}${level ? ` (${level})` : ''}`);
  return r;
};

describe('parseKgp（幼稚园概览，^ 分隔 104 列）', () => {
  it('解析 962 条记录', () => {
    expect(kgp).toHaveLength(962);
  });

  it('字段映射：聖士提反堂小學暨幼稚園', () => {
    const k = kgp[0];
    expect(k.name).toBe('聖士提反堂小學暨幼稚園');
    expect(k.schoolNo).toBe('131440');
    expect(k.district).toBe('中西區');
    expect(k.joinsScheme).toBe('有參加');
    expect(k.curriculum).toBe('本地');
    expect(k.capacity).toBe('218');
    expect(k.teacherRatioAm).toBe('01:08.9');
    expect(k.feeHalfDay).toBe('54780');
    expect(k.feeWholeDay).toBe('');
    expect(k.website).toBe('http://www.ssck.edu.hk');
    expect(k.totalTeachers).toBe('15');
  });

  it('「-」归一为空串（未提供不编造）', () => {
    const stPaul = kgp.find((k) => k.name === '聖保羅堂幼稚園');
    expect(stPaul?.feeHalfDay).toBe('');
    expect(stPaul?.feeWholeDay).toBe('');
  });
});

describe('parseVacancy（K1-K3 学位空缺）', () => {
  it('解析 708 条记录（含数据截至日期）', () => {
    expect(vacancy).toHaveLength(708);
    expect(vacancy[0].asAtDate).toBe('08/09/2026');
  });

  it('字段映射：迦南幼稚園（中環堅道）', () => {
    const k = vacancy.find((v) => v.name === '迦南幼稚園（中環堅道）');
    expect(k?.scrn).toBe('619841-0001');
    expect(k?.k1).toBe('Y');
    expect(k?.k2).toBe('Y');
    expect(k?.k3).toBe('Y');
  });

  it('Y/N/P 状态值原文保真', () => {
    const k = vacancy.find((v) => v.name === '明愛堅尼地城幼兒學校');
    expect(k?.k1).toBe('N');
    const stPaul = vacancy.find((v) => v.name === '聖保羅堂幼稚園');
    expect(stPaul?.k1).toBe('P');
  });
});

describe('parsePsp（小学概览）', () => {
  it('解析 507 条记录（522 朴素行 − 表头 − 14 行跨行字段合并）', () => {
    expect(psp).toHaveLength(507);
  });

  it('字段映射：聖公會聖馬太小學', () => {
    const p = psp[0];
    expect(p.name).toBe('聖公會聖馬太小學');
    expect(p.schoolNet).toBe('11');
    expect(p.teachingLanguage).toBe('中文');
    expect(p.gender).toBe('男女');
    expect(p.sponsor).toBe('聖公宗（香港）小學監理委員會有限公司');
    expect(p.foundedYear).toBe('1876');
    expect(p.category).toBe('資助');
    expect(p.motto).toBe('非以役人，乃役於人');
    expect(p.classStructure.p1).toBe('2');
    expect(p.fee).toBe('');
  });

  it('一条龙关系：新會商會學校 → 新會商會陳白沙紀念中學', () => {
    const p = psp.find((x) => x.name === '新會商會學校');
    expect(p?.throughTrain).toBe('新會商會陳白沙紀念中學');
  });

  it('直属关系：聖保羅書院小學 → 聖保羅書院', () => {
    const p = psp.find((x) => x.name === '聖保羅書院小學');
    expect(p?.feeder).toBe('聖保羅書院');
  });

  it('联系中学清洗 <br>', () => {
    const p = psp.find((x) => x.name === '李陞小學');
    expect(p?.nominated).toContain('英皇書院');
    expect(p?.nominated).not.toContain('<br>');
  });
});

describe('parseSsp（中学概览）', () => {
  it('解析 441 条记录（446 朴素行 − 表头 − 4 行跨行字段合并）', () => {
    expect(ssp).toHaveLength(441);
  });

  it('字段映射：拔萃男書院', () => {
    const s = ssp[0];
    expect(s.name).toBe('拔萃男書院');
    expect(s.teacherCount).toBe('133');
    expect(s.classStructure.s1).toBe('6');
    expect(s.classStructure.s6).toBe('6');
    expect(s.foundedYear).toBe('1869');
    expect(s.category).toBe('直資');
    expect(s.gender).toBe('男');
    expect(s.classroomCount).toBe('44');
    expect(s.fees.s1).toBe('$63330');
    expect(s.motto).toBe('');
  });

  it('办学宗旨清洗 <br>', () => {
    const s = ssp[0];
    expect(s.mission).toContain('全人教育');
    expect(s.mission).not.toContain('<br>');
  });
});

describe('buildDetail（按级别挂载）', () => {
  it('幼稚园：KGP + 学位空缺全挂载', () => {
    const d = buildDetail(findRecord('聖士提反堂小學暨幼稚園'), { kgp, vacancy });
    expect(d.kg?.joinsScheme).toBe('有參加');
    expect(d.kg?.curriculum).toBe('本地');
    expect(d.kg?.feeHalfDay).toBe('54780');
    expect(d.vacancy?.k1).toBe('Y');
    expect(d.vacancy?.asAtDate).toBe('08/09/2026');
    expect(d.missing).toHaveLength(0);
  });

  it('小学：PSP 挂载（校网/教学语言/班级结构）', () => {
    const d = buildDetail(findRecord('聖公會聖馬太小學'), { psp });
    expect(d.primary?.schoolNet).toBe('11');
    expect(d.primary?.teachingLanguage).toBe('中文');
    expect(d.primary?.classStructure.p1).toBe('2');
    expect(d.missing).toHaveLength(0);
  });

  it('中学：SSP 挂载（班级结构/教师人数/办学宗旨）', () => {
    const d = buildDetail(findRecord('拔萃男書院', 'secondary'), { ssp });
    expect(d.secondary?.teacherCount).toBe('133');
    expect(d.secondary?.classStructure.s1).toBe('6');
    expect(d.secondary?.mission).toContain('全人教育');
    expect(d.missing).toHaveLength(0);
  });

  it('挂载未命中 → missing 标注官方未提供', () => {
    const d = buildDetail(findRecord('聖公會聖馬太小學'), {});
    expect(d.primary).toBeUndefined();
    expect(d.missing.some((m) => m.includes('小学概览') && m.includes('未提供'))).toBe(true);
  });

  it('幼稚园缺学位空缺数据 → missing 标注', () => {
    const d = buildDetail(findRecord('聖士提反堂小學暨幼稚園'), { kgp });
    expect(d.vacancy).toBeUndefined();
    expect(d.missing.some((m) => m.includes('学位空缺') && m.includes('未提供'))).toBe(true);
  });
});
