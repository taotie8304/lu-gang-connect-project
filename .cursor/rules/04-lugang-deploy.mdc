---
description: 鲁港通生产环境部署与容器管理规范
globs:
  - "deploy-guide.md"
  - "**/docker-compose.yml"
alwaysApply: false
---

# 部署环境摘要

- 服务器 IP：156.225.30.134（宝塔面板）。
- 项目目录：`/www/wwwroot/lugang-ai`。
- 前端域名：`www.airscend.com`，端口 3210。
- 后端域名：`api.airscend.com`，端口 8080。
- 服务器上没有 git 仓库，部署流程为：本地推代码到 GitHub → GitHub Actions 构建镜像 → 服务器拉取镜像并重启容器。

# 容器与服务命名

- 前端容器：`lugang-ai-app`，镜像：`ghcr.io/taotie8304/lugang-ai:latest`。
- 后端容器：`lugang-enterprise`，镜像：`ghcr.io/taotie8304/lugang-enterprise:latest`。
- **FastGPT 系统工具（插件服务）**：常见名 `lugang-ai-plugin`，镜像依仓库 compose（fastgpt-plugin）；主应用需 `PLUGIN_BASE_URL`、`PLUGIN_TOKEN`；插件 `.pkg` 上传常依赖 **MinIO**（S3 兼容）与反向代理 CORS。
- 其他依赖容器：Mongo、PostgreSQL(pgvector)、Redis、Minio、fastgpt-sandbox 等。

# 系统工具与主应用版本

- 若工作流调试中系统工具 **「工具运行结果」为空 `{}」**，在确认插件已返回 JSON 的前提下，检查 **lugang-ai 服务端**是否已包含 **`runTool.ts`** 中对 SSE 终包的 **`parseSystemToolStreamResult`**（无 `{ output }` 包裹时的兼容）。**仅更新前端静态资源不能修复**。
- 插件包更新：本地 `hk-transport-plugin` 执行 `node build.mjs` 后在 FastGPT 管理端覆盖上传 `.pkg`；细节见 `hk-transport-plugin/deploy.md`。

# 部署操作约定

- 更新前端：
  - 拉取新镜像 → 进入 `/www/wwwroot/lugang-ai` → `docker-compose up -d --force-recreate lugang-ai`。
- 更新后端：
  - 不能用 docker-compose。
  - 必须先 `docker stop lugang-enterprise && docker rm lugang-enterprise`。
  - 再用指定环境变量运行新的 `docker run ...` 命令。
- 没有测试环境，所有部署直接上生产，因此自动化脚本必须谨慎，优先保持与现有流程兼容。