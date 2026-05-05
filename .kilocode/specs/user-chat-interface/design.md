# Design Document: 鲁港通用户聊天界面

## Overview

将 FastGPT 改造为"聊天界面优先"的用户体验，普通用户登录后直接进入简洁的聊天界面。

## Architecture

```
路由结构：
/                    → 重定向到 /chat（启用 enableUserChatOnly 时）
/login               → 登录页面
/chat                → 用户聊天界面
/admin               → 管理后台入口（仅管理员）
/dashboard/*         → 原有管理功能
```

## Components

1. **RouteGuard**: 路由守卫，控制访问权限
2. **SimpleChatView**: 简化的聊天界面
3. **UserSettingsModal**: 用户设置弹窗
4. **AdminDashboard**: 管理后台入口

## Data Models

```typescript
// 新增配置项
interface FeConfigs {
  defaultChatAppId?: string;      // 默认聊天应用 ID
  enableUserChatOnly?: boolean;   // 启用纯聊天模式
  adminPath?: string;             // 管理后台路径
}
```

## Correctness Properties

### Property 1: 用户权限隔离
*For any* 普通用户，不应看到管理功能入口。
**Validates: Requirements 4.3, 6.3**

### Property 2: 管理后台访问控制
*For any* 非管理员用户访问 /admin，应被重定向。
**Validates: Requirements 5.2**

## Testing Strategy

- 单元测试：路由守卫、权限控制
- 集成测试：完整登录流程
