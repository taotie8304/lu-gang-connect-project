# 香港智能交通助手 - 部署指南

> 详细开发进度见同目录 `DEVELOPMENT.md`。

## 环境准备

- **静态路网数据**（首次或需更新政府数据时）：
  ```bash
  node scripts/prepare-data.mjs
  ```
  生成 `src/data/transit.ts`（体积约数 MB，已纳入 bundle）。

## 打包

```bash
# 推荐：Node 执行 build.mjs（根目录）
node build.mjs
```

打包成功后输出：

- **`dist/hk_transport_assistant.pkg`** — 上传 FastGPT 的插件包（ZIP，内含 `index.js`、`logo.svg`）

> 旧文档中的 `hk-transport-assistant.pkg` 已更名；**toolId 与文件名**与 `build.mjs` 中 `PKG_NAME` 一致。

## 上传到 FastGPT

1. 使用 root 登录 FastGPT 管理端（如 https://www.airscend.com）
2. **配置 → 系统插件 → 导入/更新**
3. 上传 **`dist/hk_transport_assistant.pkg`**
4. 等待插件服务热加载（数秒级）
5. 确认列表中出现「香港智能交通助手」，且工具 ID 与主应用侧配置一致

## 主应用（lugang-ai）依赖

- 需配置 **`PLUGIN_BASE_URL`、`PLUGIN_TOKEN`**（及插件容器、MinIO/S3 等），否则系统工具不可用。
- 若工作流调试中 **「工具运行结果」为空对象 `{}」** 但插件日志正常：请部署包含 **`runTool.ts` 中 `parseSystemToolStreamResult`** 的 **lugang-ai 服务端镜像**（见 `DEVELOPMENT.md`），**仅更新前端静态资源无法修复**。

## 验证用例

1. 工作流中添加「工具调用」节点，选择本插件  
2. 输入示例：
   - `从中环到尖沙咀怎么走`
   - `旺角到铜锣湾`
   - `从落马洲口岸到香港立法会怎么走`
3. 期望：`routes`、`paymentInfo`、`tips`、`metadata` 等字段非空；`metadata.apiStatus` 含 `transit-planner` 等

## 文件说明

| 文件/目录 | 说明 |
|-----------|------|
| `dist/hk_transport_assistant.pkg` | 上传用插件包 |
| `build.mjs` | esbuild IIFE + JSZip 打包 |
| `scripts/prepare-data.mjs` | 官方 GeoJSON → `src/data/transit.ts` |
| `DEVELOPMENT.md` | 实现进度与关键约定 |
