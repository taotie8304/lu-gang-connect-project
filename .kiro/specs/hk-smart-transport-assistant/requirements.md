# 需求文档：香港智能交通助手

## 简介

为鲁港通 AI 平台开发一个智能交通助手工具，功能对标港话通 App 的交通路线查询模块。系统能根据用户的自然语言问题（如"湾城到镇门怎么坐车"），调用香港政府公开交通 API，返回：
- 多条路线方案（含预计时间、步行距离、换乘步骤）
- 每条路线中各巴士站的实时到站时间（ETA）
- 路线筛选（可按路线号过滤）
- 付款方式和费用信息
- 实用出行建议

**重要技术约束**：

1. **API 地址转换规则**：香港政府公开数据集中的 API 地址分为三类：
   - **运营商专用 API**（可直接调用）：如 `data.etabus.gov.hk`（KMB）、`data.etagmb.gov.hk`（GMB）、`rt.data.gov.hk`（CTB/NLB/MTR）
   - **静态数据文件**（JSON/CSV，可直接下载）：如 `static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json`
   - **CKAN 元数据 API**（需要转换）：通过 `https://data.gov.hk/sc-data/api/3/action/package_show?id=[dataset_id]` 获取数据集元数据，从返回的 `resources` 中提取实际数据 URL。参考官方指南：https://data.gov.hk/sc/help/ckan-api-development-guide

2. **FastGPT 系统插件开发规范**：本工具必须按照 FastGPT 官方插件开发规范开发：
   - 技术栈：Bun + TypeScript + Zod
   - 项目结构：基于 `fastgpt-plugin` 项目
   - 打包方式：`bun run build:pkg` 编译为单一 `.pkg` 文件
   - 部署方式：root 用户通过 FastGPT Web 界面上传 `.pkg` 文件（支持热插拔）
   - 参考文档：
     - 系统插件设计：https://doc.fastgpt.cn/zh-CN/docs/self-host/design/design_plugin
     - 在线上传指南：https://doc.fastgpt.cn/zh-CN/docs/introduction/guide/plugins/upload_system_tool

3. **路径规划 API**：运输署 TDAS API `https://tdas-api.hkemobility.gov.hk/tdas/api/route`

## 术语表

- **智能交通助手**：单一 HTTP 工具入口，根据用户问题智能路由到多个交通 API
- **ETA**：Estimated Time of Arrival，预计到站时间
- **路线方案**：从起点到终点的完整出行方案，包含所有换乘步骤
- **巴士站 ETA**：某巴士站即将到达的所有路线及其预计到站时间列表
- **路线筛选**：在巴士站 ETA 列表中按路线号过滤，只显示特定路线
- **KMB**：九龙巴士及龙运巴士（`data.etabus.gov.hk`）
- **GMB**：专线小巴（`data.etagmb.gov.hk`）
- **CTB**：城巴（`rt.data.gov.hk/v2/transport/citybus`）
- **NLB**：新大屿山巴士（`rt.data.gov.hk/v2/transport/nlb`）
- **MTR**：港铁（`rt.data.gov.hk/v1/transport/mtr`）
- **TDAS**：运输署交通数据分析系统，提供路径规划 API
- **CKAN**：开放数据平台后端软件，提供元数据 API（`data.gov.hk/sc-data/api/3/action/...`）
- **FastGPT 系统插件**：基于 fastgpt-plugin 项目开发的 .pkg 工具包，支持热插拔上传
- **八达通**：香港通用交通支付卡

## 需求

### 需求 1：用户问题解析

**用户故事**：作为用户，我想用自然语言提问交通问题，系统能理解我的起点、终点和需求。

#### 验收标准

1. WHEN 用户输入包含地点名称 THEN THE 系统 SHALL 识别起点和终点
2. WHEN 用户提到交通方式偏好（如"坐巴士"、"地铁"）THEN THE 系统 SHALL 记录偏好
3. WHEN 用户询问时间（如"现在"、"明天早上"）THEN THE 系统 SHALL 记录时间需求
4. THE 系统 SHALL 支持繁体中文、简体中文、英文输入
5. THE 系统 SHALL 处理模糊地点名称（如"立法会"、"落马洲口岸"）

### 需求 2：路径规划（TDAS API）

**用户故事**：作为用户，我想获得从起点到终点的多条完整路线方案，就像港话通显示的"48分钟 路线1"和"52分钟 路线2"那样。

#### 验收标准

1. THE 系统 SHALL 调用运输署 TDAS 路径规划 API（`https://tdas-api.hkemobility.gov.hk/tdas/api/route`）
2. THE 系统 SHALL 提供至少 2-3 种不同的路线方案
3. THE 每条路线方案 SHALL 包含预计总时间（分钟）、总距离（公里）
4. THE 每条路线方案 SHALL 包含详细换乘步骤（起点站、终点站、路线号、步行距离）
5. WHEN 有直达路线 THEN THE 系统 SHALL 优先推荐直达方案
6. WHEN 需要换乘 THEN THE 系统 SHALL 提供详细的换乘步骤和换乘地点
7. THE 系统 SHALL 支持指定过海隧道偏好（红隧/东隧/西隧）

### 需求 3：巴士站实时到站时间查询（按站点）

**用户故事**：作为用户，我想查看某个巴士站即将到达的所有路线和实时到站时间，就像港话通"巴士到站时间"页面显示的那样。

#### 验收标准

1. WHEN 查询特定巴士站 THEN THE 系统 SHALL 返回该站所有路线的实时 ETA 列表
2. THE 返回数据 SHALL 包含路线号、目的地、预计到站时间（分钟数）、下一班时间
3. THE 系统 SHALL 同时查询 KMB 和 CTB 在同一站点的 ETA（如港话通显示 YT205 站的多条路线）
4. THE 系统 SHALL 标注数据更新时间（每 2 分钟更新）
5. THE 系统 SHALL 支持手动刷新获取最新 ETA 数据

### 需求 4：路线筛选功能

**用户故事**：作为用户，我想在巴士站 ETA 列表中搜索特定路线号（如"215X"），只显示该路线的信息，过滤掉其他路线。

#### 验收标准

1. WHEN 用户输入路线号 THEN THE 系统 SHALL 只返回该路线在各站点的 ETA 信息
2. THE 系统 SHALL 支持模糊匹配路线号（如输入"215"可匹配"215X"、"215P"）
3. WHEN 路线号不存在 THEN THE 系统 SHALL 返回空结果并提示
4. THE 系统 SHALL 支持同时显示多个运营商（KMB、CTB）的同一路线号

### 需求 5：KMB 实时到站时间

**用户故事**：作为用户，我想知道九龙巴士的实时到站时间。

#### 验收标准

1. THE 系统 SHALL 调用 KMB stop-eta API（`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/{stop_id}`）
2. THE 系统 SHALL 调用 KMB route-eta API（`https://data.etabus.gov.hk/v1/transport/kmb/route-eta/{route}/{service_type}`）
3. THE 返回数据 SHALL 包含路线号、目的地（繁体中文/英文）、预计到达时间（ISO 8601）、剩余站数
4. THE 系统 SHALL 处理 KMB 路线的 service_type 参数（通常为 1）
5. THE 系统 SHALL 处理 KMB 路线的方向参数（O=去程/I=回程）

### 需求 6：CTB 实时到站时间

**用户故事**：作为用户，我想知道城巴的实时到站时间。

#### 验收标准

1. THE 系统 SHALL 调用 CTB stop-eta API（`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/{stop_id}/{route}`）
2. THE 返回数据 SHALL 包含路线号、目的地、预计到达时间
3. THE 系统 SHALL 使用 company_id "CTB"（原新巴路线已并入城巴）
4. THE 系统 SHALL 处理跨海路线和港岛路线

### 需求 7：GMB 实时到站时间

**用户故事**：作为用户，我想知道专线小巴的实时到站时间。

#### 验收标准

1. THE 系统 SHALL 调用 GMB stop-eta API（`https://data.etagmb.gov.hk/eta/stop/{stop_id}`）
2. THE 系统 SHALL 支持香港岛（HKI）、九龙（KLN）、新界（NT）三个区域
3. THE 返回数据 SHALL 包含路线号、目的地、预计到站时间
4. THE 系统 SHALL 处理小巴路线代码（如 "1", "1A", "1S"）

### 需求 8：MTR 实时服务状态

**用户故事**：作为用户，我想知道港铁的实时服务状态和列车时间。

#### 验收标准

1. THE 系统 SHALL 调用 MTR 实时列车服务 API（`https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php`）
2. THE 返回数据 SHALL 包含各条线路的服务状态（正常/延误/暂停）
3. WHEN 有服务延误 THEN THE 系统 SHALL 提供延误原因和预计恢复时间
4. THE 系统 SHALL 提供列车班次间隔时间

### 需求 9：NLB 实时到站时间

**用户故事**：作为用户，我想知道新大屿山巴士的实时到站时间。

#### 验收标准

1. THE 系统 SHALL 调用 NLB 预计抵站时间 API（`https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=estimatedArrivals&routeId={routeId}&stopId={stopId}&language={lang}`）
2. THE 系统 SHALL 支持查询往返大屿山的所有路线
3. THE 返回数据 SHALL 包含路线号、目的地、预计抵站时间
4. THE 系统 SHALL 支持繁体中文（zh）、简体中文（sc）、英文（en）三种语言参数

### 需求 10：路线和站点静态数据

**用户故事**：作为系统，我需要路线和站点的静态数据来支持路线规划和 ETA 查询。

#### 验收标准

1. THE 系统 SHALL 获取 KMB 路线列表（`https://data.etabus.gov.hk/v1/transport/kmb/route/`）
2. THE 系统 SHALL 获取 KMB 路线-站点数据（`https://data.etabus.gov.hk/v1/transport/kmb/route-stop/{route}/{direction}/{service_type}`）
3. THE 系统 SHALL 获取 CTB 路线列表（`https://rt.data.gov.hk/v2/transport/citybus/route/CTB`）
4. THE 系统 SHALL 获取 CTB 路线-站点数据（`https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/{route}/{direction}`）
5. THE 系统 SHALL 缓存静态数据以减少 API 调用次数（TTL 24 小时）

### 需求 11：付款方式和费用信息

**用户故事**：作为用户，我想知道如何付款和大概费用，特别是作为游客或新来港人士。

#### 验收标准

1. THE 系统 SHALL 提供每种交通工具的付款方式（八达通、现金、信用卡）
2. THE 系统 SHALL 从路线收费数据中提取预计费用（`https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json`）
3. THE 系统 SHALL 说明哪些交通工具接受现金、哪些只接受八达通
4. THE 系统 SHALL 提供优惠信息（如长者优惠、学生优惠）

### 需求 12：注意事项和实用建议

**用户故事**：作为用户，我想获得实用的出行建议和注意事项。

#### 验收标准

1. THE 系统 SHALL 提供高峰时段提示（早上 07:00-09:30，下午 17:00-19:30）
2. WHEN 路线涉及口岸 THEN THE 系统 SHALL 提示通关时间和证件要求
3. WHEN 路线涉及步行超过 500 米 THEN THE 系统 SHALL 提示步行距离和所需时间
4. THE 系统 SHALL 提供无障碍设施信息（如有轮椅通道的车站）

### 需求 13：错误处理和降级

**用户故事**：作为用户，当部分 API 不可用时，我仍然希望获得尽可能多的有用信息。

#### 验收标准

1. WHEN API 调用超时（超过 10 秒）THEN THE 系统 SHALL 返回超时错误信息并继续处理其他 API
2. WHEN 部分 API 失败 THEN THE 系统 SHALL 使用成功的 API 数据继续生成路线建议
3. WHEN 无法识别起点或终点 THEN THE 系统 SHALL 返回明确的错误提示
4. WHEN 没有找到路线 THEN THE 系统 SHALL 返回"未找到路线"提示
5. THE 系统 SHALL 在响应中标注哪些数据源成功、哪些失败



## 附录：完整 API 地址列表

### 一、运营商专用 API（可直接调用）

#### KMB 九龙巴士及龙运巴士
| 名称 | URL |
|------|-----|
| 路线列表 | `https://data.etabus.gov.hk/v1/transport/kmb/route/` |
| 路线数据 | `https://data.etabus.gov.hk/v1/transport/kmb/route/{route}/{direction}/{service_type}` |
| 巴士站列表 | `https://data.etabus.gov.hk/v1/transport/kmb/stop` |
| 巴士站数据 | `https://data.etabus.gov.hk/v1/transport/kmb/stop/{stop_id}` |
| 路线-巴士站列表 | `https://data.etabus.gov.hk/v1/transport/kmb/route-stop` |
| 路线-巴士站数据 | `https://data.etabus.gov.hk/v1/transport/kmb/route-stop/{route}/{direction}/{service_type}` |
| ETA（站+路线） | `https://data.etabus.gov.hk/v1/transport/kmb/eta/{stop_id}/{route}/{service_type}` |
| ETA（按站点） | `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/{stop_id}` |
| ETA（按路线） | `https://data.etabus.gov.hk/v1/transport/kmb/route-eta/{route}/{service_type}` |

#### GMB 专线小巴
| 名称 | URL |
|------|-----|
| 路线列表 | `https://data.etagmb.gov.hk/route/{region}` (region: HKI/KLN/NT) |
| 路线资料 | `https://data.etagmb.gov.hk/route/{region}/{route_code}` |
| 站资料 | `https://data.etagmb.gov.hk/stop/{stop_id}` |
| 路线的站资料 | `https://data.etagmb.gov.hk/route-stop/{route_id}/{route_seq}` |
| 站的路线资料 | `https://data.etagmb.gov.hk/stop-route/{stop_id}` |
| ETA（按站点） | `https://data.etagmb.gov.hk/eta/stop/{stop_id}` |
| 最后更新时间 | `https://data.etagmb.gov.hk/last-update/` |

#### CTB 城巴
| 名称 | URL |
|------|-----|
| 公司数据 | `https://rt.data.gov.hk/v2/transport/citybus/company/ctb` |
| 路线数据 | `https://rt.data.gov.hk/v2/transport/citybus/route/ctb` |
| 巴士站数据 | `https://rt.data.gov.hk/v2/transport/citybus/stop` |
| 路线的巴士站 | `https://rt.data.gov.hk/v2/transport/citybus/route-stop/ctb` |
| ETA | `https://rt.data.gov.hk/v2/transport/citybus/eta/ctb` |

#### NLB 新大屿山巴士
| 名称 | URL |
|------|-----|
| 路线列表 | `https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list` |
| 路线的车站 | `https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId={routeId}` |
| ETA | `https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=estimatedArrivals&routeId={routeId}&stopId={stopId}&language={languageCode}` |

#### MTR 港铁
| 名称 | URL |
|------|-----|
| 实时列车服务 | `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php` |
| 港铁巴士到站 | `https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule` |

#### TDAS 运输署路径规划
| 名称 | URL | 方法 |
|------|-----|------|
| 路径规划 | `https://tdas-api.hkemobility.gov.hk/tdas/api/route` | POST |

### 二、静态数据文件（JSON/CSV，可直接下载）

| 名称 | URL |
|------|-----|
| 巴士路线收费（GeoJSON） | `https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json` |
| 小巴路线收费（GeoJSON） | `https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json` |
| 渡轮航线收费（GeoJSON） | `https://static.data.gov.hk/td/routes-fares-geojson/JSON_FERRY.json` |
| 山顶缆车收费（GeoJSON） | `https://static.data.gov.hk/td/routes-fares-geojson/JSON_PTRAM.json` |
| 电车路线收费（GeoJSON） | `https://static.data.gov.hk/td/routes-fares-geojson/JSON_TRAM.json` |
| 电车主要路线（CSV） | `http://static.data.gov.hk/tramways/datasets/main_routes/tramways_main_routes_sc.csv` |

### 三、空间数据共享平台（参考数据）

| 名称 | URL |
|------|-----|
| 交通探测器位置 | `https://portal.csdi.gov.hk/geoportal/?datasetId=td_rcd_1671693191724_92214` |
| 行人天桥 | `https://portal.csdi.gov.hk/geoportal/?datasetId=hyd_rcd_1632360512481_74705` |
| 专线小巴路线 | `https://portal.csdi.gov.hk/geoportal/?datasetId=td_rcd_1697082463580_57453` |

### 四、CKAN 元数据 API（用于发现数据集）

| 功能 | URL |
|------|-----|
| 数据集列表 | `https://data.gov.hk/sc-data/api/3/action/package_list` |
| 数据集详情 | `https://data.gov.hk/sc-data/api/3/action/package_show?id=[dataset_id]` |
| 分类列表 | `https://data.gov.hk/sc-data/api/3/action/group_list` |
| 分类详情 | `https://data.gov.hk/sc-data/api/3/action/group_show?id=[group_id]` |
