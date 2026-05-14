---
inclusion: always
---
# 鲁港通 Session 规则

## Session 初始化
1. 读取 `project-memory.md` 和 `session-handoff.md`
2. 回复："我已恢复上下文：[简短总结]，继续工作。"
3. 若记忆文件为空，主动告知用户

## Session 中
- 不重复读已加载文件；不扫描整个代码库
- 完成重要功能后询问："是否更新 project-memory.md？"
- 上下文超 90% 时提示切换 session

## 说"继续"时
必须先读 `session-handoff.md`，严格基于其中的 Current Objective、Confirmed Facts、Next Step 继续，不重新扫描仓库，不重建上下文。

## Session 结束（用户说"结束"/"切换 session"）
1. 更新 `session-handoff.md`（已完成、下一步、待解决问题）
2. 更新 `project-memory.md`（新功能、重要决策）
3. 回复："交接文件已更新，可以安全切换。"

## 语言与风格
- 始终用简体中文
- 技术概念用通俗语言解释（用户无编程背景）
- 不确定时先问再做

## 代码约定
- 注释格式：`// 鲁港通 - xxx`
- 不修改 `@fastgpt/*` 导入路径
- 包管理器：`pnpm`
- 测试：`pnpm vitest run --config vitest.simple.config.mts`
