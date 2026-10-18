import { describe, expect, it } from 'vitest';
import {
  MAX_TABS,
  addTabToOrder,
  removeTabFromOrder,
  selectTabInOrder
} from '../src/main/tabs';

describe('addTabToOrder', () => {
  it('首个标签自动成为当前标签', () => {
    expect(addTabToOrder({ order: [], activeId: null }, 1)).toEqual({
      order: [1],
      activeId: 1
    });
  });

  it('后续标签追加但不抢占当前标签', () => {
    expect(addTabToOrder({ order: [1], activeId: 1 }, 2)).toEqual({
      order: [1, 2],
      activeId: 1
    });
  });

  it('重复 id 返回 null', () => {
    expect(addTabToOrder({ order: [1], activeId: 1 }, 1)).toBeNull();
  });

  it('达到上限返回 null', () => {
    const state = { order: Array.from({ length: MAX_TABS }, (_, i) => i + 1), activeId: 1 };
    expect(addTabToOrder(state, 99)).toBeNull();
  });
});

describe('removeTabFromOrder', () => {
  it('删除非当前标签不影响当前标签', () => {
    expect(removeTabFromOrder({ order: [1, 2, 3], activeId: 1 }, 2)).toEqual({
      order: [1, 3],
      activeId: 1
    });
  });

  it('删除当前标签后选中原位置的下一个', () => {
    expect(removeTabFromOrder({ order: [1, 2, 3], activeId: 2 }, 2)).toEqual({
      order: [1, 3],
      activeId: 3
    });
  });

  it('删除最后一个标签后回退到前一个', () => {
    expect(removeTabFromOrder({ order: [1, 2], activeId: 2 }, 2)).toEqual({
      order: [1],
      activeId: 1
    });
  });

  it('删除唯一标签后当前标签为空', () => {
    expect(removeTabFromOrder({ order: [1], activeId: 1 }, 1)).toEqual({
      order: [],
      activeId: null
    });
  });

  it('删除不存在的标签返回原状态', () => {
    const state = { order: [1], activeId: 1 };
    expect(removeTabFromOrder(state, 9)).toBe(state);
  });
});

describe('selectTabInOrder', () => {
  it('选中已存在标签', () => {
    expect(selectTabInOrder({ order: [1, 2], activeId: 1 }, 2)).toEqual({
      order: [1, 2],
      activeId: 2
    });
  });

  it('选中不存在的标签返回原状态', () => {
    const state = { order: [1], activeId: 1 };
    expect(selectTabInOrder(state, 9)).toBe(state);
  });
});
