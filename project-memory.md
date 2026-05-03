---
inclusion: always
---

# 鲁港通项目 - 永久记忆

> 本文件是项目的长期记忆存储，每个 session 自动加载。请在重要节点更新。

## 项目简介

- 项目名称：鲁港通跨境AI智能平台
- 前端（lugang-ai）：基于 FastGPT 二开，Next.js + TypeScript，端口 3210
- 后端（lugang-connect-enterprise）：基于 One API，Go 语言，端口 8080
- 前端域名：www.airscend.com
- 后端域名：api.airscend.com
- 包管理器：pnpm（monorepo 结构）
- 测试框架：vitest + fast-check（属性测试）

## 技术栈

- 前端：Next.js 14, React, TypeScript, Chakra UI, MongoDB, Redis
- 后端：Go, Gin, MySQL/PostgreSQL
- 部署：Docker Compose
- AI 模型接入：OpenAI 兼容接口

## 已完成功能

<!-- 每完成一个功能在此追加 -->
- [x] CJK 简繁搜索规范化 - 核心转换模块（opencc-js）
- [x] CJK 简繁搜索规范化 - HTTP 工具集成（http468 + runHTTPTool + runTool）
- [x] CJK 简繁搜索规范化 - 知识库搜索集成（controller.ts 查询扩展）
- [x] 联网搜索引用修复 - 前端 Citation Parser 增强（extractBareNumberReferences + cleanOrphanCitations）
- [x] 联网搜索引用修复 - 后端 search_info 透传（openai.StreamHandler 过滤逻辑修复）
- [ ] 联网搜索引用修复 - 后端 internet 模型切回原生协议（验证中）
- [x] 前端使用条款功能 - 数据库内容更新和组件修复（SystemContentModal）
- [x] 后端 root 密码重置 - 使用标准 bcrypt 哈希
- [x] 多语言系统内容支持 - 使用条款、隐私政策、个人资料收集声明（简体/繁体/英文）
- [x] 自动繁简转换功能 - 使用 opencc-js 自动将繁体内容转换为简体（convert_to_simplified.js）
- [x] 用户设置面板多语言支持 - 菜单项自动根据语言切换
- [x] 项目文档整理 - 创建统一主文档 PROJECT-MASTER.md
- [x] 临时测试文件清理 - 删除 47 个临时测试和检查文件
- [x] **香港智能交通助手（FastGPT 系统工具）** — `hk-transport-plugin`：`.pkg` ZIP+IIFE 打包、`hk_transport_assistant` toolId、政府 GeoJSON 预处理多模式规划（巴士/小巴/港铁/渡轮/电车/缆车）、`planner` 坐标匹配站点、`parser`「A 到 B」问法、主应用 `runTool.ts` 兼容无 `output` 包裹的 SSE 终包（修复调试界面 `toolRes` 为 `{}`）

## 重要决策记录

<!-- 记录架构决策、技术选型等 -->
- 简繁转换使用 opencc-js（纯 JS，无原生依赖），通过 `__enableS2T__` 工作流变量控制
- 知识库搜索简繁兼容通过 `feConfigs.enableCjkNormalization` 系统配置控制
- 属性测试使用 fast-check，每个属性最少 100 次迭代
- 联网搜索引用修复：`-internet` 后缀模型必须走原生 DashScope 协议（不走兼容模式），因为兼容模式 SSE 流不返回 `search_info`
- 非联网的 Qwen3.5/QwQ/Qwen3 系列继续走兼容模式以支持 `reasoning_content`
- **前端数据库**：前端连接的是 `lugang_ai` 数据库（不是 `fastgpt`），环境变量 `MONGODB_URI` 中指定
- **密码加密方式**：前端使用双重 SHA256 哈希，后端（One API）使用标准 bcrypt
- **多语言系统内容架构**：
  - 数据库 key 命名规则：`{base_key}` (繁体)、`{base_key}_zh-CN` (简体)、`{base_key}_en` (英文)
  - API 根据 Cookie (`NEXT_LOCALE`) 自动选择对应语言版本
  - 繁简转换使用 opencc-js (hk→cn)，转换准确率 >99%
  - 简体版本可通过 `convert_to_simplified.js` 脚本自动生成，无需人工翻译
- **FastGPT 系统工具 / 香港交通插件**：
  - 工具包为标准 **ZIP**（`index.js` + `logo.svg`），入口 **`cb`** 绑定 IIFE 导出之 `tool`。
  - **toolId** 使用 **`hk_transport_assistant`**（下划线），避免主应用历史逻辑 `split('-')[1]` 截断。
  - 路网数据来自 **data.gov.hk** 官方 GeoJSON，经 `prepare-data.mjs` 紧凑化后 **打入插件 bundle**，运行时规划不依赖外网拉全量路网。
  - **站点匹配**以坐标邻近为主，不能仅依赖 `stopId`（跨运营公司同一物理站 ID 不同）。
  - **系统工具 SSE 返回值**：`@fastgpt-sdk/plugin` 的 `RunToolWithStream` 可能返回 **`{ output, error }` 信封**，也可能 **`data` 直接为工具体**；主应用须 **`parseSystemToolStreamResult`** 兼容，否则 `res.output || {}` 显示为空。

- 服务器 IP：156.225.30.134（宝塔面板）
- 项目目录：`/www/wwwroot/lugang-ai`
- 服务器上没有 git 仓库，部署方式是 GitHub Actions 构建镜像 → 服务器拉取镜像
- 前端镜像：`ghcr.io/taotie8304/lugang-ai:latest`
- 后端镜像：`ghcr.io/taotie8304/lugang-enterprise:latest`
- 后端容器不在 docker-compose.yml 中，需要用 `docker run` 单独部署
- 后端容器网络：`lugang-connect-enterprise_default`
- 详细部署命令见 `.kiro/steering/deploy-guide.md`

## 用户偏好与重要提醒

- 用户没有编程背景，解释技术问题时请用简单通俗的语言
- 始终用简体中文回复
- 绝不假装记得之前的对话内容，如果记忆文件为空则主动告知
- 代码注释使用 `// 鲁港通 - xxx` 格式
- `@fastgpt/*` 是代码依赖路径，不能修改
