---
inclusion: always
---

# Session 交接文件

> 本文件记录 session 间的工作交接信息，每次 session 结束时自动更新。

## ⚠️ 当前最重要的背景信息（新 Session 必读）

### 开发工具变更
- **Kiro IDE 已停止使用**（2026年4月，由于 Claude API 访问问题）。
- **当前开发工具：Cursor IDE**，通过 **OpenRouter** 接入 `anthropic/claude-opus-4.6` 模型。
- OpenRouter 配置方式：Cursor Settings → Models → Override OpenAI Base URL 填入 `https://openrouter.ai/api/v1`，API Key 填入 OpenRouter Key。

### 未完成的核心功能
- **订阅功能（Subscription）**：当前**完全未完成**，是平台商业化的关键阻塞点。用户无法订阅付费套餐。这是下一阶段的最高优先级任务。

## 上一次 Session 完成的工作

### 1. ✅ 香港智能交通助手（hk-transport-plugin）与主应用联调文档化
- **插件包**：`build.mjs` 生成 `dist/hk_transport_assistant.pkg`；数据脚本 `scripts/prepare-data.mjs` → `src/data/transit.ts`；多模式规划 `src/planner.ts`；问法 `src/parser.ts`。
- **主应用修复**：`lugang-ai/.../child/runTool.ts` 增加 `parseSystemToolStreamResult` / `isSystemToolEnvelopeError`，修复系统工具调试结果 `toolRes` 为 `{}`（SSE 终包无 `output` 包裹时）。
- **文档与规则**：新增 `hk-transport-plugin/DEVELOPMENT.md`、重写 `deploy.md`；新增 `.cursor/rules/13-lugang-hk-transport-plugin.mdc`；更新 `02-lugang-docs.mdc` globs；同步 `project-memory.md`、本文件、`PROJECT-MASTER.md`、`04-lugang-deploy.mdc`。

### 2. ✅ Cursor 规则体系补全（历史）
- **新增 4 个专项规则文件**（`.cursor/rules/`）：
  - `07-lugang-backend.mdc`：Go / One API 后端开发规范
  - `08-lugang-frontend.mdc`：Next.js / FastGPT 前端开发规范
  - `09-lugang-rag-ai.mdc`：RAG 知识库与 AI 工作流规范
  - `10-lugang-testing.mdc`：测试规范与质量保证标准
- **更新 `session-handoff.md`**：记录 Kiro → Cursor 迁移信息和订阅功能待完成状态。

### 3. ✅ 历史已完成功能（参考 project-memory.md）
- CJK 简繁搜索规范化（opencc-js）
- 联网搜索引用修复（前端 Citation Parser + 后端 search_info 透传）
- 前端使用条款功能（SystemContentModal）
- 多语言系统内容支持（简体/繁体/英文）
- 用户设置面板多语言支持
- 临时测试文件清理（47 个）

## 当前待办任务（按优先级）

### 🔴 P0 - 最高优先级
1. **订阅功能开发**：
   - 研究 FastGPT 上游仓库的 `support/user/team/` 团队/配额体系
   - 设计鲁港通的订阅套餐（免费版 / 专业版 / 企业版）
   - 实现支付集成（微信支付 / 支付宝 / Stripe）
   - 实现套餐到期/自动续费逻辑

### 🟡 P1 - 次高优先级
2. **交通插件生产验证**：
   - 确认服务器 **lugang-ai 镜像** 已包含 **`runTool.ts` SSE 解析修复** 后再验收工作流调试/UI。
   - 按需执行 `prepare-data.mjs` 更新政府静态数据并重新 `node build.mjs`、覆盖上传 `.pkg`。
3. **联网搜索引用修复验证**：
   - internet 模型已切换到原生 DashScope 协议，待在生产环境验证引用是否正常显示。
4. **用户设置多语言功能验证**：
   - 需清除浏览器缓存后访问 https://www.airscend.com 测试语言切换。

### 🟢 P2 - 常规优化
4. **香港政府 API 数据同步**：建立定期同步机制，确保知识库数据时效性。
5. **知识库准确度提升**：针对用户反馈的瑕疵问题持续优化分块策略和检索参数。

## 未解决的问题或 Bug

- **系统工具调试 `toolRes` 为空 `{}`**：若插件服务已返回完整 JSON 而界面仍为空，多为 **主应用未部署** 含 `parseSystemToolStreamResult` 的 `runTool.ts`（需更新 **lugang-ai 服务端镜像**，非仅前端静态资源）。
- 订阅功能完全未开始开发（P0 阻塞）
- 联网搜索引用修复正在验证中（已切换 internet 模型到原生协议，待生产验证）
- 用户设置多语言功能已部署，待用户验证（需清除浏览器缓存）

## 重要文件路径

### 香港交通系统工具（hk-transport-plugin）
- **进度与契约**：`hk-transport-plugin/DEVELOPMENT.md`
- **上传步骤**：`hk-transport-plugin/deploy.md`
- **专项 Cursor 规则**：`.cursor/rules/13-lugang-hk-transport-plugin.mdc`
- **主应用解析修复**：`lugang-ai/packages/service/core/workflow/dispatch/child/runTool.ts`

### 核心配置文件
- **项目主文档**：`PROJECT-MASTER.md`（包含所有账号密码、服务器配置）
- **长期记忆**：`project-memory.md`
- **Cursor 规则目录**：`.cursor/rules/`（含 `00`–`13` 等规则文件，其中 **`13-lugang-hk-transport-plugin.mdc`** 对应交通插件）

### 前端关键文件
- 系统内容组件：`lugang-ai/projects/app/src/components/SystemContentModal/index.tsx`
- 用户设置面板：`lugang-ai/projects/app/src/components/UserSettingsPanel/index.tsx`
- 系统内容常量：`lugang-ai/packages/global/support/systemContent/constant.ts`
- 系统内容 API：`lugang-ai/projects/app/src/pages/api/system/content/[key].ts`
- 翻译文件：`lugang-ai/packages/web/i18n/{语言}/`

### 后端关键文件
- 密码加密函数：`lugang-connect-enterprise/common/crypto.go`

### 数据库
- 前端数据库：MongoDB `lugang_ai` 数据库（不是 `fastgpt`）
- 后端数据库：MySQL `lugang_connect` 数据库

### 实用工具脚本
- 系统内容添加：`add_*.js`（6个）
- 繁简转换：`convert_*.js`（3个）
- 系统内容更新：`update_*.js`（3个）
- 批量更新：`update_all_system_contents.sh`
- 密码重置：`reset_root_password.js`

## 特殊注意事项

- **前端数据库名称**：前端连接的是 `lugang_ai` 数据库，环境变量 `MONGODB_URI` 中指定
- **后端密码加密**：使用标准 bcrypt（`bcrypt.GenerateFromPassword`），不是双重 SHA256
- **前端密码加密**：使用双重 SHA256 哈希（`hashStr(hashStr(password))`）
- **docker-compose 服务名称**：前端服务名是 `lugang-ai`，不是 `app`
- 运行测试使用 `pnpm vitest run --config vitest.simple.config.mts`（不要用 npx）
- fast-check v4 没有 `stringOf` 方法，用 `fc.array(...).map(chars => chars.join(''))` 替代
- 项目使用 pnpm workspace monorepo 结构，fast-check 安装在根目录 devDependencies
- opencc-js 没有 TypeScript 类型声明，已手动创建在 `packages/service/common/string/opencc-js.d.ts`
- 服务器 IP：156.225.30.134（宝塔面板），项目目录：`/www/wwwroot/lugang-ai`
