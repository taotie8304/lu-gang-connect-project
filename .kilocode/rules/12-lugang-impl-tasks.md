---
alwaysApply: true
---
# 鲁港通 - 从 tasks.md 到实现的规则

## 任务选择
- 当用户提到某个功能时：
  - 先定位到 `specs/{feature-slug}/tasks.md`。
  - 找出尚未勾选的任务（`[ ]`）。
  - 向用户展示 1–3 个最合适的下一步任务，并请用户选择。

## 实现流程
- 针对用户选择的任务：
  - 在当前对话中重述一次任务内容，确保双方理解一致。
  - 从 `design.md` 中提取与该任务相关的技术细节。
  - 生成“本次要修改的文件列表”和“变更简要说明”，让用户确认。
  - 确认后才开始修改代码。

## 完成后的更新
- 代码修改并通过测试后：
  - 将对应任务从 `[ ]` 改为 `[x]` 写回 `tasks.md`。
  - 在 `session-handoff.md` 的“本次完成的工作”小节中记录该任务及相关文件。
  - 如有重要架构决策变化，追加到 `project-memory.md` 的“重要决策记录”。
- **香港交通系统工具**相关实现与部署步骤：同步维护 `hk-transport-plugin/DEVELOPMENT.md` 与 `hk-transport-plugin/deploy.md`；专项约定见 `.cursor/rules/13-lugang-hk-transport-plugin.mdc`。
