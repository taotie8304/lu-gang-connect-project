# Design Document: 用户信息管理

## Overview

本功能分两个方向：

1. **普通用户侧**：修复账户信息弹窗的"获取账户信息失败"错误，重构 `AccountInfoModal` 使其直接调用已有的 `/api/integration/oneapi/quota` 接口获取额度，并新增个人资料（姓名、昵称、手机号、邮箱、通讯地址）的查看与编辑功能，以及充值入口。

2. **管理员侧**：在现有用户管理列表（`/admin/users`）中，点击用户行打开 `AdminUserDetailModal`，支持查看并修改用户所有信息（含密码），变更同步到鲁港通后端。

## Architecture

```
前端组件层
├── AccountInfoModal（重构）
│   ├── 个人资料 Tab：查看/编辑 name/nickname/phone/email/address
│   └── 额度 Tab：显示 quota/usedQuota/remainingQuota + 充值按钮
├── AdminUserDetailModal（新增）
│   ├── 用户信息展示与编辑
│   └── 密码重置
└── AdminUsersPage（修改）
    └── 用户行点击 → 打开 AdminUserDetailModal

API 层
├── GET  /api/user/profile          （新增）获取当前用户个人资料
├── PUT  /api/user/profile          （新增）更新当前用户个人资料
├── GET  /api/admin/users/detail    （新增）管理员获取指定用户详情
└── PUT  /api/admin/users/detail    （新增）管理员更新指定用户信息（含密码）

已有接口（复用）
└── GET  /api/integration/oneapi/quota  获取当前用户额度
```

## Components and Interfaces

### AccountInfoModal（重构）

将现有的订阅/余额展示逻辑替换为两个 Tab：

**Tab 1 - 个人资料**
- 字段：姓名（`name`，来自 TeamMember.name）、昵称（`nickname`，来自 User.nickname，若无则同 name）、手机号（`phone`）、邮箱（`email`）、通讯地址（`address`）
- 可编辑，提交前做格式校验
- 保存调用 `PUT /api/user/profile`

**Tab 2 - 账户额度**
- 调用 `GET /api/integration/oneapi/quota`（已有接口，路径已修复）
- 显示：总额度、已用额度、剩余额度、使用进度条
- 充值按钮：`window.open('https://api.airscend.com/topup', '_blank')`

### AdminUserDetailModal（新增）

弹窗包含：
- 用户基本信息展示（用户名、注册时间、状态）
- 可编辑字段：姓名、昵称、手机号、邮箱、通讯地址
- 密码重置：新密码输入框（≥8位），确认密码
- 额度展示（只读，调用 `/api/integration/oneapi/quota?userId=xxx` 或通过 username 查询）
- 保存调用 `PUT /api/admin/users/detail`
- root 用户：所有编辑字段禁用

### AdminUsersPage（修改）

- 用户行增加点击事件，打开 `AdminUserDetailModal`
- 原有"禁用/启用"按钮保留

## Data Models

### User（MongoDB，已有字段，直接使用）

```typescript
{
  _id: ObjectId,
  username: string,       // 登录名（邮箱或手机）
  password: string,       // bcrypt hash（select: false）
  status: string,         // 'active' | 'forbidden'
  createTime: Date,
  email: string,          // 鲁港通扩展字段
  phone: string,          // 鲁港通扩展字段
  address: string,        // 鲁港通扩展字段
}
```

### TeamMember（MongoDB，已有字段）

```typescript
{
  userId: ObjectId,
  teamId: ObjectId,
  name: string,           // 显示名（姓名）
  avatar: string,
}
```

### UserProfile（前端 DTO）

```typescript
type UserProfile = {
  name: string;           // 来自 TeamMember.name
  nickname?: string;      // 来自 User.nickname（若无则同 name）
  phone?: string;
  email?: string;
  address?: string;
};
```

### API Request/Response

```typescript
// PUT /api/user/profile
type UpdateProfileBody = {
  name?: string;
  nickname?: string;
  phone?: string;
  email?: string;
  address?: string;
};

// GET /api/admin/users/detail?userId=xxx
type AdminUserDetail = {
  _id: string;
  username: string;
  name: string;
  nickname?: string;
  phone?: string;
  email?: string;
  address?: string;
  status: string;
  createTime: Date;
  quota?: { quota: number; usedQuota: number; remainingQuota: number };
};

// PUT /api/admin/users/detail
type AdminUpdateUserBody = {
  userId: string;
  name?: string;
  nickname?: string;
  phone?: string;
  email?: string;
  address?: string;
  newPassword?: string;   // 可选，有值时重置密码
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: 额度数据完整渲染
*For any* 有效的额度响应数据（quota、usedQuota、remainingQuota 均为非负整数），AccountInfoModal 渲染后应同时包含这三个数值的展示。
**Validates: Requirements 1.4, 3.1, 3.2**

Property 2: 后端不可用时降级为默认值
*For any* 导致 `/api/integration/oneapi/quota` 返回错误的情况，AccountInfoModal 和 AdminUserDetailModal 应展示默认值（0）而非错误状态。
**Validates: Requirements 1.2, 4.4**

Property 3: 邮箱/手机号格式校验
*For any* 不符合格式的邮箱字符串（不含 `@` 或域名部分），或不符合格式的手机号字符串（非纯数字或长度不在 7-15 位），校验函数应返回错误，阻止提交。
**Validates: Requirements 2.4, 2.5**

Property 4: 个人资料保存后数据库一致
*For any* 合法的 UserProfile 更新请求，`PUT /api/user/profile` 执行后，从数据库重新查询该用户，返回的字段值应与提交的值一致。
**Validates: Requirements 2.2**

Property 5: 管理员更新用户信息后数据库一致
*For any* 合法的管理员更新请求（非 root 用户），`PUT /api/admin/users/detail` 执行后，从数据库重新查询该用户，返回的字段值应与提交的值一致。
**Validates: Requirements 5.1**

Property 6: 信息变更同步到鲁港通后端
*For any* 用户信息更新操作（用户自己或管理员），若鲁港通后端中存在对应用户，同步调用（updateOneApiUser）应被触发一次。
**Validates: Requirements 2.3, 5.2, 5.4**

Property 7: 密码长度校验
*For any* 长度小于 8 的字符串作为新密码，校验函数应返回错误，阻止提交。
**Validates: Requirements 5.5**

Property 8: root 用户不可修改
*For any* 以 root 用户 userId 为目标的 `PUT /api/admin/users/detail` 请求，API 应返回 403 错误，数据库不发生变更。
**Validates: Requirements 5.7**

## Error Handling

| 场景 | 处理方式 |
|------|---------|
| `/api/integration/oneapi/quota` 失败 | 显示默认值 0，不显示错误 Toast |
| `PUT /api/user/profile` 失败 | 显示错误 Toast，表单保持当前值 |
| `PUT /api/admin/users/detail` 失败 | 显示错误 Toast，弹窗保持打开 |
| 修改 root 用户 | API 返回 403，前端禁用编辑字段 |
| 鲁港通后端同步失败 | 记录日志，不影响主流程（前端数据库已保存） |

## Testing Strategy

**单元测试**：
- 邮箱/手机号/密码校验函数的边界值测试
- `AdminUserDetailModal` 对 root 用户禁用编辑的渲染测试
- 额度加载失败时显示默认值的渲染测试

**属性测试**（使用 fast-check，最少 100 次迭代）：
- Property 3：生成随机字符串，验证格式校验函数的正确性
- Property 4/5：生成随机合法 UserProfile，验证保存后数据库一致性
- Property 7：生成随机短密码，验证校验函数拒绝
- Property 8：以 root userId 调用 API，验证始终返回 403

每个属性测试注释格式：
```typescript
// Feature: user-profile-management, Property N: <property_text>
```
