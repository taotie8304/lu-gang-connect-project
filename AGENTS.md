# 鲁港通 (Lu-Gang Connect) — Windsurf Cascade 全局指引

> **版本**: 2026-05-03  
> **继承自**: `.cursorrules` + `.cursor/rules/01-10`  
> **适用工具**: Windsurf Cascade（同时兼容 Cursor）

---

## 一、项目基本信息

| 项目 | 说明 |
|------|------|
| 名称 | 鲁港通 AI 智能体平台（Lu-Gang Connect） |
| 目标 | 让大陆用户通过 AI 直接查询来自香港政府官方数据集的民生、教育、金融、投资及营商政策；同步对接山东省政府开放 API |
| 前端 | lugang-ai — 基于 FastGPT 4.14.4 二开，Next.js 14 + TypeScript + Chakra UI |
| 后端 | lugang-connect-enterprise — 基于 One API v0.6.10，Go + Gin + MySQL |
| 数据库 | MongoDB + pgvector（RAG）+ Redis（缓存）|
| 部署 | Docker Compose（前端 www.airscend.com:3210），单独 docker run（后端 api.airscend.com:8080），镜像走 GHCR |
| 用户背景 | 项目负责人零编程经验，所有技术决策需用简体中文解释，避免行业黑话 |

---

## 二、强制：每次工作开始前必读

在任何开始编码、修改文件、执行命令之前，Cascade 必须先读取以下文件：

1. PROJECT-MASTER.md — 项目总览与架构说明
2. project-memory.md — 长期技术记忆与决策历史
3. session-handoff.md — 上一次 Session 的交接记录、遗留问题、下一步建议

读取完成后，向用户输出一段不超过 150 字的中文状态摘要，格式为：

📋 当前状态：[最近完成的关键功能]
⚠️  遗留问题：[最重要的未解决问题]
➡️  建议下一步：[推荐优先处理的任务]

未完成以上步骤前，禁止开始任何代码修改。

---

## 三、Spec 驱动三步开发工作流（核心规则）

所有新增功能或重要改动必须严格遵循以下三步，不得跳过。

### 第一步：设计阶段（Spec）

1. 检查 specs/{功能名}/ 目录是否存在。
2. 若不存在，主动创建并生成以下三个文件：
   - specs/{功能名}/requirements.md
   - specs/{功能名}/design.md
   - specs/{功能名}/tasks.md
3. 向用户输出一份中文方案确认单，包含：
   - 将修改/新增的文件列表（前端 / 后端分列）
   - 数据流或请求流程（简要步骤）
   - 潜在风险或依赖项
4. 在用户明确回复"确认"或"开始"之前，绝对禁止修改任何代码文件。

### 第二步：编码与验证阶段（Code & Test）

- 仅在用户确认方案后才可修改代码。
- 每次修改前再次说明"我现在要修改 X 文件，原因是 Y"。
- 前端测试命令：pnpm vitest run --config vitest.simple.config.mts
- 需要执行任何服务器命令、Docker 操作、数据库变更时，必须先向用户说明用途和风险，等待确认后再执行。
- 每完成一个子任务，在 specs/{功能名}/tasks.md 中将对应条目从 [ ] 改为 [x]。

### 第三步：记忆更新阶段（Memory Update）

测试通过且用户确认效果后，必须更新以下文件：

- session-handoff.md：记录本次完成的工作、遗留问题、下一步建议
- project-memory.md：追加已完成功能条目、新的架构或技术决策
- 向用户说明："✅ 交接文件和长期记忆已更新，可以进入下一轮开发。"

---

## 四、项目架构约束

### 4.1 前端（lugang-ai）

- 框架：Next.js 14 App Router，TypeScript strict 模式
- UI：Chakra UI（不引入其他 UI 框架）
- 状态管理：Zustand（已有约定，不改为其他方案）
- API 调用：统一走 /api/ 内部路由，不在前端直接暴露后端地址
- 多语言：繁体中文（zh-HK）/ 简体中文（zh-CN）/ 英文（en），i18n 文件统一放 src/i18n/
- CJK 搜索：使用已集成的 opencc-js 做简繁转换，不重新引入其他转换库

### 4.2 后端（lugang-connect-enterprise）

- 语言：Go，遵循 Go 标准项目结构
- 路由：Gin 框架，RESTful 命名规范
- 数据库：MySQL（结构变更需提供迁移 SQL，不直接 ALTER 生产表）
- 环境变量：所有密钥 / 密码通过 .env 注入，禁止硬编码到代码文件
- 日志：统一使用已有日志中间件，不引入新的日志库

### 4.3 部署约束

禁止在未经用户确认的情况下执行以下命令：
- docker restart / docker stop / docker rm
- git push / git force push
- 任何数据库 DROP / TRUNCATE 操作

镜像 tag 格式：ghcr.io/taotie8304/{service}:{YYYY-MM-DD}
Compose 文件修改后，必须输出 docker compose config 验证结果供用户检查。

### 4.4 安全约束

- 所有用户输入必须经过验证和清理
- 前端密码：双重 SHA-256 哈希后传输
- 后端密码存储：bcrypt（cost >= 10）
- CORS 来源仅允许 airscend.com 及其子域
- 任何涉及 root 账号、管理员权限的操作，必须单独确认

---

## 五、代码风格与命名规范

| 类型 | 规范 |
|------|------|
| 变量/函数 | camelCase（TypeScript/JS），snake_case（Go） |
| 组件文件 | PascalCase，例如 SubscriptionCard.tsx |
| API 路由 | kebab-case，例如 /api/v1/subscription-plans |
| 数据库字段 | snake_case |
| 注释语言 | 简体中文（面向项目负责人）+ 英文技术术语保留原文 |
| Commit 信息 | feat: / fix: / docs: / refactor: + 中文说明，例如 feat: 新增订阅计划页面 |

---

## 六、RAG 与 AI 能力约束

- 知识库文档来源：仅使用香港政府官方开放数据（data.gov.hk）和山东省政府官方 API
- 向量模型：已配置的 pgvector embedding，不擅自更换
- 引用格式：联网搜索结果引用必须透传 search_info，确保前端 Citation Parser 正确解析
- 语言检测：用户发简体中文回简体中文；繁体中文回繁体中文；英文回英文
- 禁止在回答中捏造香港或山东政策内容，不确定时引导用户访问官方链接

---

## 七、当前开发重点（P0 优先）

截至 2026-05-03 最高优先级的未完成功能：

- [ ] 订阅/付费套餐系统（specs/subscription-system/）
  - 套餐计划数据模型（前端 + 后端 + 数据库）
  - 订阅状态管理（用量限制、到期提醒）
  - 支付网关集成（初期可用模拟接口）
- [ ] 联网搜索引用修复（生产环境验证 internet 模型切回原生协议）
- [ ] 语言切换稳定性（CJK 搜索规范化在所有场景下正常工作）

---

## 八、沟通规范

- 所有回复使用简体中文，技术术语保留英文原文，首次出现时给出中文解释
- 向用户提问时，每次只问一个问题，不把多个问题合并在一起
- 遇到歧义，先给出推荐方案，让用户选择"确认 / 修改 / 取消"
- 执行复杂任务时，先输出"我将要做的事情"清单，让用户过目后再开始
- 禁止使用模糊表达；不确定时直接说明不确定，并提出验证方法

---

## 九、文件目录参考
lu-gang-connect-project/
├── AGENTS.md # 本文件（Windsurf 全局规则）
├── PROJECT-MASTER.md # 项目总架构（每次必读）
├── project-memory.md # 长期记忆（每次必读）
├── session-handoff.md # Session 交接（每次必读）
├── .cursorrules # Cursor 全局规则（保留不删）
├── .cursor/rules/ # Cursor 模块化规则 01-12（保留不删）
├── specs/ # Spec 驱动开发文档
│ ├── README.md
│ └── subscription-system/ # 当前 P0 功能
│ ├── requirements.md
│ ├── design.md
│ └── tasks.md
├── lugang-ai/ # 前端（FastGPT 二开）
│ └── AGENTS.md # 前端专属规则（可选，后续补充）
└── lugang-connect-enterprise/ # 后端（One API 二开）
└── AGENTS.md # 后端专属规则（可选，后续补充）

text

---

*本文件由 Perplexity AI 基于鲁港通 GitHub 仓库现有文档综合生成，2026-05-03。*
