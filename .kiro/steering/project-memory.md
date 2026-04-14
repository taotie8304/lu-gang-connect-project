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

## 服务器部署信息

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
