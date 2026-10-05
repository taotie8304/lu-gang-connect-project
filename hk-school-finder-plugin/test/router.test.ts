// 鲁港通 - 意图路由测试（TDD）：参数组合 → intent（design.md 推断规则）+ 原话兜底解析
import { describe, it, expect } from 'vitest';
import { enrichInput, inferIntent, isSchoolCountQuery, isStudentCountQuery, parseQueryText } from '../src/router';

describe('inferIntent（意图推断）', () => {
  it('显式 intent 优先（即使带其他参数）', () => {
    expect(inferIntent({ intent: 'stats', location: '沙田', schoolName: '喇沙书院' })).toBe('stats');
    expect(inferIntent({ intent: 'registration', schoolName: '喇沙书院' })).toBe('registration');
  });

  it('有 location → nearby', () => {
    expect(inferIntent({ location: '九龙塘' })).toBe('nearby');
    expect(inferIntent({ location: '22.3,114.17' })).toBe('nearby');
  });

  it('有 listType → list', () => {
    expect(inferIntent({ listType: 'dss_fee' })).toBe('list');
  });

  it('有 netType → net', () => {
    expect(inferIntent({ netType: 'sspa' })).toBe('net');
  });

  it('有 schoolName（无位置/名单/校网）→ detail', () => {
    expect(inferIntent({ schoolName: '喇沙书院' })).toBe('detail');
    expect(inferIntent({ schoolName: '喇沙书完', district: '九龙城区' })).toBe('detail');
  });

  it('有 district+level 无 schoolName → search', () => {
    expect(inferIntent({ district: '沙田区', level: 'primary' })).toBe('search');
  });

  it('仅有 district 或 level → search', () => {
    expect(inferIntent({ district: '沙田区' })).toBe('search');
    expect(inferIntent({ level: 'kg' })).toBe('search');
  });

  it('规则优先级：location > schoolName；netType > schoolName', () => {
    expect(inferIntent({ location: '沙田', schoolName: '喇沙书院' })).toBe('nearby');
    expect(inferIntent({ schoolName: '喇沙书院', netType: 'sspa' })).toBe('net');
  });

  it('listType 优先于 netType', () => {
    expect(inferIntent({ listType: 'kg_scheme', netType: 'poa' })).toBe('list');
  });

  it('全空 → undefined（由入口层给出补充信息提示）', () => {
    expect(inferIntent({})).toBeUndefined();
  });

  it('仅 query（无结构化信号）→ 原话兜底 detail（校名/档案；未精确命中自动降级候选）', () => {
    expect(inferIntent({ query: '喇沙书院' })).toBe('detail');
    expect(inferIntent({ query: '香港学校' })).toBe('detail');
  });

  it('query + level（无区域）→ detail（「喇沙小学」按校名试精确匹配）', () => {
    expect(inferIntent({ query: '喇沙小学', level: 'primary' })).toBe('detail');
  });

  it('学校数量问法（多少所 XX 学校）→ search（不误答学生人数）', () => {
    expect(inferIntent({ query: '沙田区有多少所小学' })).toBe('search');
    expect(inferIntent({ query: '香港有多少所国际学校' })).toBe('search');
    expect(inferIntent({ query: '全港有多少所直资中学' })).toBe('search');
  });

  it('学生人数问法（含区域）→ stats（人数口径回归保护）', () => {
    expect(inferIntent({ query: '沙田区有多少中学生' })).toBe('stats');
    expect(inferIntent({ query: '元朗区有多少学生' })).toBe('stats');
  });

  it('区域+类别列举问法 → search；组合词（无列表词）→ detail（由编排层兜底转列表）', () => {
    expect(inferIntent({ query: '油尖旺区有哪些直资中学' })).toBe('search');
    expect(inferIntent({ query: '油尖旺区直资中学' })).toBe('detail');
  });
});

describe('parseQueryText（原话解析）', () => {
  it('列表问法：识别区域 + 级别', () => {
    const p = parseQueryText('沙田区有哪些小学');
    expect(p.district).toBe('沙田区');
    expect(p.level).toBe('primary');
    expect(p.isListLike).toBe(true);
  });

  it('繁体与省「区」写法：元朗 幼稚園', () => {
    const p = parseQueryText('元朗 幼稚園');
    expect(p.district).toBe('元朗区');
    expect(p.level).toBe('kg');
    expect(p.rest).toBe('');
  });

  it('纯校名：无区域无级别', () => {
    const p = parseQueryText('喇沙書院');
    expect(p.district).toBeUndefined();
    expect(p.level).toBeUndefined();
    expect(p.isListLike).toBe(false);
  });

  it('区域+级别+校名特征：沙田官立小学 → 剩余文本非空、非列表问法', () => {
    const p = parseQueryText('沙田官立小学');
    expect(p.district).toBe('沙田区');
    expect(p.level).toBe('primary');
    expect(p.isListLike).toBe(false);
    expect(p.rest).toBe('官立');
  });

  it('类别问法：油尖旺区有哪些直资中学（区域+级别+类别；剩余为列表词）', () => {
    const p = parseQueryText('油尖旺区有哪些直资中学');
    expect(p.district).toBe('油尖旺区');
    expect(p.level).toBe('secondary');
    expect(p.category).toBe('direct_subsidy');
    expect(p.isListLike).toBe(true);
    expect(p.rest).toBe('有哪些');
  });

  it('数量问法：沙田区有多少所小学（剩余为数量词）', () => {
    const p = parseQueryText('沙田区有多少所小学');
    expect(p.district).toBe('沙田区');
    expect(p.level).toBe('primary');
    expect(p.isListLike).toBe(true);
    expect(p.rest).toBe('有多少所');
  });
});

describe('enrichInput（原话补齐为结构化参数）', () => {
  it('列表问法：补齐区域与级别', () => {
    const out = enrichInput({ query: '沙田区有哪些小学' });
    expect(out.district).toBe('沙田区');
    expect(out.level).toBe('primary');
  });

  it('剥离后无剩余文本（「元朗幼稚園」）→ 补齐', () => {
    const out = enrichInput({ query: '元朗幼稚園' });
    expect(out.district).toBe('元朗区');
    expect(out.level).toBe('kg');
  });

  it('显式参数优先，不覆盖', () => {
    const out = enrichInput({ query: '沙田区有哪些小学', district: '元朗区' });
    expect(out.district).toBe('元朗区');
    expect(out.level).toBe('primary');
  });

  it('校名特征原话（「沙田官立小学」）→ 不补齐（交由 detail 精确匹配）', () => {
    const out = enrichInput({ query: '沙田官立小学' });
    expect(out.district).toBeUndefined();
    expect(out.level).toBeUndefined();
  });

  it('数量问法：补齐区域与级别（供搜索/统计使用）', () => {
    const out = enrichInput({ query: '沙田区有多少所小学' });
    expect(out.district).toBe('沙田区');
    expect(out.level).toBe('primary');
  });

  it('类别问法：「香港有多少所国际学校」补齐办学类型（无区域时不补区域）', () => {
    const out = enrichInput({ query: '香港有多少所国际学校' });
    expect(out.district).toBeUndefined();
    expect(out.schoolCategory).toBe('international');
  });

  it('组合词（无列表词，剩余为类别词）不补齐 → 交由校名/组合词兜底处理', () => {
    const out = enrichInput({ query: '油尖旺区直资中学' });
    expect(out.district).toBeUndefined();
    expect(out.level).toBeUndefined();
    expect(out.schoolCategory).toBeUndefined();
  });

  it('无 query → 原样返回', () => {
    expect(enrichInput({ district: '沙田区' })).toEqual({ district: '沙田区' });
  });
});

// ============================================================
// 鲁港通 - 学校数量 / 学生人数问法识别（search 与 stats 分流）
// ============================================================

describe('数量问法识别（search / stats 分流）', () => {
  it('isSchoolCountQuery：学校数量问法为真；人数问法与校名类为假', () => {
    expect(isSchoolCountQuery('沙田区有多少所小学')).toBe(true);
    expect(isSchoolCountQuery('有几间国际学校')).toBe(true);
    expect(isSchoolCountQuery('沙田区有多少中学生')).toBe(false); // 人数信号词排除
    expect(isSchoolCountQuery('喇沙书院')).toBe(false);
  });

  it('isStudentCountQuery：人数问法为真；学校数量问法为假', () => {
    expect(isStudentCountQuery('沙田区有多少中学生')).toBe(true);
    expect(isStudentCountQuery('沙田区有多少所小学')).toBe(false);
  });
});
