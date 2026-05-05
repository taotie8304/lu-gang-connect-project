# Requirements Document

## Introduction

本项目旨在恢复鲁港通项目中的 FastGPT 商业版权限控制功能，解决"未配置商业版链接"错误提示，并为未来对接商业版服务预留接口。同时，将从 FastGPT-4.14.7.2 最新版本中提取关键更新，融合到当前鲁港通项目中。

## Glossary

- **FastGPT_Pro**: FastGPT 商业版服务，提供高级功能如系统通知、数据导出、发票管理等
- **Pro_API**: 商业版 API 代理接口，位于 `/api/proApi/[...path].ts`
- **PRO_URL**: 环境变量，指向 FastGPT 商业版服务地址
- **FastGPTProUrl**: 从 PRO_URL 派生的常量，用于代码中的商业版 API 调用
- **System_Msg_Modal**: 系统消息弹窗，用于向用户展示系统公告
- **Plus_Request**: 商业版 API 请求封装模块
- **Lugang_AI**: 鲁港通前端项目（当前项目）
- **FastGPT_Latest**: FastGPT-4.14.7.2 最新开源版本

## Requirements

### Requirement 1: 恢复商业版 API 代理功能

**User Story:** As a system administrator, I want the Pro API proxy to handle missing configuration gracefully, so that the application doesn't crash when Pro URL is not configured.

#### Acceptance Criteria

1. WHEN PRO_URL is not configured, THE Pro_API SHALL return appropriate error responses instead of throwing exceptions
2. THE Pro_API SHALL log warnings when Pro URL is missing
3. WHEN PRO_URL is configured, THE Pro_API SHALL proxy requests to the commercial service
4. THE Pro_API SHALL use the latest fetch-based implementation from FastGPT-4.14.7.2
5. THE Pro_API SHALL handle request headers correctly, excluding sensitive headers like 'rootkey', 'host', 'connection'

### Requirement 2: 更新商业版常量定义

**User Story:** As a developer, I want consistent Pro URL constants across the codebase, so that configuration is centralized and maintainable.

#### Acceptance Criteria

1. THE System SHALL define FastGPTProUrl constant in `packages/service/common/system/constants.ts`
2. THE FastGPTProUrl SHALL be derived from process.env.PRO_URL
3. THE System SHALL provide helper functions: `isFastGPTProService()` and `isProVersion()`
4. WHEN PRO_URL is empty, THE FastGPTProUrl SHALL be an empty string
5. THE System SHALL export InitialErrorEnum including PRO_ERROR

### Requirement 3: 恢复商业版请求模块

**User Story:** As a developer, I want a robust Plus Request module, so that I can make API calls to the commercial service with proper error handling.

#### Acceptance Criteria

1. THE Plus_Request module SHALL be located at `packages/service/common/api/plusRequest.ts`
2. WHEN FastGPTProUrl is not configured, THE Plus_Request SHALL reject with UserError
3. THE Plus_Request SHALL log warnings when Pro API is not configured
4. THE Plus_Request SHALL provide GET, POST, PUT, DELETE methods
5. THE Plus_Request SHALL handle request/response interceptors correctly
6. THE Plus_Request SHALL remove null and undefined values from request data
7. THE Plus_Request SHALL set proper headers including rootkey from environment

### Requirement 4: 更新系统配置控制器

**User Story:** As a system, I want to fetch FastGPT configuration from database, so that I can provide dynamic configuration to the frontend.

#### Acceptance Criteria

1. THE System SHALL implement `getFastGPTConfigFromDB()` function
2. WHEN FastGPTProUrl is not configured, THE function SHALL return empty config object
3. WHEN FastGPTProUrl is configured, THE function SHALL fetch config from MongoDB
4. THE System SHALL fetch both fastgpt config and license config
5. THE System SHALL set global.systemInitBufferId for caching
6. THE System SHALL provide `updateFastGPTConfigBuffer()` and `reloadFastGPTConfigBuffer()` functions

### Requirement 5: 更新用户通知 API

**User Story:** As a system, I want to send user notifications through Pro API, so that administrators can communicate with users.

#### Acceptance Criteria

1. THE System SHALL implement `sendOneInform()` function in `projects/app/src/service/support/user/inform/api.ts`
2. WHEN FastGPTProUrl is not configured, THE function SHALL return early without error
3. WHEN FastGPTProUrl is configured, THE function SHALL POST to `/support/user/inform/create`
4. THE function SHALL accept SendInform2UserProps as parameter

### Requirement 6: 更新文件 URL 验证器

**User Story:** As a security module, I want to validate file URLs against whitelist, so that only trusted domains are allowed.

#### Acceptance Criteria

1. THE System SHALL extract hostname from PRO_URL for whitelist
2. WHEN PRO_URL is invalid, THE System SHALL handle gracefully without crash
3. THE System SHALL add Pro URL hostname to trusted domain list
4. THE validation SHALL work with FE_DOMAIN and STORAGE_EXTERNAL_ENDPOINT

### Requirement 7: 更新外链工具模块

**User Story:** As a system, I want to track outlink usage through Pro API, so that usage statistics are recorded.

#### Acceptance Criteria

1. THE System SHALL check if FastGPTProUrl is configured before tracking
2. WHEN FastGPTProUrl is not configured, THE tracking SHALL skip silently
3. WHEN FastGPTProUrl is configured, THE System SHALL send tracking data to Pro API
4. THE tracking SHALL include shareId, outLinkUid, and flow responses

### Requirement 8: 添加环境变量配置

**User Story:** As a system administrator, I want clear documentation for Pro URL configuration, so that I can set up commercial service integration.

#### Acceptance Criteria

1. THE System SHALL document PRO_URL environment variable in .env.template
2. THE documentation SHALL explain the format: `https://pro.example.com`
3. THE documentation SHALL note that Pro URL is optional
4. THE System SHALL provide example configuration in deployment guides

### Requirement 9: 更新类型定义

**User Story:** As a developer, I want TypeScript type definitions for environment variables, so that I have type safety.

#### Acceptance Criteria

1. THE System SHALL add PRO_URL to ProcessEnv interface in `packages/service/type/env.ts`
2. THE type definition SHALL be string type
3. THE type definition SHALL be consistent with other environment variables

### Requirement 10: 测试商业版功能降级

**User Story:** As a user, I want the application to work without Pro URL configured, so that I can use the open-source version.

#### Acceptance Criteria

1. WHEN PRO_URL is not configured, THE System_Msg_Modal SHALL not display
2. WHEN PRO_URL is not configured, THE data export features SHALL be disabled or use local export
3. WHEN PRO_URL is not configured, THE user inform features SHALL skip silently
4. WHEN PRO_URL is not configured, THE application SHALL not show error messages to users
5. WHEN PRO_URL is configured, THE commercial features SHALL work normally

