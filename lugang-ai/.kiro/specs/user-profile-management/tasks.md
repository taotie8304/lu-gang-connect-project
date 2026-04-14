# Implementation Plan: 用户信息管理

## Overview

按以下顺序实现：先修复账户信息失败问题（最小改动），再扩展个人资料功能，最后实现管理员用户详情。

## Tasks

- [x] 1. 新增 User 类型中的 nickname 字段
  - 在 `lugang-ai/packages/service/support/user/schema.ts` 的 UserSchema 中添加 `nickname` 字段（String，可选）
  - 在 `lugang-ai/packages/global/support/user/type.d.ts` 中的 `UserModelSchema` 类型添加 `nickname?: string`
  - _Requirements: 2.1_

- [x] 2. 新增用户个人资料 API
  - [x] 2.1 实现 `GET /api/user/profile`
    - 新建 `lugang-ai/projects/app/src/pages/api/user/profile.ts`
    - 验证用户 token（authCert），查询 MongoUser 和 MongoTeamMember，返回 name/nickname/phone/email/address
    - _Requirements: 2.1_
  - [x] 2.2 实现 `PUT /api/user/profile`
    - 在同一文件中处理 PUT 方法
    - 校验邮箱格式（含 @ 且有域名）、手机号格式（7-15位数字）
    - 更新 MongoUser（nickname/phone/email/address）和 MongoTeamMember（name）
    - 同步到鲁港通后端（调用 updateOneApiUser，失败仅记录日志）
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  - [x] 2.3 为 profile API 编写属性测试
    - **Property 4: 个人资料保存后数据库一致**
    - **Property 3: 邮箱/手机号格式校验**
    - **Validates: Requirements 2.2, 2.4, 2.5**

- [x] 3. 重构 AccountInfoModal
  - [x] 3.1 重构为两个 Tab（个人资料 + 账户额度）
    - 修改 `lugang-ai/projects/app/src/components/AccountInfoModal/index.tsx`
    - 个人资料 Tab：调用 `GET /api/user/profile` 加载，表单编辑，提交调用 `PUT /api/user/profile`
    - 额度 Tab：调用 `GET /api/integration/oneapi/quota`（使用 `GET` 函数，路径 `/integration/oneapi/quota`），显示 quota/usedQuota/remainingQuota 和进度条
    - 充值按钮：`window.open('https://api.airscend.com/topup', '_blank')`
    - 失败时显示默认值 0，不显示错误 Toast
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.6, 3.1, 3.2, 3.3, 3.4_
  - [x] 3.2 为 AccountInfoModal 编写属性测试
    - **Property 1: 额度数据完整渲染**
    - **Property 2: 后端不可用时降级为默认值**
    - **Validates: Requirements 1.4, 3.1, 3.2, 1.2**

- [x] 4. Checkpoint — 确保所有测试通过，向用户确认账户信息弹窗功能正常

- [x] 5. 新增管理员用户详情 API
  - [x] 5.1 实现 `GET /api/admin/users/detail`
    - 新建 `lugang-ai/projects/app/src/pages/api/admin/users/detail.ts`
    - 验证 root 权限（authCert + authRoot），查询 MongoUser 和 MongoTeamMember
    - 同时调用 `/api/integration/oneapi/quota` 获取额度（失败返回 null）
    - 返回完整用户信息
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 5.2 实现 `PUT /api/admin/users/detail`
    - 在同一文件中处理 PUT 方法
    - 禁止修改 root 用户（返回 403）
    - 更新 MongoUser（nickname/phone/email/address，若有 newPassword 则更新密码）
    - 更新 MongoTeamMember（name）
    - 同步到鲁港通后端（失败仅记录日志）
    - 密码校验：newPassword 若存在则长度 ≥ 8
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7_
  - [x] 5.3 为管理员 detail API 编写属性测试
    - **Property 5: 管理员更新用户信息后数据库一致**
    - **Property 6: 信息变更同步到鲁港通后端**
    - **Property 7: 密码长度校验**
    - **Property 8: root 用户不可修改**
    - **Validates: Requirements 5.1, 5.2, 5.5, 5.7**

- [x] 6. 新增 AdminUserDetailModal 组件
  - 新建 `lugang-ai/projects/app/src/components/AdminUserDetailModal/index.tsx`
  - 展示字段：用户名（只读）、注册时间（只读）、状态（只读）、姓名、昵称、手机号、邮箱、通讯地址
  - 密码重置区域：新密码 + 确认密码输入框（可选填，有值时才提交）
  - 额度展示（只读，来自 GET detail 接口）
  - root 用户：所有编辑字段禁用，显示提示
  - 保存调用 `PUT /api/admin/users/detail`，成功显示 Toast
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.5, 5.6, 5.7_

- [x] 7. 修改 AdminUsersPage 接入 AdminUserDetailModal
  - 修改 `lugang-ai/projects/app/src/pages/admin/users/index.tsx`
  - 用户行添加点击事件，打开 AdminUserDetailModal
  - 传入 userId，弹窗关闭后刷新列表
  - _Requirements: 4.1_

- [x] 8. Final Checkpoint — 确保所有测试通过，向用户确认管理员用户详情功能正常

## Notes

- 所有测试任务均为必须，确保完整的测试覆盖
- 鲁港通后端同步失败不阻断主流程，仅记录日志
- 密码字段在 MongoUser schema 中有 `set: hashStr`，直接赋值即可自动加密
- 充值 Stripe 接口预留，当前阶段仅跳转外部页面
