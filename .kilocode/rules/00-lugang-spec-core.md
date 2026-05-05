---
alwaysApply: true
---
# 鲁港通 - Spec 核心工作流规则

## 适用范围
- 本规则适用于“任何新增功能或重要改动”，特别是涉及前后端联动、数据结构变化、对外 API 行为变化的任务。
- 小的文案修改、样式微调可不严格走完整流程，但仍应简要记录在 session-handoff.md。

## 三步工作流总则
1. 设计阶段（Spec）
2. 编码与验证阶段（Code & Test）
3. 记忆更新阶段（Memory Update）

## 1. 设计阶段（Spec）
当用户提出一个新需求时，模型必须：
- 先阅读：
  - `PROJECT-MASTER.md`
  - `project-memory.md`
  - `session-handoff.md`
  - 对应功能目录下的 `specs/{feature-slug}/requirements.md`（若存在）
- 如果 `specs/{feature-slug}` 不存在：
  - 主动为该功能创建目录：`specs/{feature-slug}/`
  - 生成并填写：
    - `requirements.md`
    - `design.md`
    - `tasks.md`
- 在设计阶段禁止直接修改代码文件。
- 输出一份简洁的中文方案给用户确认，内容包括：
  - 将要修改/新增的文件列表（前后端分别列出）
  - 每个文件的修改点（函数、组件、接口）
  - 数据流/请求流程的简要说明
- 在得到用户“确认方案”之前，绝不进入编码阶段。

## 2. 编码与验证阶段（Code & Test）
- 仅在用户确认方案后，才可开始修改代码。
- 默认使用以下命令运行测试：
  - `pnpm vitest run --config vitest.simple.config.mts`
- 如果需要运行其他命令，必须先向用户说明用途和风险，并征得同意。
- 对于每个任务，编码时应优先参考：
  - `.cursor/rules/07-lugang-backend.mdc`
  - `.cursor/rules/08-lugang-frontend.mdc`
  - `.cursor/rules/09-lugang-rag-ai.mdc`
  - `.cursor/rules/10-lugang-testing.mdc`

## 3. 记忆更新阶段（Memory Update）
在测试通过且用户确认效果后，模型必须：
- 更新 `session-handoff.md`：
  - 本次完成的工作
  - 遗留问题
  - 下一步建议
- 更新 `project-memory.md`：
  - 新增的已完成功能条目
  - 新的架构/技术决策
- 如有新增或修改 `/specs/{feature-slug}` 下的文档，确保其与实际实现保持一致。
- 明确向用户说明：“交接文件和长期记忆已更新，可以继续下一轮开发”。
