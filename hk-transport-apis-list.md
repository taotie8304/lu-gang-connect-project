# 香港交通 API 完整列表

## 基础设施数据

### 1. 交通探测器位置 (空间数据共享平台)
- URL: https://portal.csdi.gov.hk/geoportal/?datasetId=td_rcd_1671693191724_92214
- 用途: 获取交通探测器的位置信息
- 更新频率: 静态数据

### 2. 行人天桥
- URL: https://portal.csdi.gov.hk/geoportal/?datasetId=hyd_rcd_1632360512481_74705
- 用途: 获取行人天桥位置信息
- 更新频率: 静态数据

### 3. 专线小巴路线 (空间数据共享平台)
- URL: https://portal.csdi.gov.hk/geoportal/?datasetId=td_rcd_1697082463580_57453
- 用途: 获取专线小巴路线地理信息
- 更新频率: 静态数据

## 九龙巴士及龙运巴士 (KMB)

### 4. 路线列表数据
- URL: https://data.etabus.gov.hk/v1/transport/kmb/route/
- 用途: 获取所有巴士路线列表
- 更新频率: 每日更新

### 5. 路线数据
- URL: https://data.etabus.gov.hk/v1/transport/kmb/route/{route}/{direction}/{service_type}
- 参数: route, direction, service_type
- 用途: 获取特定路线的详细信息

### 6. 巴士站列表数据
- URL: https://data.etabus.gov.hk/v1/transport/kmb/stop
- 用途: 获取所有巴士站列表

### 7. 巴士站数据
- URL: https://data.etabus.gov.hk/v1/transport/kmb/stop/{stop_id}
- 参数: stop_id
- 用途: 获取特定巴士站信息

### 8. 路线-巴士站列表数据
- URL: https://data.etabus.gov.hk/v1/transport/kmb/route-stop
- 用途: 获取所有路线的巴士站列表

### 9. 路线-巴士站数据
- URL: https://data.etabus.gov.hk/v1/transport/kmb/route-stop/{route}/{direction}/{service_type}
- 参数: route, direction, service_type
- 用途: 获取特定路线的所有巴士站

### 10. 预计到达时间数据 (按巴士站和路线)
- URL: https://data.etabus.gov.hk/v1/transport/kmb/eta/{stop_id}/{route}/{service_type}
- 参数: stop_id, route, service_type
- 用途: 获取特定巴士站特定路线的预计到达时间
- 更新频率: 每2分钟

### 11. 预计到达时间数据 (按巴士站)
- URL: https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/{stop_id}
- 参数: stop_id
- 用途: 获取特定巴士站所有路线的预计到达时间
- 更新频率: 每2分钟

### 12. 预计到达时间数据 (按路线)
- URL: https://data.etabus.gov.hk/v1/transport/kmb/route-eta/{route}/{service_type}
- 参数: route, service_type
- 用途: 获取特定路线所有巴士站的预计到达时间
- 更新频率: 每2分钟

## 港铁巴士及接驳巴士

### 13. 港铁巴士实时到站时间
- URL: https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule
- 用途: 获取港铁巴士的实时到站时间
- 更新频率: 实时

## 专线小巴 (GMB)

### 14. 专线小巴路线列表
- URL: https://data.etagmb.gov.hk/route/{region}
- 参数: region (HKI/KLN/NT)
- 用途: 获取指定区域的专线小巴路线列表

### 15. 专线小巴路线资料
- URL: https://data.etagmb.gov.hk/route/{region}/{route_code}
- 参数: region, route_code
- 用途: 获取特定专线小巴路线的详细信息

### 16. 专线小巴站资料
- URL: https://data.etagmb.gov.hk/stop/{stop_id}
- 参数: stop_id
- 用途: 获取特定小巴站信息

### 17. 个别专线小巴路线的小巴站资料
- URL: https://data.etagmb.gov.hk/route-stop/{route_id}/{route_seq}
- 参数: route_id, route_seq
- 用途: 获取特定路线的所有小巴站

### 18. 个别小巴站的专线小巴路线资料
- URL: https://data.etagmb.gov.hk/stop-route/{stop_id}
- 参数: stop_id
- 用途: 获取特定小巴站的所有路线

### 19. 个别专线小巴站的预计到站时间资料
- URL: https://data.etagmb.gov.hk/eta/stop/{stop_id}
- 参数: stop_id
- 用途: 获取特定小巴站的预计到站时间
- 更新频率: 实时

### 20. 资料最后更新时间
- URL: https://data.etagmb.gov.hk/last-update/
- 用途: 获取数据最后更新时间

## 新大屿山巴士 (NLB)

### 21. 路线列表
- URL: https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list
- 用途: 获取新大屿山巴士所有路线

### 22. 路线的车站
- URL: https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId={routeId}
- 参数: routeId
- 用途: 获取特定路线的所有车站

### 23. 巴士预计抵站时间
- URL: https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=estimatedArrivals&routeId={routeId}&stopId={stopId}&language={languageCode}
- 参数: routeId, stopId, languageCode
- 用途: 获取预计抵站时间
- 更新频率: 实时

## 港铁

### 24. 港铁实时列车服务资讯
- URL: https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php
- 用途: 获取港铁列车实时服务信息
- 更新频率: 实时

## 城巴 (CTB)

### 25. 公司数据
- URL: https://rt.data.gov.hk/v2/transport/citybus/company/ctb
- 用途: 获取城巴公司信息

### 26. 巴士路线数据
- URL: https://rt.data.gov.hk/v2/transport/citybus/route/ctb
- 用途: 获取所有城巴路线

### 27. 巴士站数据
- URL: https://rt.data.gov.hk/v2/transport/citybus/stop
- 用途: 获取所有城巴站

### 28. 个别路线的巴士站数据
- URL: https://rt.data.gov.hk/v2/transport/citybus/route-stop/ctb
- 用途: 获取特定路线的所有巴士站

### 29. 预计到达时间数据
- URL: https://rt.data.gov.hk/v2/transport/citybus/eta/ctb
- 用途: 获取城巴预计到达时间
- 更新频率: 实时

## 公共交通路线及收费资料 (GeoJSON)

### 30. 巴士路线资料
- URL: https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json
- 用途: 获取所有巴士路线和收费信息（含地理坐标）

### 31. 专线小巴路线资料
- URL: https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json
- 用途: 获取所有专线小巴路线和收费信息（含地理坐标）

### 32. 渡轮航线资料
- URL: https://static.data.gov.hk/td/routes-fares-geojson/JSON_FERRY.json
- 用途: 获取所有渡轮航线和收费信息（含地理坐标）

### 33. 山顶缆车路线资料
- URL: https://static.data.gov.hk/td/routes-fares-geojson/JSON_PTRAM.json
- 用途: 获取山顶缆车路线和收费信息（含地理坐标）

### 34. 电车路线资料
- URL: https://static.data.gov.hk/td/routes-fares-geojson/JSON_TRAM.json
- 用途: 获取所有电车路线和收费信息（含地理坐标）

### 35. 香港电车主要路线
- URL: http://static.data.gov.hk/tramways/datasets/main_routes/tramways_main_routes_sc.csv
- 用途: 获取香港电车主要路线信息（CSV格式）

## API 分类总结

### 实时数据 (每2分钟或更频繁更新)
- KMB 预计到达时间 (API 10, 11, 12)
- 专线小巴预计到站时间 (API 19)
- NLB 预计抵站时间 (API 23)
- 港铁实时列车服务 (API 24)
- 城巴预计到达时间 (API 29)
- 港铁巴士实时到站时间 (API 13)

### 静态/每日更新数据
- 路线信息
- 巴士站信息
- 基础设施数据（天桥、探测器等）
- 收费资料

### 按交通工具分类
- **巴士**: KMB (API 4-12), CTB (API 25-29), NLB (API 21-23), 港铁巴士 (API 13)
- **小巴**: GMB (API 14-20)
- **港铁**: MTR (API 24)
- **其他**: 渡轮、电车、山顶缆车 (API 32-35)

### 开发时会用到的API转换指南及FastGPT插件开发指南
https://doc.fastgpt.cn/zh-CN/docs/introduction

FastGPT插件仓库

https://github.com/labring/fastgpt-plugin



如何开发系统插件

FastGPT 系统插件开发指南（工具篇）

https://doc.fastgpt.cn/zh-CN/docs/introduction/guide/plugins/dev_system_tool



系统插件设计

FastGPT 系统插件设计方案

https://doc.fastgpt.io/zh-CN/docs/self-host/design/design_plugin



CKAN 应用程式介面开发指南

https://data.gov.hk/sc/help/ckan-api-development-guide



CKAN的官方文件

http://docs.ckan.org/en/latest/api/index.html



CKAN提供的所有应用程式介面功能及参数列于

http://docs.ckan.org/en/latest/api/index.html#module-ckan.logic.action.get



FastGPT-plugin 开发文档

https://github.com/labring/fastgpt-plugin/blob/main/dev_zh_CN.md