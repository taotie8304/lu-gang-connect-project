import { describe, expect, it } from 'vitest';
import {
  aiExecuteSchema,
  booleanSchema,
  clearBrowsingDataSchema,
  createTabSchema,
  cssRectSchema,
  documentDecideSchema,
  documentActiveSchema,
  documentTokenPayloadSchema,
  downloadIdSchema,
  findNextSchema,
  findQuerySchema,
  navigateUrlSchema,
  siteAiPrefGetSchema,
  siteAiPrefSetSchema,
  tabIdSchema,
  zoomSetSchema
} from '../src/main/ipcSchemas';

describe('cssRectSchema', () => {
  it('接受合法矩形', () => {
    expect(cssRectSchema.parse({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4
    });
  });

  it('拒绝负宽高与无穷值', () => {
    expect(cssRectSchema.safeParse({ x: 0, y: 0, width: -1, height: 10 }).success).toBe(false);
    expect(
      cssRectSchema.safeParse({ x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 10 }).success
    ).toBe(false);
  });

  it('拒绝缺字段', () => {
    expect(cssRectSchema.safeParse({ x: 0, y: 0, width: 10 }).success).toBe(false);
  });
});

describe('tabIdSchema', () => {
  it('接受正整数', () => {
    expect(tabIdSchema.parse(12)).toBe(12);
  });

  it('拒绝 0、负数与小数', () => {
    expect(tabIdSchema.safeParse(0).success).toBe(false);
    expect(tabIdSchema.safeParse(-3).success).toBe(false);
    expect(tabIdSchema.safeParse(1.5).success).toBe(false);
  });
});

describe('navigateUrlSchema', () => {
  it('去首尾空白', () => {
    expect(navigateUrlSchema.parse('  https://a.com  ')).toBe('https://a.com');
  });

  it('拒绝空串与超长输入', () => {
    expect(navigateUrlSchema.safeParse('   ').success).toBe(false);
    expect(navigateUrlSchema.safeParse(`https://a.com/${'a'.repeat(2048)}`).success).toBe(false);
  });
});

describe('booleanSchema', () => {
  it('只接受布尔值', () => {
    expect(booleanSchema.parse(true)).toBe(true);
    expect(booleanSchema.safeParse('true').success).toBe(false);
  });
});

describe('siteAiPref 相关 schema', () => {
  it('站点读取去掉首尾空白，拒绝空串', () => {
    expect(siteAiPrefGetSchema.parse({ origin: '  https://www.gov.hk  ' })).toEqual({
      origin: 'https://www.gov.hk'
    });
    expect(siteAiPrefGetSchema.safeParse({ origin: '   ' }).success).toBe(false);
  });

  it('设置只接受三档合法取值', () => {
    expect(siteAiPrefSetSchema.parse({ origin: 'https://a.com', mode: 'read_only' })).toEqual({
      origin: 'https://a.com',
      mode: 'read_only'
    });
    expect(
      siteAiPrefSetSchema.safeParse({ origin: 'https://a.com', mode: 'blocked' }).success
    ).toBe(true);
    expect(
      siteAiPrefSetSchema.safeParse({ origin: 'https://a.com', mode: 'unknown' }).success
    ).toBe(false);
    expect(siteAiPrefSetSchema.safeParse({ origin: '', mode: 'allow' }).success).toBe(false);
  });
});

describe('createTabSchema', () => {
  it('允许无参数', () => {
    expect(createTabSchema.parse(undefined)).toBeUndefined();
  });

  it('允许带网址', () => {
    expect(createTabSchema.parse({ url: 'https://a.com' })).toEqual({ url: 'https://a.com' });
  });

  it('拒绝空网址', () => {
    expect(createTabSchema.safeParse({ url: '' }).success).toBe(false);
  });
});

describe('aiExecuteSchema', () => {
  it('接受受控动作与可选续跑标记', () => {
    expect(
      aiExecuteSchema.parse({
        command: { action: 'click', ref: 'e1' },
        resume: true,
        commandId: 'cmd-1'
      })
    ).toEqual({
      command: { action: 'click', ref: 'e1' },
      resume: true,
      commandId: 'cmd-1'
    });
  });

  it('拒绝提交类越权动作', () => {
    expect(aiExecuteSchema.safeParse({ command: { action: 'submit' } }).success).toBe(false);
  });

  it('拒绝没有定位信息的点击', () => {
    expect(aiExecuteSchema.safeParse({ command: { action: 'click' } }).success).toBe(false);
  });

  it('拒绝超长命令标识', () => {
    expect(
      aiExecuteSchema.safeParse({
        command: { action: 'read' },
        commandId: 'c'.repeat(65)
      }).success
    ).toBe(false);
  });
});

describe('documentTokenPayloadSchema', () => {
  const token = '3f1b8c4a-9d2e-4f6b-8a1c-5e7d9b0f2a44';

  it('接受 uuid 形式的令牌并去首尾空白', () => {
    expect(documentTokenPayloadSchema.parse({ token: `  ${token}  ` })).toEqual({ token });
  });

  it('拒绝过短、过长与含特殊字符的令牌', () => {
    expect(documentTokenPayloadSchema.safeParse({ token: 'tok-1' }).success).toBe(false);
    expect(documentTokenPayloadSchema.safeParse({ token: `a${'b'.repeat(70)}` }).success).toBe(false);
    expect(documentTokenPayloadSchema.safeParse({ token: '3f1b8c4a/9d2e/4f6b/8a1c' }).success).toBe(false);
    expect(documentTokenPayloadSchema.safeParse({ token: '3f1b8c4a 9d2e 4f6b 8a1c 5e7d9b0f2a44' }).success).toBe(false);
  });

  it('拒绝缺少令牌', () => {
    expect(documentTokenPayloadSchema.safeParse({}).success).toBe(false);
  });
});

describe('documentActiveSchema', () => {
  const token = '3f1b8c4a-9d2e-4f6b-8a1c-5e7d9b0f2a44';

  it('接受令牌或空值', () => {
    expect(documentActiveSchema.parse({ token })).toEqual({ token });
    expect(documentActiveSchema.parse({ token: null })).toEqual({ token: null });
  });

  it('拒绝缺字段与非法令牌', () => {
    expect(documentActiveSchema.safeParse({}).success).toBe(false);
    expect(documentActiveSchema.safeParse({ token: 'x' }).success).toBe(false);
    expect(documentActiveSchema.safeParse({ token: 42 }).success).toBe(false);
  });
});

describe('documentDecideSchema', () => {
  const token = '3f1b8c4a-9d2e-4f6b-8a1c-5e7d9b0f2a44';

  it('接受采用与跳过两种决策', () => {
    expect(documentDecideSchema.parse({ token, index: 0, decision: 'apply' })).toEqual({
      token,
      index: 0,
      decision: 'apply'
    });
    expect(documentDecideSchema.safeParse({ token, index: 7, decision: 'skip' }).success).toBe(true);
  });

  it('拒绝其它决策与越界序号', () => {
    expect(documentDecideSchema.safeParse({ token, index: 0, decision: 'edit' }).success).toBe(false);
    expect(documentDecideSchema.safeParse({ token, index: -1, decision: 'apply' }).success).toBe(false);
    expect(documentDecideSchema.safeParse({ token, index: 60, decision: 'apply' }).success).toBe(false);
    expect(documentDecideSchema.safeParse({ token, index: 1.5, decision: 'apply' }).success).toBe(false);
  });
});

describe('findQuerySchema', () => {
  it('去空白后接受 1 到 200 字符的查询', () => {
    expect(findQuerySchema.parse({ query: '  政府服务  ' })).toEqual({ query: '政府服务' });
    expect(findQuerySchema.safeParse({ query: 'a'.repeat(200) }).success).toBe(true);
  });

  it('拒绝空白查询与超长查询', () => {
    expect(findQuerySchema.safeParse({ query: '   ' }).success).toBe(false);
    expect(findQuerySchema.safeParse({ query: 'a'.repeat(201) }).success).toBe(false);
  });
});

describe('findNextSchema', () => {
  it('只接受 next 与 previous', () => {
    expect(findNextSchema.parse({ direction: 'next' })).toEqual({ direction: 'next' });
    expect(findNextSchema.parse({ direction: 'previous' })).toEqual({ direction: 'previous' });
    expect(findNextSchema.safeParse({ direction: 'up' }).success).toBe(false);
  });
});

describe('zoomSetSchema', () => {
  it('接受 50 到 200 的整数', () => {
    expect(zoomSetSchema.parse({ percent: 125 })).toEqual({ percent: 125 });
    expect(zoomSetSchema.safeParse({ percent: 50 }).success).toBe(true);
    expect(zoomSetSchema.safeParse({ percent: 200 }).success).toBe(true);
  });

  it('拒绝越界与小数', () => {
    expect(zoomSetSchema.safeParse({ percent: 49 }).success).toBe(false);
    expect(zoomSetSchema.safeParse({ percent: 201 }).success).toBe(false);
    expect(zoomSetSchema.safeParse({ percent: 110.5 }).success).toBe(false);
  });
});

describe('downloadIdSchema', () => {
  it('接受非空 id 并去空白', () => {
    expect(downloadIdSchema.parse({ id: ' abc ' })).toEqual({ id: 'abc' });
  });

  it('拒绝空 id 与超长 id', () => {
    expect(downloadIdSchema.safeParse({ id: '  ' }).success).toBe(false);
    expect(downloadIdSchema.safeParse({ id: 'x'.repeat(65) }).success).toBe(false);
  });
});

describe('clearBrowsingDataSchema', () => {
  it('接受任意勾选组合', () => {
    expect(
      clearBrowsingDataSchema.parse({ cookies: true, cache: false, permissions: true })
    ).toEqual({ cookies: true, cache: false, permissions: true });
  });

  it('拒绝一项都不勾的请求', () => {
    expect(
      clearBrowsingDataSchema.safeParse({ cookies: false, cache: false, permissions: false }).success
    ).toBe(false);
  });

  it('拒绝缺字段与非布尔值', () => {
    expect(clearBrowsingDataSchema.safeParse({ cookies: true, cache: true }).success).toBe(false);
    expect(
      clearBrowsingDataSchema.safeParse({ cookies: 'true', cache: false, permissions: false }).success
    ).toBe(false);
  });
});
