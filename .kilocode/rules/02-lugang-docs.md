---
description: 管理鲁港通的长期记忆与 Session 交接文件
globs:
  - "project-memory.md"
  - "session-handoff.md"
  - "PROJECT-MASTER.md"
  - "hk-transport-plugin/DEVELOPMENT.md"
  - "hk-transport-plugin/deploy.md"
alwaysApply: false
---

# 文档角色

- `project-memory.md`：长期项目记忆，记录已完成功能、重要决策和服务器部署信息。
- `session-handoff.md`：短期交接文件，记录每次 Session 的完成工作、待办任务和未解决问题。
- `PROJECT-MASTER.md`：统一主文档，整合账号、服务器配置、数据库信息、命名规范和技术架构说明。
- `hk-transport-plugin/DEVELOPMENT.md`：香港智能交通助手插件的实现进度、与主应用联调约定；`deploy.md` 为上传与验证步骤。
- `.cursor/rules/13-lugang-hk-transport-plugin.mdc`：插件目录与联调的 Cursor 专项规则。

# 使用规范

- 在分析项目、规划新功能或接手新任务前，应优先阅读 `project-memory.md` 和 `session-handoff.md`。
- 涉及香港交通系统工具时，同步阅读 `hk-transport-plugin/DEVELOPMENT.md`。
- 增加新功能或做出重要架构决策后：
  - 在 `project-memory.md` 的“已完成功能”和“重要决策记录”中追加记录。
  - 在 `session-handoff.md` 中更新“本次 Session 完成的工作”和“当前待办任务”。

# 自动化提醒

- 当用户说“结束”、“切换 session”、“收尾一下”、“帮我记录一下”等类似指令时：
  - 必须先帮助更新 `session-handoff.md` 和 `project-memory.md`，再结束当前对话。
- 如果发现代码的实际状态与文档描述明显不一致，应优先提醒用户并建议同步更新文档。