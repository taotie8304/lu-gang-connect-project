# MTR 实时数据 + 步行路线扩展 — 开发任务

## 阶段一：MTR 实时 ETA 注入（核心）

- [x] **1.1 扩展 TransitCandidate 类型**（`types.ts`）
  - 新增 `stationCode?: string` 和 `mtrLine?: string` 字段
  - `dataSource` 联合类型扩展为 `'kmb' | 'ctb' | 'lwb' | 'nlb' | 'gmb' | 'mtr' | 'static'`
  - 文件：`hk-transport-plugin/src/types.ts`

- [x] **1.2 构建 MTR 站-线路映射表**（`planner.ts`）
  - 新增 `MTR_STATION_MAP` 常量（86 个客运站全映射）
  - 从 `transit.ts` 的 MTR 数据中提取：站名 → { line, stationCode }
  - 在 `recommendMTR()` 中调用，将映射结果回填到 `TransitCandidate.stationCode` 和 `mtrLine`
  - 文件：`hk-transport-plugin/src/planner.ts`

- [x] **1.3 MTR 实时 ETA 注入**（`fetcher.ts`）
  - 在 `enrichCandidateWithRealTimeETA()` 中添加 `mode === 'mtr'` 分支
  - 调用 `fetchMTRSchedule(candidate.mtrLine, candidate.stationCode)`
  - 解析 UP/DOWN 中最近列车时间 → `nextBusMinutes`
  - API 失败或数据为空时降级到 static（5 分钟）
  - KMB/LWB 和 CTB/NLB 的 `dataSource` 也细化为 `'lwb'` / `'nlb'`
  - 文件：`hk-transport-plugin/src/fetcher.ts`

- [x] **1.4 优化 MTR RouteStep 描述**（`integrator.ts`）
  - MTR 步骤描述改为"乘坐 港铁 {方向}方向列车（{n}站），下一班约 X 分钟后到达 🚇"
  - 与巴士/小巴的描述格式区分
  - 文件：`hk-transport-plugin/src/integrator.ts`

## 阶段二：步行距离精确化

- [x] **2.1 Haversine 校正系数**（`planner.ts`）
  - 新增 `WALK_DETOUR_FACTOR = 1.4` 常量
  - 在 `walkInMeters`/`walkOutMeters` 计算中应用校正
  - 步行距离为 0 时不应用系数
  - 评分公式同步使用校正后距离
  - 文件：`hk-transport-plugin/src/planner.ts`

- [x] **2.2 步行距离提示优化**（`integrator.ts`）
  - `generateTips()` 中步行距离 > 500m 提示已存在
  - 校正系数使触发条件更合理（500m 直线 → 700m 校正后 → 更易触发提示）
  - 文件：`hk-transport-plugin/src/integrator.ts`

## 阶段三：测试与打包

- [x] **3.1 新增 MTR 实时 ETA 测试**
  - 测试 MTR_STATION_MAP 覆盖全部 86 个客运站
  - 测试映射表格式正确（line=3字母代码, code=3字母代码）
  - 测试 TransitCandidate 类型兼容 stationCode/mtrLine
  - 测试 realTimeETA.dataSource 支持 'mtr'
  - 测试步行校正系数 1.4 计算正确
  - 文件：`hk-transport-plugin/test/mtr-eta.test.ts`（7 个测试）

- [x] **3.2 回归测试**
  - 全部 134 个测试通过（9 个测试文件）
  - 复合地名解析测试不受影响
  - 命令：`npm test`

- [x] **3.3 重新打包**
  - 执行 `node build.mjs` 生成新版 `.pkg`（625.6 KB）
  - 验证 `.pkg` 大小不超过 1MB

## 验收条件

1. MTR 路线在 `realTimeData.dataTimestamp` 中反映真实查询时间
2. MTR 路线的 `dataSource` 为 `'realtime'` 或 `'static'`（降级时）
3. 步行距离校正系数 1.4 在所有路线中生效
4. 所有 127+ 已有测试通过
