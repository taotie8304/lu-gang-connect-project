// 鲁港通 - 注册资料查询测试（TDD）：三文件 fixture 解析 + 按校名聚合（需求 6.1–6.3）
import { describe, it, expect } from 'vitest';
import { fixtureText } from './fixture';
import {
  parseRegBasic,
  parseRegPremises,
  parseRegAccommodation,
  findRegistration,
  REG_NOT_FOUND_TIP,
} from '../src/queries/registration';

const basic = parseRegBasic(fixtureText('SchoolBasicInfo.sample.xml'));
const premises = parseRegPremises(fixtureText('SchoolPremises.sample.xml'));
const rooms = parseRegAccommodation(fixtureText('SchoolAccommodation.sample.xml'));

describe('parseRegBasic（注册基本信息）', () => {
  it('解析 9 条记录（同校多级别/多时段各占一条）', () => {
    expect(basic).toHaveLength(9);
  });

  it('沙田公立學校：同编号小學+中學两条', () => {
    const rows = basic.filter((r) => r.schoolNumber === '112526');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.level)).toEqual(['小學', '中學']);
  });

  it('喇沙書院：注册编号/状况/类别/地区/日期全字段', () => {
    const r = basic.find((x) => x.schoolNumber === '512583');
    expect(r?.name).toBe('喇沙書院');
    expect(r?.registrationNumber).toBe('5/4456');
    expect(r?.status).toBe('註冊');
    expect(r?.financeType).toBe('資助');
    expect(r?.district).toBe('九龍城區');
    expect(r?.phone).toBe('23387171');
    expect(r?.registrationDate).toBe('1958-01-03');
    expect(r?.provisionalDate).toBeUndefined();
  });

  it('空注册状况（港專成人教育中心）→ 空字符串不报错', () => {
    const r = basic.find((x) => x.schoolNumber === '557501');
    expect(r?.status).toBe('');
    expect(r?.name).toBe('港專成人教育中心（皇仁書院）');
  });

  it('全角校名归一化：６１１教育中心 nameSimp 含 611', () => {
    const r = basic.find((x) => x.schoolNumber === '584487');
    expect(r?.nameSimp).toContain('611');
    expect(r?.name).toBe('６１１教育中心');
  });
});

describe('parseRegPremises / parseRegAccommodation', () => {
  it('校舍 8 条 / 房间 10 条', () => {
    expect(premises).toHaveLength(8);
    expect(rooms).toHaveLength(10);
  });

  it('喇沙書院：1 校舍 + 3 房间（208/209/210 各 43 人）', () => {
    const p = premises.filter((r) => r.schoolNumber === '512583');
    expect(p).toHaveLength(1);
    expect(p[0].premisesCode).toBe('0001');
    expect(p[0].desc).toContain('喇沙利道');
    const rr = rooms.filter((r) => r.schoolNumber === '512583');
    expect(rr.map((r) => r.roomNo)).toEqual(['208', '209', '210']);
    expect(rr.map((r) => r.permitted)).toEqual([43, 43, 43]);
  });

  it('６１１教育中心：字母房号 A/B、容额 25/42、空备注不误读', () => {
    const rr = rooms.filter((r) => r.schoolNumber === '584487');
    expect(rr.map((r) => r.roomNo)).toEqual(['A', 'B']);
    expect(rr.map((r) => r.permitted)).toEqual([25, 42]);
    expect(rr[0].remarks).toBeUndefined();
  });

  it('沙田公立學校：114 室容额 26', () => {
    const rr = rooms.filter((r) => r.schoolNumber === '112526');
    expect(rr).toHaveLength(1);
    expect(rr[0].roomNo).toBe('114');
    expect(rr[0].permitted).toBe(26);
  });
});

describe('findRegistration（按校名查询聚合）', () => {
  it('简体输入命中学：喇沙书院 → 完整聚合', () => {
    const res = findRegistration(basic, premises, rooms, '喇沙书院');
    expect(res?.exact).toBe(true);
    expect(res?.matches).toHaveLength(1);
    expect(res?.matches[0].registrationNumber).toBe('5/4456');
    expect(res?.premises).toHaveLength(1);
    expect(res?.rooms).toHaveLength(3);
  });

  it('精确优先：聖保羅男女中學不误伤附属小学', () => {
    const res = findRegistration(basic, premises, rooms, '圣保罗男女中学');
    expect(res?.exact).toBe(true);
    expect(res?.matches.map((r) => r.schoolNumber)).toEqual(['510980']);
    expect(res?.premises.map((p) => p.premisesCode)).toEqual(['0001', '0003']);
    expect(res?.rooms.map((r) => r.roomNo)).toEqual(['101', '107']);
  });

  it('附小全名可单独查询', () => {
    const res = findRegistration(basic, premises, rooms, '聖保羅男女中學附屬小學');
    expect(res?.exact).toBe(true);
    expect(res?.matches.map((r) => r.schoolNumber)).toEqual(['514187']);
    expect(res?.rooms.map((r) => r.roomNo)).toEqual(['201', '202']);
  });

  it('全角数据半角输入：611教育中心 命中两条记录', () => {
    const res = findRegistration(basic, premises, rooms, '611教育中心');
    expect(res?.exact).toBe(true);
    expect(res?.matches).toHaveLength(2);
    expect(res?.premises).toHaveLength(1);
    expect(res?.rooms.map((r) => r.roomNo)).toEqual(['A', 'B']);
  });

  it('沙田公立學校：两条记录 + 114 室', () => {
    const res = findRegistration(basic, premises, rooms, '沙田公立學校');
    expect(res?.exact).toBe(true);
    expect(res?.matches).toHaveLength(2);
    expect(res?.rooms[0]?.permitted).toBe(26);
  });

  it('官立学校不在册：皇仁書院 → 非精确候选（相关记录）+ 提示常量', () => {
    const res = findRegistration(basic, premises, rooms, '皇仁書院');
    expect(res?.exact).toBe(false);
    expect(res?.matches.map((r) => r.schoolNumber)).toEqual(['557501']);
    expect(REG_NOT_FOUND_TIP).toContain('官立');
  });

  it('完全查无 → undefined', () => {
    expect(findRegistration(basic, premises, rooms, '不存在的测试学校')).toBeUndefined();
    expect(findRegistration(basic, premises, rooms, '')).toBeUndefined();
  });
});
