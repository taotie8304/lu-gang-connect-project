# Implementation Plan: FastGPT 商业版集成

## Overview

本实现计划分为三个阶段：
1. 第一阶段：恢复核心商业版模块
2. 第二阶段：更新依赖商业版的功能模块
3. 第三阶段：测试和验证

## Tasks

### 第一阶段：恢复核心商业版模块

- [x] 1. 更新商业版常量定义
  - [x] 1.1 更新 `packages/service/common/system/constants.ts`
    - 从 FastGPT-4.14.7.2 复制完整实现
    - 定义 `FastGPTProUrl` 常量
    - 添加 `isFastGPTProService()` 和 `isProVersion()` 函数
    - 添加 `InitialErrorEnum` 枚举
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ]* 1.2 编写常量模块属性测试
    - **Property 1: 商业版 URL 配置一致性**
    - **Validates: Requirements 2.1, 2.2**
    - 测试 FastGPTProUrl 在有/无 PRO_URL 时的值
    - 测试辅助函数返回值

- [x] 2. 恢复商业版请求模块
  - [x] 2.1 更新 `packages/service/common/api/plusRequest.ts`
    - 从 FastGPT-4.14.7.2 复制完整实现
    - 实现请求拦截器（移除 content-length）
    - 实现响应拦截器
    - 实现 checkRes 和 responseError 函数
    - 实现 GET, POST, PUT, DELETE 方法
    - 添加未配置商业版时的警告日志
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [ ]* 2.2 编写请求模块单元测试
    - 测试未配置商业版时返回 UserError
    - 测试空值清理逻辑
    - 测试请求拦截器
    - _Requirements: 3.2, 3.3, 3.6_
  
  - [ ]* 2.3 编写请求模块属性测试
    - **Property 2: 优雅降级行为**
    - **Property 4: 空值清理**
    - **Validates: Requirements 1.1, 1.2, 3.6**

- [x] 3. 更新商业版 API 代理
  - [x] 3.1 更新 `projects/app/src/pages/api/proApi/[...path].ts`
    - 从 FastGPT-4.14.7.2 复制最新实现
    - 使用 fetch API 替代 http.request
    - 实现请求头过滤（排除 rootkey, host, connection）
    - 实现响应头复制（排除 content-encoding, transfer-encoding）
    - 实现流式响应处理
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ]* 3.2 编写 API 代理属性测试
    - **Property 3: 请求头过滤**
    - **Validates: Requirements 1.5**
    - 生成随机请求头，验证敏感头被过滤

- [x] 4. 更新系统配置控制器
  - [x] 4.1 更新 `packages/service/common/system/config/controller.ts`
    - 从 FastGPT-4.14.7.2 复制完整实现
    - 实现 `getFastGPTConfigFromDB()` 函数
    - 实现 `updateFastGPTConfigBuffer()` 函数
    - 实现 `reloadFastGPTConfigBuffer()` 函数
    - 添加未配置商业版时返回空配置的逻辑
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 4.2 编写配置控制器单元测试
    - 测试未配置商业版时返回空配置
    - 测试缓存 ID 生成逻辑
    - _Requirements: 4.2, 4.5_
  
  - [ ]* 4.3 编写配置控制器属性测试
    - **Property 5: 配置缓存一致性**
    - **Validates: Requirements 4.5**

- [x] 5. Checkpoint - 确保核心模块正常工作
  - 验证常量定义正确
  - 验证请求模块能够优雅降级
  - 验证 API 代理正确过滤请求头
  - 验证配置控制器返回正确数据

### 第二阶段：更新依赖商业版的功能模块

- [x] 6. 更新用户通知 API
  - [x] 6.1 创建 `projects/app/src/service/support/user/inform/api.ts`
    - 从 FastGPT-4.14.7.2 复制实现
    - 实现 `sendOneInform()` 函数
    - 添加未配置商业版时的早期返回
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 6.2 编写用户通知单元测试
    - 测试未配置商业版时直接返回
    - 测试配置商业版时正确调用 POST
    - _Requirements: 5.2_

- [x] 7. 更新文件 URL 验证器
  - [x] 7.1 更新 `packages/service/common/security/fileUrlValidator.ts`
    - 从 FastGPT-4.14.7.2 提取 PRO_URL 处理逻辑
    - 添加 PRO_URL 主机名到白名单
    - 添加无效 URL 的错误处理
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 7.2 编写文件 URL 验证器单元测试
    - 测试有效 PRO_URL 被添加到白名单
    - 测试无效 PRO_URL 被优雅处理
    - _Requirements: 6.2_

- [x] 8. 更新外链工具模块
  - [x] 8.1 更新 `packages/service/support/outLink/tools.ts`
    - 从 FastGPT-4.14.7.2 提取商业版追踪逻辑
    - 在 `pushOutLinkUsageToQueue` 函数中添加 FastGPTProUrl 检查
    - 添加未配置商业版时的早期返回
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 8.2 编写外链工具单元测试
    - 测试未配置商业版时跳过追踪
    - 测试配置商业版时正确发送追踪数据
    - _Requirements: 7.2_

- [x] 9. 更新类型定义
  - [x] 9.1 更新 `packages/service/type/env.ts`
    - 添加 PRO_URL 到 ProcessEnv 接口
    - 确保类型定义与其他环境变量一致
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 10. 添加环境变量配置文档
  - [x] 10.1 更新 `.env.template` 文件
    - 添加 PRO_URL 配置说明
    - 说明格式：`https://pro.example.com`
    - 标注为可选配置
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 10.2 更新部署文档
    - 在 `DEPLOYMENT-GUIDE.md` 中添加商业版配置章节
    - 说明如何配置 PRO_URL
    - 说明未配置时的行为
    - _Requirements: 8.4_

- [x] 11. Checkpoint - 确保所有依赖模块更新完成
  - 验证用户通知 API 正确处理未配置情况
  - 验证文件 URL 验证器包含 PRO_URL
  - 验证外链追踪正确降级
  - 验证环境变量文档完整

### 第三阶段：测试和验证

- [x] 12. 测试商业版功能降级
  - [x] 12.1 测试未配置商业版场景
    - 不配置 PRO_URL 环境变量
    - 启动应用，验证无错误提示
    - 验证系统消息弹窗不显示
    - 验证数据导出功能被禁用或使用本地导出
    - 验证用户通知功能静默跳过
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ]* 12.2 编写降级行为集成测试
    - 测试应用在无 PRO_URL 时正常启动
    - 测试商业版功能被正确跳过
    - 测试无用户可见错误
    - _Requirements: 10.1, 10.4_

- [ ] 13. 测试商业版功能正常工作
  - [ ] 13.1 测试配置商业版场景（可选）
    - 配置 PRO_URL 环境变量（如果有测试环境）
    - 验证 API 代理正确转发请求
    - 验证系统消息弹窗正常显示
    - 验证数据导出功能正常工作
    - _Requirements: 1.3, 10.5_
  
  - [ ]* 13.2 编写商业版功能集成测试（可选）
    - 测试 API 代理正确转发
    - 测试响应正确返回
    - _Requirements: 1.3_

- [ ] 14. 编写属性测试
  - [ ]* 14.1 实现 Property 1 测试（URL 配置一致性）
    - 扫描代码库，验证所有商业版 URL 访问使用 FastGPTProUrl
    - _Requirements: 2.1, 2.2_
  
  - [ ]* 14.2 实现 Property 2 测试（优雅降级）
    - 生成随机 API 调用
    - 验证未配置时不抛出异常
    - _Requirements: 1.1, 1.2, 10.1, 10.3, 10.4_
  
  - [ ]* 14.3 实现 Property 3 测试（请求头过滤）
    - 生成随机请求头
    - 验证敏感头被过滤
    - _Requirements: 1.5_
  
  - [ ]* 14.4 实现 Property 4 测试（空值清理）
    - 生成包含 null/undefined 的随机数据
    - 验证这些值被移除
    - _Requirements: 3.6_
  
  - [ ]* 14.5 实现 Property 5 测试（配置缓存一致性）
    - 模拟配置更新
    - 验证缓存 ID 同步更新
    - _Requirements: 4.5_
  
  - [ ]* 14.6 实现 Property 6 测试（日志记录完整性）
    - 模拟商业版调用失败
    - 验证日志包含 URL 和错误信息
    - _Requirements: 1.2, 3.3_

- [x] 15. 代码审查和文档更新
  - [x] 15.1 代码审查
    - 检查所有修改的文件
    - 确保遵循鲁港通命名规范
    - 确保注释使用中文
    - 确保日志使用中文
  
  - [x] 15.2 更新 README
    - 添加商业版配置说明
    - 更新环境变量列表
    - 说明开源版和商业版的区别

- [x] 16. 最终 Checkpoint
  - 运行所有测试，确保通过
  - 验证应用在无商业版配置时正常运行
  - 验证"未配置商业版链接"错误已解决
  - 生成测试报告

## Notes

- 标记 `*` 的任务为可选测试任务，可以根据时间安排决定是否实现
- 每个阶段完成后进行 Checkpoint 验证
- 属性测试使用 fast-check 库，最少 100 次迭代
- 所有代码注释和日志使用中文
- 遵循鲁港通命名规范

