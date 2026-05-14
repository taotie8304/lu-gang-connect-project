# MTR 实时数据 + 步行路线扩展 — 技术设计

## 总体设计

### 数据流（改动后）

```
用户问题 → parseQuestion() → geocodeRoute() → planPublicTransit()
                                                      ↓
                                          TransitCandidate[] (含 MTR/GMB/TRAM)
                                                      ↓
                              enrichCandidatesWithRealTimeETA()
                                 /           |           \
                            KMB分支    MTR分支(新增)   CTB分支 ...
                                 ↓           ↓           ↓
                          fetchKMB   fetchMTRSchedule  fetchCTB
                            ETA        (新增调用)       ETA
                                 \           |           /
                                  realTimeETA 注入排序
```

### 关键变更点

1. **MTR 实时 ETA 注入**：在 `fetcher.ts` 的 `enrichCandidateWithRealTimeETA()` 中添加 `mode === 'mtr'` 分支
2. **MTR 映射表**：在 `planner.ts` 中建立 `buildMTRStationMap()`，从 `transit.ts` 的 MTR 数据中提取 `站名 → { line, stationCode }` 映射
3. **步行距离校正**：在 `planner.ts` 的 `walkInMeters`/`walkOutMeters` 计算中增加 Haversine × 1.4 校正系数
4. **OSRM 步行路由**：新建 `src/walk-router.ts`，对接 OSRM 步行 API（可选，作为精度提升）

## 影响范围

### 前端文件列表
- 无（本次改动全部在 hk-transport-plugin 内部）

### 后端文件列表
- `hk-transport-plugin/src/fetcher.ts`：扩展 `enrichCandidateWithRealTimeETA()`，增加 MTR 实时 ETA 分支
- `hk-transport-plugin/src/planner.ts`：新增 `buildMTRStationMap()` 函数，建立 MTR 站名到 API 参数的映射
- `hk-transport-plugin/src/integrator.ts`：MTR RouteStep 描述中增加列车间隔信息
- `hk-transport-plugin/src/types.ts`：扩展 `TransitCandidate`，增加 `stationCode` 可选字段
- `hk-transport-plugin/src/index.ts`：无需修改（MTR 注入链路已就绪）
- `hk-transport-plugin/build.mjs`：无需修改
- `hk-transport-plugin/src/walk-router.ts`（新建）：步行路由引擎（可选 Phase）

### 数据库表/集合变更
- 无

## 接口设计

### MTR 实时数据获取

已有的 `fetchMTRSchedule(line, sta)` 函数签名不变，新增调用方式：

**参数来源**：从 `TransitCandidate` 新增字段 `stationCode` 和 `mtrLine` 获取

```typescript
// 新增字段（types.ts）
interface TransitCandidate {
  // ... 现有字段
  stationCode?: string;  // MTR 车站代码，如 "HUH"（红磡）
  mtrLine?: string;      // MTR 线路代码，如 "EAL"（东铁线）
}
```

**调用流程**：
```
enrichCandidateWithRealTimeETA(candidate)
  ↓ mode === 'mtr' && candidate.stationCode && candidate.mtrLine?
  ↓ YES → fetchMTRSchedule(candidate.mtrLine, candidate.stationCode)
  ↓        ↓ 成功 → 从 UP/DOWN 中取第一条 trainInfo.time → nextBusMinutes
  ↓        ↓ 失败 → 降级 static (5分钟)
  ↓ NO → 降级 static (5分钟)
```

**MTR API 响应解析**：
```typescript
// MTRScheduleResponse.data[stationCode].UP[0].time → "2026-05-08 18:52:00"
// nextBusMinutes = (new Date(time) - new Date()) / 60000
```

### MTR 站-线路映射表

```typescript
// 从 transit.ts 的 MTR routeStops 数据中自动构建
// 格式：{ "红磡": { line: "EAL", code: "HUH" }, "旺角东": { line: "EAL", code: "MKK" }, ... }
function buildMTRStationMap(): Map<string, { line: string; code: string }>
```

### 步行距离校正

第一阶段不使用 OSRM（避免增加外部依赖），改用校正系数：

```typescript
// planner.ts
const WALK_DETOUR_FACTOR = 1.4;  // 城市步行实际距离通常为直线距离的 1.3-1.5 倍
walkInMeters = Math.ceil(haversineDistanceM(originLat, originLng, stopLat, stopLng) * WALK_DETOUR_FACTOR);
```

## 边界情况

1. **MTR 站名无法映射**：如 `TransitCandidate` 的站名在映射表中找不到 → 降级 static
2. **MTR API 返回空数据**：UP/DOWN 数组为空 → 降级 static
3. **MTR 站有两个方向**：取 UP 和 DOWN 中最接近当前时间的列车 → 取 min(UP[0], DOWN[0])
4. **MTR 站名多线路**：一个站可能对应多条线路（如"九龙塘"→ TWL + EAL），取优先线路
5. **步行距离为 0**：起点就在站内 → walkInMeters = 0，不应用校正系数
6. **OSRM 不可用**：降级到 Haversine × 1.4 校正系数

## 与现有架构的兼容性

- 不修改 `@fastgpt/*` 导入路径
- MTR 实时数据注入复用现有的 `enrichCandidatesWithRealTimeETA` 框架
- 向后兼容：MTR 映射失败时自动降级，不影响现有巴士实时 ETA 功能
- `.pkg` 大小影响：映射表数据量小（~100 条 MTR 站），增量 < 5KB
