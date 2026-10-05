# 政府官网联网搜索 · FastGPT 系统插件（hk_gov_websearch）

为 FastGPT 工作流提供「只检索香港权威官网来源」的联网搜索能力：输入查询词 → 调用免费的
DuckDuckGo → **默认拒绝未知来源**，仅保留政府 / 公营机构 / 学术机构 / 非盈利团体 / 正规新闻媒体 /
电视台，并硬拒绝社交媒体与营销平台，输出结构化来源列表，供上层 AI 节点做「知识库 + 最新官网信息」融合。

- 插件 ID：`hk_gov_websearch`（下划线，发布后保持稳定）
- 运行时：Node.js 18+（使用原生 `fetch`，无需任何 API Key）
- 语言：TypeScript strict（无 `any`）
- 搜索源：DuckDuckGo（`html.duckduckgo.com` 主接口 + `lite.duckduckgo.com` 降级），抽象为可插拔的 `SearchProvider`

## 两种搜索范围

| 入参 `searchScope` | 行为 | 适用节点 |
|---|---|---|
| `official`（默认） | 社交媒体/营销平台硬拒绝；仅白名单 A–F 放行；**其余未知域名默认拒绝** | 所有政策/民生/金融/经贸/教育节点 |
| `open` | **完全不过滤**（白名单、黑名单都不生效），全部放行 | 仅「香港本地生活小助手」节点（休闲类：美食/景点/交通） |

来源分类 `sourceType`：`gov` / `public` / `academic` / `nonprofit` / `news` / `tv` / `other`。
域名清单见 `src/whitelist.ts`，匹配算法见 `src/domain-filter.ts`（主机名去 `www.`、转小写后做
`host === domain || host.endsWith('.' + domain)` 后缀匹配）。

## 目录结构

```
lugang-gov-websearch-plugin/
├── index.ts                 # SDK 封装层：defineTool + createToolHandler + manifest（剔除 _debug）
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── logo.svg
├── src/
│   ├── index.ts             # 业务层：InputType/OutputType/tool 主函数
│   ├── types.ts             # 内部类型
│   ├── whitelist.ts         # 白名单/黑名单域名清单（核心，可扩充）
│   ├── domain-filter.ts     # 域名过滤算法（核心，默认拒绝）
│   └── search-provider.ts   # 搜索源接口 + DuckDuckGo 实现（含 uddg 真实链接解码）
└── test/                    # vitest 单测与集成测试（mock，不联网）
```

## 安装 / 测试 / 构建 / 打包

```bash
pnpm install

pnpm test            # 单元 + 集成测试（应全部通过）
pnpm exec tsc --noEmit   # 严格类型检查（可选，零错误）

pnpm build           # 构建到 dist/（index.js + manifest.json + logo.svg）
pnpm check           # 校验构建产物格式
pnpm pack            # 产出可上传的 .pkg
```

打包产物 `.pkg` 为 ZIP 包，由 `@fastgpt-plugin/cli pack` 生成，请勿手动改压缩结构。

## 本地一次性调试（不接入 FastGPT 页面）

```bash
# 查看插件与工具信息
npx @fastgpt-plugin/cli debug .
# 直接跑一次（真实联网，DuckDuckGo 可能因数据中心 IP 触发反爬，属预期，已做 lite 降级）
npx @fastgpt-plugin/cli debug . --run --input '{"query":"强积金提取条件"}'
# open 模式示例
npx @fastgpt-plugin/cli debug . --run --input '{"query":"維港美食","searchScope":"open"}'
```

## 输入 / 输出

输入：`query`（必填）、`searchScope`（默认 `official`）、`maxResults`（默认 5，1–10）、
`language`（`zh-CN` 默认 / `zh-HK` / `en`）。

输出：`results[]`（`title/url/source/sourceType/snippet`，可选 `publishedDate`）、`resultCount`、
`filteredOut`、`query`、`searchScope`、`metadata{timestamp,engine,rawCount}`、可选 `error`。
内部诊断字段 `_debug` 仅存在于业务层，SDK 封装层返回前会被剔除，不外传给模型。

## 关键设计与红线

1. **默认拒绝**：official 模式下只有白名单命中才放行，不是「黑名单没命中就放行」。
2. **社交媒体一律拒绝**（official）：即使是官方媒体账号也不返回；open 模式才放行。
3. **DuckDuckGo 跳转链接必须先解码**（`uddg=` 参数，见 `resolveDDGUrl`），否则过滤的是
   `duckduckgo.com` 而非真实来源。
4. **所有 fetch 带 AbortController 超时**（12s），并有主接口 → lite 接口两级降级，避免拖垮工作流。
5. 空结果 / 上游失败均返回**可操作中文说明**，并在 `toolDescription` 中明确要求模型不要重复调用。

## 扩充权威来源

只改 `src/whitelist.ts`：政府后缀加 `GOV_SUFFIXES`，公营机构加 `PUBLIC_BODIES`，
大学加 `UNIVERSITIES`，媒体加 `NEWS_MEDIA`，电视台加 `TV_STATIONS`；新增营销/社交黑名单同理。
改动后运行 `pnpm test` 并按需在 `test/domain-filter.test.ts` 补用例。

## License

MIT
