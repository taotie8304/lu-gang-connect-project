# MTR 实时数据 + 步行路线扩展

## 简介

当前香港交通插件的实时 ETA 数据注入仅覆盖巴士（KMB/CTB/LWB/NLB），MTR/小巴/电车/渡轮的候选路线统一降级到静态估算（固定 5 分钟等待时间）。步行距离使用球面直线距离（Haversine），而非实际道路网络距离，导致总时长估算偏差较大。

本次扩展目标是：让 MTR 候选路线也能使用香港政府的实时 MTR 列车 API，同时引入更精确的步行距离计算，使推荐路线的总时长估算更接近真实情况。

## 用户故事

- 作为鲁港通用户，我希望查询"从中环到铜锣湾"时，插件能告诉我**下一班港铁列车还有几分钟到站**，而不是固定的 5 分钟估算。
- 作为鲁港通用户，我希望插件能把**步行到站的实际距离**计算得更准确（如通过天桥、地下通道等），而不是粗略的直线距离。
- 作为鲁港通用户，我希望路线对比中 MTR 方案能基于**真实实时数据**与巴士方案竞争，而不是因为静态估算在排序中吃亏。

## 需求列表

1. **MTR 实时 ETA 注入**：在 `enrichCandidateWithRealTimeETA()` 中增加 MTR 分支，调用 `fetchMTRSchedule()` 获取实时列车到站时间
2. **MTR 站-线路映射**：建立从 `TransitCandidate` 的 MTR 站点名到 MTR API 所需 `line` + `sta` 参数的映射表
3. **步行距离精确化**：将 Haversine 直线距离替换为基于 OSRM 步行路由引擎的实际道路距离
4. **OSRM 步行路由引擎接入**：搭建本地 OSRM 服务或使用公开 OSRM 实例，提供步行距离查询
5. **支路步行搜索**：扩展站点搜索半径内的步行路径，考虑人行天桥、地下通道等路径

## 接受标准（EARS）

### MTR 实时 ETA
- WHEN MTR 候选路线数量 > 0，THEN `enrichCandidateWithRealTimeETA()` SHALL 为每条 MTR 路线调用 `fetchMTRSchedule()`。
- WHEN `fetchMTRSchedule()` 返回成功，THEN MTR 路线的 `dataSource` SHALL 为 `'realtime'`，`nextBusMinutes` SHALL 为从 `curr_time` 到 `time` 的分钟差。
- WHEN `fetchMTRSchedule()` 调用失败，THEN SHALL 降级到静态估算（5 分钟等待），`dataSource` SHALL 为 `'static'`。
- WHEN MTR 实时数据可用，THEN 排序结果 SHALL 基于实时总时长而非静态估算。

### 步行距离精确化
- WHEN 起终点坐标存在，THEN `walkInMeters` 和 `walkOutMeters` SHALL 优先使用 OSRM 步行路由实际距离。
- WHEN OSRM 服务不可用，THEN SHALL 降级到当前 Haversine 球面距离（系数 1.4 校正）。
- WHEN 实际步行距离 > Haversine 直线距离 × 1.5 倍，THEN 输出 `tips` SHALL 包含"步行路线包含天桥/地下通道"提示。

### 整体约束
- IF 新增外部依赖（如 OSRM），THEN SHALL 不超过 1 个依赖包。
- IF `.pkg` 大小超过 700KB，THEN SHALL 给出警告（上限 1MB）。
- 所有现有 127 个测试 SHALL 保持通过。
