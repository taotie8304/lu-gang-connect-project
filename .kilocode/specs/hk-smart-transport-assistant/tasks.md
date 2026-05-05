# 实施任务列表：香港智能交通助手

## Overview

本任务列表将指导你逐步实现香港智能交通助手功能，对标港话通 App 的交通路线查询模块。基于 fastgpt-plugin 项目开发 FastGPT 系统插件（Bun + TypeScript + Zod），打包为 .pkg 文件上传到 FastGPT。

## Tasks

- [x] 1. 项目初始化和环境配置
  - 基于 fastgpt-plugin 项目结构创建插件目录
  - 配置 TypeScript、Zod、Bun
  - 配置 Vitest + fast-check 测试框架
  - _Requirements: 基础设施_

- [x] 2. 实现问题解析器（Parser）
  - [x] 2.1 实现地点名称提取功能
    - 使用正则表达式提取起点和终点
    - 支持常见地点名称（口岸、地标、车站等）
    - _Requirements: 1.1_
  
  - [x] 2.2 编写问题解析器的属性测试
    - **Property 1: 地点名称提取准确性**
    - **Validates: Requirements 1.1**
  
  - [x] 2.3 实现交通偏好识别功能
    - 识别巴士、地铁、小巴等关键词
    - 支持繁简体中文和英文
    - _Requirements: 1.2_
  
  - [x] 2.4 编写交通偏好识别的属性测试
    - **Property 2: 交通偏好识别准确性**
    - **Validates: Requirements 1.2**
  
  - [x] 2.5 实现多语言支持
    - 支持繁体中文、简体中文、英文
    - 统一处理不同语言的关键词
    - _Requirements: 1.4_
  
  - [x] 2.6 编写多语言支持的属性测试
    - **Property 3: 多语言支持一致性**
    - **Validates: Requirements 1.4**

- [x] 3. 实现地理编码器（Geocoder）
  - [x] 3.1 创建地点坐标词典
    - 内置常见地点（口岸、地标、车站、商圈）的经纬度坐标
    - 支持通过地点标准名称查询坐标
    - _Requirements: 2.1_
  
  - [x] 3.2 实现地点名称到坐标的转换
    - 将 parser 输出的标准地点名称转换为 {lat, lng} 坐标
    - 处理未知地点的错误情况
    - _Requirements: 2.1_

- [x] 4. 实现智能路由器（Router）
  - [x] 4.1 实现路由规则引擎
    - 根据交通偏好关键词决定调用哪些 API
    - 根据起点终点坐标决定是否调用 TDAS 路径规划
    - 无偏好时默认调用 TDAS + KMB + CTB
    - _Requirements: 2.1, 5.1, 6.1, 7.1, 8.1, 9.1_
  
  - [x] 4.2 编写智能路由的属性测试
    - **Property 4: 智能路由正确性**
    - **Validates: Requirements 2.1, 5.1, 6.1, 7.1, 8.1**
  
  - [x] 4.3 实现 API 调用计划生成
    - 生成 TDAS 调用参数（起点终点经纬度）
    - 生成 ETA 查询列表
    - _Requirements: 2.1_

- [x] 5. 实现 API 调用器（Fetcher）
  - [x] 5.1 实现通用 HTTP 调用函数
    - 支持 GET/POST 方法
    - 10 秒超时（TDAS 15 秒）
    - 错误捕获和降级
    - _Requirements: 13.1, 13.2_
  
  - [x] 5.2 实现 TDAS 路径规划 API 调用
    - POST `https://tdas-api.hkemobility.gov.hk/tdas/api/route`
    - 输入起点终点经纬度，返回多条路线方案
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 5.3 实现 KMB ETA API 调用
    - 站点 ETA：`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/{stop_id}`
    - 路线 ETA：`https://data.etabus.gov.hk/v1/transport/kmb/route-eta/{route}/{service_type}`
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 5.4 实现 CTB ETA API 调用
    - 站点+路线 ETA：`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/{stop_id}/{route}`
    - company_id 统一使用 "CTB"
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 5.5 实现 GMB ETA API 调用
    - 站点 ETA：`https://data.etagmb.gov.hk/eta/stop/{stop_id}`
    - 支持 HKI/KLN/NT 三个区域
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 5.6 实现 MTR 服务状态 API 调用
    - `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php`
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 5.7 实现 NLB ETA API 调用
    - `https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=estimatedArrivals&routeId={routeId}&stopId={stopId}&language={lang}`
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 5.8 实现静态数据缓存（内存缓存）
    - 缓存路线列表、站点列表（TTL 24 小时）
    - 缓存收费数据 JSON（TTL 24 小时）
    - 实时 ETA 数据不缓存
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 5.9 编写 ETA 数据完整性的属性测试
    - **Property 5: ETA 数据完整性**
    - **Validates: Requirements 3.2, 5.3, 6.2**

- [x] 6. Checkpoint - 确保 API 调用模块正常工作
  - 测试所有 API 调用功能
  - 验证缓存逻辑
  - 确保错误处理正确
  - 询问用户是否有问题

- [x] 7. 实现数据整合器（Integrator）
  - [x] 7.1 实现 TDAS 路线方案解析
    - 将 TDAS 响应转换为 RouteOption 格式
    - 提取换乘步骤、时间、距离
    - _Requirements: 2.2, 2.3, 2.4, 2.6_
  
  - [x] 7.2 实现站点 ETA 列表生成
    - 合并 KMB 和 CTB 在同一站点的 ETA 数据
    - 按到站时间排序
    - 对标港话通"巴士到站时间"页面
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 7.3 实现路线筛选功能
    - 按路线号过滤 ETA 列表
    - 支持模糊匹配（如"215"匹配"215X"）
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 7.4 编写路线筛选的属性测试
    - **Property 8: 路线筛选正确性**
    - **Validates: Requirements 4.1, 4.2**
  
  - [x] 7.5 实现直达路线优先排序
    - 直达路线排在换乘路线之前
    - _Requirements: 2.5_
  
  - [x] 7.6 编写直达路线优先级的属性测试
    - **Property 7: 直达路线优先级**
    - **Validates: Requirements 2.5**
  
  - [x] 7.7 实现付款信息生成
    - 根据交通工具类型生成付款方式
    - _Requirements: 11.1, 11.3, 11.4_
  
  - [x] 7.8 编写付款信息完整性的属性测试
    - **Property 9: 付款信息完整性**
    - **Validates: Requirements 11.1**
  
  - [x] 7.9 实现注意事项生成
    - 高峰时段提示、口岸通关提示、步行距离提示
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [x] 7.10 编写提示信息相关性的属性测试
    - **Property 10: 提示信息相关性**
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 8. 实现插件入口函数（index.ts）
  - [x] 8.1 实现 Zod 输入输出类型定义
    - 定义 InputType（question, language）
    - 定义 OutputType（routes, stopETAs, paymentInfo, tips, metadata）
    - _Requirements: FastGPT 插件规范_
  
  - [x] 8.2 实现 tool 主函数
    - 调用问题解析器 → 地理编码器 → 智能路由器
    - 并发调用 API（Promise.allSettled）
    - 调用数据整合器
    - _Requirements: 整体流程_
  
  - [x] 8.3 实现错误处理和降级
    - API 调用失败处理
    - 用户输入错误处理
    - 部分数据失败处理
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [x] 8.4 编写错误降级的属性测试
    - **Property 11: 错误降级正确性**
    - **Validates: Requirements 13.1, 13.2, 13.5**

- [x] 9. Checkpoint - 确保核心功能完整
  - 测试完整的请求-响应流程
  - 验证错误处理
  - 确保所有模块正确集成
  - 询问用户是否有问题

- [x] 10. 本地测试和调试
  - [x] 10.1 使用 Wrangler 本地开发服务器测试
    - 测试各种用户问题
    - 验证 API 调用是否成功
    - 检查响应数据格式
    - _Requirements: 测试_
  
  - [x] 10.2 运行所有单元测试和属性测试
    - 确保所有测试通过（属性测试 100 次迭代）
    - _Requirements: 测试_

- [x] 11. 打包和部署到 FastGPT
  - [x] 11.1 配置 Bun 打包
    - 确保 `bun run build:pkg` 能正确生成 .pkg 文件
    - 验证 .pkg 文件包含所有依赖
    - _Requirements: FastGPT 插件规范_
  
  - [x] 11.2 上传到 FastGPT
    - root 用户登录 FastGPT
    - 通过配置页面 → 导入/更新 → 上传 .pkg 文件
    - 验证插件热加载成功
    - _Requirements: 部署_

- [ ] 12. FastGPT 工作流集成
  - [ ] 12.1 在工作流中添加系统工具节点
    - 选择"香港智能交通助手"系统工具
    - 配置输入参数（question, language）
    - 连接到 AI 对话节点
    - _Requirements: FastGPT 集成_
  
  - [ ] 12.2 在工作流中测试工具
    - 测试各种用户问题
    - 验证 AI 能正确理解和使用返回数据
    - _Requirements: FastGPT 集成_

- [ ] 13. Final Checkpoint - 最终验收
  - 确保所有功能正常工作
  - 验证性能指标（响应时间 < 3 秒）
  - 询问用户是否满意

## Notes

- 所有任务都是必需的，包括完整的测试覆盖
- 每个任务都引用了对应的需求编号，确保可追溯性
- Checkpoint 任务用于确保增量验证，及时发现问题
- 属性测试使用 fast-check 框架，每个测试最少 100 次迭代
- 单元测试使用 Vitest 框架
- **重要**：所有 API 地址必须使用正确的格式，参考需求文档附录中的完整 API 地址列表
- **重要**：插件开发必须严格按照 FastGPT 官方规范（Bun + TypeScript + Zod + ts-rest）
- **重要**：CKAN API 仅用于获取数据集元数据，运营商专用 API 可直接调用
- **部署方式**：`bun run build:pkg` → 生成 .pkg 文件 → root 用户通过 FastGPT Web 界面上传
