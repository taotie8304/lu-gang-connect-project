---
description: 香港智能交通助手插件（hk-transport-plugin）开发与联调约定
globs:
  - "hk-transport-plugin/**"
  - "hk-transport-apis-list.md"
alwaysApply: false
---

# 范围

- 目录：`hk-transport-plugin/`（FastGPT 系统工具，独立打包 `.pkg`）。
- 相关：`lugang-ai` 中 `dispatch/child/runTool.ts`（系统工具返回值解析）、`docker-compose` 中 `plugin` / MinIO / 环境变量。

# 必读文档

- 实现进度与文件索引：`hk-transport-plugin/DEVELOPMENT.md`
- 上传与验证步骤：`hk-transport-plugin/deploy.md`
- 根目录交接：`project-memory.md`、`session-handoff.md`

# 硬约束（易踩坑）

1. **`PKG_NAME`**：`hk_transport_assistant`（下划线）；不要用带连字符的 toolId，除非主应用已修复 `split('-')[1]` 截断问题。
2. **`.pkg`**：ZIP，内含 `index.js` + `logo.svg`；`tool` 须能被 `build.mjs` 绑定到 `module.exports.cb`（推荐 IIFE + `__hkPlugin`）。
3. **静态数据**：大流量官方数据经 `prepare-data.mjs` 生成 `src/data/transit.ts` 再随包发布；规划逻辑见 `planner.ts`，**按坐标匹配**路线站点，不要仅按 `stopId` 做跨公司直连。
4. **主应用与插件包都要更新**：若调试里「工具运行结果」恒为 `{}`，除检查插件服务外，须确认主应用已包含 **`parseSystemToolStreamResult`**（无 `output` 包裹的 SSE 终包兼容）——见 `DEVELOPMENT.md` / `project-memory.md`。

# 变更后检查

- 修改 `src/` 或数据脚本后：`node build.mjs`，在 FastGPT 中覆盖上传 `.pkg`。
- 修改 `runTool.ts` 后：重新构建 **lugang-ai** 镜像并部署（非仅前端静态资源）。
