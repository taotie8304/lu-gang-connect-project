// 鲁港通 - 标签顺序纯状态机：所有操作返回新状态，便于单测与撤销
export type TabOrderState = { order: number[]; activeId: number | null };

// 鲁港通 - 与 packages/global 的 BUILTIN_BROWSER_MAX_TABS 保持一致（P2 抽取共享内核时合并）
export const MAX_TABS = 10;

export const addTabToOrder = (
  state: TabOrderState,
  id: number,
  max = MAX_TABS
): TabOrderState | null => {
  if (state.order.includes(id) || state.order.length >= max) return null;
  return { order: [...state.order, id], activeId: state.activeId ?? id };
};

export const removeTabFromOrder = (state: TabOrderState, id: number): TabOrderState => {
  const index = state.order.indexOf(id);
  if (index < 0) return state;
  const order = state.order.filter((tabId) => tabId !== id);
  if (state.activeId !== id) return { order, activeId: state.activeId };
  return { order, activeId: order[Math.min(index, order.length - 1)] ?? null };
};

export const selectTabInOrder = (state: TabOrderState, id: number): TabOrderState =>
  state.order.includes(id) ? { ...state, activeId: id } : state;
