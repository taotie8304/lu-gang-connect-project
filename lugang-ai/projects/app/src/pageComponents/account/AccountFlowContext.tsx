import { createContext, useContext } from 'react';

// 鲁港通 - 标记面板是否渲染在文档流外壳（账号中心页）内：true 时面板自然撑开，false（默认，如设置弹窗）保持原定高内滚动
export const AccountFlowContext = createContext(false);

export const useAccountFlow = () => useContext(AccountFlowContext);
