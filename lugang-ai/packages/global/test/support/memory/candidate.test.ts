import { describe, expect, it } from 'vitest';
import {
  UserMemoryCandidateMaxPerExtract,
  containsSensitiveMemory,
  filterNewMemoryCandidates,
  normalizeMemoryText,
  parseMemoryExtractionOutput,
  shouldExtractOnRound
} from '@fastgpt/global/support/memory/candidate';

describe('containsSensitiveMemory', () => {
  it('命中身份证号', () => {
    expect(containsSensitiveMemory('我的身份证号是 110101199001011234')).toBe(true);
  });

  it('命中银行卡号', () => {
    expect(containsSensitiveMemory('银行卡 6222021234567890123 是我的工资卡')).toBe(true);
  });

  it('命中密码与验证码', () => {
    expect(containsSensitiveMemory('我的登录密码是 abcd1234')).toBe(true);
    expect(containsSensitiveMemory('刚收到的验证码 123456')).toBe(true);
  });

  it('命中护照号', () => {
    expect(containsSensitiveMemory('护照号 E12345678，有效期到 2030 年')).toBe(true);
  });

  it('命中生物特征', () => {
    expect(containsSensitiveMemory('我的指纹和人脸都录入过')).toBe(true);
  });

  it('普通偏好与关注事项不误判', () => {
    expect(containsSensitiveMemory('我常驻深圳，请用简体中文回答。')).toBe(false);
    expect(containsSensitiveMemory('孩子明年入读香港小学。')).toBe(false);
    expect(containsSensitiveMemory('正在准备申请香港高才通计划。')).toBe(false);
  });
});

describe('normalizeMemoryText', () => {
  it('忽略空白、标点与大小写差异', () => {
    expect(normalizeMemoryText(' 我常驻深圳，请用简体中文回答。 ')).toBe(
      normalizeMemoryText('我常驻深圳 请用简体中文回答')
    );
    expect(normalizeMemoryText('Live in Shenzhen.')).toBe(normalizeMemoryText('live in shenzhen'));
  });
});

describe('shouldExtractOnRound', () => {
  it('首轮尝试，之后每 3 轮一次', () => {
    expect(shouldExtractOnRound(0)).toBe(false);
    expect(shouldExtractOnRound(1)).toBe(true);
    expect(shouldExtractOnRound(2)).toBe(false);
    expect(shouldExtractOnRound(3)).toBe(false);
    expect(shouldExtractOnRound(4)).toBe(true);
    expect(shouldExtractOnRound(7)).toBe(true);
  });
});

describe('parseMemoryExtractionOutput', () => {
  it('解析代码块包裹的 JSON 数组', () => {
    const raw = '```json\n["常驻深圳，希望用简体中文回答。","孩子明年入读小学。"]\n```';
    expect(parseMemoryExtractionOutput(raw)).toEqual([
      '常驻深圳，希望用简体中文回答。',
      '孩子明年入读小学。'
    ]);
  });

  it('解析对象形式的 memories 字段', () => {
    expect(parseMemoryExtractionOutput('{"memories":["关注高才通计划"]}')).toEqual([
      '关注高才通计划'
    ]);
  });

  it('从夹杂说明文字的输出中提取数组', () => {
    expect(parseMemoryExtractionOutput('结果如下：["关注高才通计划"] 以上')).toEqual([
      '关注高才通计划'
    ]);
  });

  it('非法输出返回空数组', () => {
    expect(parseMemoryExtractionOutput('没有可记住的信息')).toEqual([]);
    expect(parseMemoryExtractionOutput('')).toEqual([]);
  });

  it('过滤空白项、去重并限制条数', () => {
    const raw = JSON.stringify([' 保留 A ', '', '保留 A', 'B', 'C', 'D']);
    const result = parseMemoryExtractionOutput(raw);
    expect(result).toEqual(['保留 A', 'B', 'C']);
    expect(result.length).toBe(UserMemoryCandidateMaxPerExtract);
  });

  it('超长条目截断到 200 字', () => {
    const long = '甲'.repeat(260);
    expect(parseMemoryExtractionOutput(JSON.stringify([long]))[0].length).toBe(200);
  });
});

describe('filterNewMemoryCandidates', () => {
  const base = {
    existingMemories: ['我常驻深圳，请用简体中文回答。'],
    recentIgnoredContents: ['正在准备申请香港高才通计划。'],
    pendingContents: ['孩子明年要入读香港小学。']
  };

  it('过滤与已保存记忆重复的候选（忽略标点大小写）', () => {
    expect(
      filterNewMemoryCandidates({
        ...base,
        candidates: ['我常驻深圳 请用简体中文回答']
      })
    ).toEqual([]);
  });

  it('过滤被包含关系的重复候选', () => {
    expect(
      filterNewMemoryCandidates({
        ...base,
        candidates: ['常驻深圳']
      })
    ).toEqual([]);
  });

  it('过滤近 30 天已忽略与待确认的候选', () => {
    expect(
      filterNewMemoryCandidates({
        ...base,
        candidates: ['正在准备申请香港高才通计划', '孩子明年要入读香港小学']
      })
    ).toEqual([]);
  });

  it('候选之间去重并保持顺序', () => {
    expect(
      filterNewMemoryCandidates({
        ...base,
        candidates: ['关注香港升学政策。', '关注香港升学政策', '关注香港交通。']
      })
    ).toEqual(['关注香港升学政策。', '关注香港交通。']);
  });
});
