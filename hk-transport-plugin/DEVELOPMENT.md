# 香港智能交通助手（hk-transport-plugin）— 开发进度与实现说明

> 与根目录 `project-memory.md`、`session-handoff.md` 同步摘要；技术细节以本文为准。  
> 最后更新：2026-05-03

## 目标

在 FastGPT 中以**系统工具**形式提供香港多模式公共交通规划（巴士 / 小巴 / 港铁 / 渡轮 / 电车 / 山顶缆车等），并在鲁港通工作流中可被「工具调用」节点引用。

## 当前状态：已完成（可上线验证）

### 打包与 FastGPT 契约

- **`.pkg` 格式**：ZIP（含 `index.js` + `logo.svg`），不是裸 JS；由 `build.mjs` 用 JSZip 生成。
- **模块格式**：esbuild 输出 **IIFE**（`globalName: __hkPlugin`），再在 `build.mjs` 末尾绑定 `module.exports.cb = __hkPlugin.tool`，避免 CJS re-export 导致 `tool` 被 tree-shake。
- **toolId**：`build.mjs` 中 `PKG_NAME` 必须为 **`hk_transport_assistant`**（下划线、无连字符）。主应用 `runTool.ts` 曾用 `tool.id.split('-')[1]` 截断带连字符的 ID，会导致插件服务收到错误 `toolId`。
- **元数据**：`toolDescription` 须为**字符串**（非对象），否则 Zod 解析失败。

### 数据源与规划器

- **`scripts/prepare-data.mjs`**：从 data.gov.hk 拉取 `JSON_BUS` / `JSON_GMB` / `JSON_TRAM` / `JSON_FERRY` / `JSON_PTRAM`，紧凑化写入 **`src/data/transit.ts`**（提交仓库或由 CI 生成）。打包后约 **0.6MB .pkg**（压缩后）。
- **`src/planner.ts`**：构建全模式 `routeStopPoints` 索引；**按坐标邻近匹配**站点（避免仅用 `stopId` 漏掉不同公司同一物理站）；搜索半径 **1200m**；支持直达方案 + MTR 近似推荐；评分融合 mode 权重与步行距离。
- **`src/parser.ts`**：支持 **「A 到 B」**（无「从」字）等问法，避免只解析出终点。
- **`src/index.ts`**：`transit-planner` 优先；无结果时 TDAS 驾车为降级参考；`metadata.apisCalled` / `apiStatus` 可观测。

### 与主应用（lugang-ai）联调

- 系统工具经 **`PLUGIN_BASE_URL` + `PLUGIN_TOKEN`** 调用独立 **fastgpt-plugin** 容器（如 `lugang-ai-plugin`）；主应用侧为 `APIRunSystemTool` / `RunToolWithStream`。
- **已知问题（已修）**：部分插件服务版本 SSE 终包 `data` **直接等于工具返回值**，无 `{ output: ... }` 包裹。主应用若写 `res.output || {}` 会得到 **`{}`**，调试面板「工具运行结果」为空。  
  **修复文件**：`lugang-ai/packages/service/core/workflow/dispatch/child/runTool.ts` — `parseSystemToolStreamResult` + `isSystemToolEnvelopeError`。  
  **部署**：需**重新构建并部署 lugang-ai 镜像**（含服务端），**非**单独前端静态资源。

## 待办 / 后续迭代

| 项 | 说明 |
|----|------|
| Phase 2 ETA | KMB / CTB 实时到站与 `boardStopId`（政府数据 `stopId` 与 ETA API 字段对齐） |
| 换乘规划 | 无直达时自动出一程换乘（落马洲→机场等） |
| 地理编码 | 扩充 `geocoder.ts` 词典或对接在线地理编码，减少「未知地点」 |
| 服务器临时脚本 | 仓库中曾用 `ssh_verify_*.py` 等仅作调试用，不应提交敏感信息；可删或改为环境变量读入 |

## 关键文件索引

| 路径 | 作用 |
|------|------|
| `build.mjs` | IIFE 打包、`PKG_NAME`、JSZip 生成 `.pkg` |
| `scripts/prepare-data.mjs` | 官方 GeoJSON → `src/data/transit.ts` |
| `src/planner.ts` | 多模式直达规划 |
| `src/index.ts` | `InputType` / `OutputType` / `tool` |
| `src/parser.ts` | 自然语言起终点 |
| `deploy.md` | 打包与上传 FastGPT 步骤 |

## 验证清单（手工）

1. `node scripts/prepare-data.mjs`（若 `transit.ts` 缺失或需更新）  
2. `node build.mjs` → `dist/hk_transport_assistant.pkg`  
3. FastGPT root：系统插件上传/覆盖安装该 `.pkg`  
4. 工作流：工具调用绑定该工具；问句如「从中环到尖沙咀怎么走」「旺角到铜锣湾」  
5. **确认主应用已部署含 `runTool.ts` 修复的镜像**，否则界面可能仍显示 `{}`
