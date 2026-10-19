import { describe, expect, it } from 'vitest';
import {
  AI_SNAPSHOT_FULL_TEXT_LIMIT,
  AI_SNAPSHOT_MAX_ELEMENTS,
  AI_SNAPSHOT_TEXT_LIMIT,
  normalizeAiSnapshot,
  sanitizeSnapshotUrl,
  snapshotChanged,
  snapshotContains
} from '../src/main/ai/snapshot';

const makeRaw = (overrides: Record<string, unknown> = {}) => ({
  url: 'https://www.gov.hk/sc/forms/apply?token=secret#part2',
  title: '政府表格',
  text: '第一步 填写申请人资料 第二步 提交',
  scroll: { x: 0, y: 320, viewportWidth: 1280, viewportHeight: 720, pageHeight: 2400 },
  elements: [
    {
      ref: 'e1',
      role: 'textbox',
      name: '申请人姓名',
      tag: 'input',
      type: 'text',
      placeholder: '请输入姓名',
      value: '张三',
      visible: true
    },
    {
      ref: 'e2',
      role: 'textbox',
      name: '账户密码',
      tag: 'input',
      type: 'password',
      value: 'super-secret',
      visible: true
    },
    {
      ref: 'e3',
      role: 'textbox',
      name: '短信验证码',
      tag: 'input',
      type: 'text',
      value: '123456',
      visible: true
    },
    {
      ref: 'e4',
      role: 'button',
      name: '下一步',
      tag: 'button',
      text: '下一步',
      enabled: true,
      disabled: false,
      visible: true
    }
  ],
  ...overrides
});

describe('AI 页面快照', () => {
  it('规范化快照并去掉网址中的查询参数与锚点', () => {
    const snapshot = normalizeAiSnapshot(makeRaw());

    expect(snapshot.url).toBe('https://www.gov.hk/sc/forms/apply');
    expect(snapshot.title).toBe('政府表格');
    expect(snapshot.text).toContain('申请人资料');
    expect(snapshot.scroll).toEqual({
      x: 0,
      y: 320,
      viewportWidth: 1280,
      viewportHeight: 720,
      pageHeight: 2400
    });
    expect(snapshot.elements.map((item) => item.ref)).toEqual(['e1', 'e2', 'e3', 'e4']);
    expect(snapshot.elements[0]).toMatchObject({
      name: '申请人姓名',
      placeholder: '请输入姓名',
      value: '张三',
      visible: true
    });
  });

  it('截断超长文本与超量元素', () => {
    const elements = Array.from({ length: AI_SNAPSHOT_MAX_ELEMENTS + 40 }, (_, index) => ({
      ref: `e${index + 1}`,
      role: 'button',
      name: `按钮${index + 1}`,
      tag: 'button',
      visible: true
    }));
    const snapshot = normalizeAiSnapshot(
      makeRaw({ text: '政'.repeat(AI_SNAPSHOT_FULL_TEXT_LIMIT + 500), elements })
    );

    expect(snapshot.text).toHaveLength(AI_SNAPSHOT_TEXT_LIMIT);
    expect(snapshot.textTruncated).toBe(true);
    expect(snapshot.elements).toHaveLength(AI_SNAPSHOT_MAX_ELEMENTS);
    expect(snapshot.elementsTruncated).toBe(true);
  });

  it('全文读取时放宽文本上限', () => {
    const snapshot = normalizeAiSnapshot(
      makeRaw({ text: '政'.repeat(AI_SNAPSHOT_FULL_TEXT_LIMIT + 500) }),
      { fullText: true }
    );
    expect(snapshot.text).toHaveLength(AI_SNAPSHOT_FULL_TEXT_LIMIT);
    expect(snapshot.textTruncated).toBe(true);
  });

  it('密码、验证码、银行卡等字段不返回输入值', () => {
    const snapshot = normalizeAiSnapshot(
      makeRaw({
        elements: [
          {
            ref: 'e1',
            role: 'textbox',
            name: '登录密码',
            tag: 'input',
            type: 'password',
            value: 'secret-1',
            visible: true
          },
          {
            ref: 'e2',
            role: 'textbox',
            name: '手机验证码',
            tag: 'input',
            type: 'text',
            value: '654321',
            visible: true
          },
          {
            ref: 'e3',
            role: 'textbox',
            name: '银行卡号',
            tag: 'input',
            type: 'text',
            value: '6222021234567890',
            visible: true
          },
          {
            ref: 'e4',
            role: 'textbox',
            name: '申请人姓名',
            tag: 'input',
            type: 'text',
            value: '张三',
            visible: true
          }
        ]
      })
    );

    expect(snapshot.elements[0].value).toBeUndefined();
    expect(snapshot.elements[1].value).toBeUndefined();
    expect(snapshot.elements[2].value).toBeUndefined();
    expect(snapshot.elements[3].value).toBe('张三');
  });

  it('非法快照返回空结构', () => {
    const snapshot = normalizeAiSnapshot(null);
    expect(snapshot).toMatchObject({ url: '', title: '', text: '', elements: [] });
    expect(snapshot.scroll).toMatchObject({ x: 0, y: 0 });
  });

  it('网址规范化只保留 http(s) 的源与路径', () => {
    expect(sanitizeSnapshotUrl('https://www.gov.hk/a/b?token=1#x')).toBe(
      'https://www.gov.hk/a/b'
    );
    expect(sanitizeSnapshotUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeSnapshotUrl('file:///C:/secret.txt')).toBe('');
    expect(sanitizeSnapshotUrl(undefined)).toBe('');
  });

  it('snapshotChanged 能检测网址、正文与字段值变化', () => {
    const before = normalizeAiSnapshot(makeRaw());
    expect(snapshotChanged(before, normalizeAiSnapshot(makeRaw()))).toBe(false);

    const changedValue = normalizeAiSnapshot(
      makeRaw({
        elements: [
          {
            ref: 'e1',
            role: 'textbox',
            name: '申请人姓名',
            tag: 'input',
            type: 'text',
            value: '李四',
            visible: true
          }
        ]
      })
    );
    expect(snapshotChanged(before, changedValue)).toBe(true);

    const changedUrl = normalizeAiSnapshot(makeRaw({ url: 'https://www.gov.hk/sc/done' }));
    expect(snapshotChanged(before, changedUrl)).toBe(true);
    expect(snapshotChanged(before, normalizeAiSnapshot(makeRaw({ text: '已提交' })))).toBe(true);
  });

  it('snapshotContains 同时检查正文与元素名称', () => {
    const snapshot = normalizeAiSnapshot(makeRaw());
    expect(snapshotContains(snapshot, '第二步')).toBe(true);
    expect(snapshotContains(snapshot, '申请人姓名')).toBe(true);
    expect(snapshotContains(snapshot, '已提交')).toBe(false);
    expect(snapshotContains(snapshot, '   ')).toBe(true);
  });
});
