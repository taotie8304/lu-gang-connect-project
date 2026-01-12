# Implementation Plan: 鲁港通平台集成

## Overview

本任务列表将鲁港通跨境AI智能平台的功能需求分解为可执行的开发任务，包括品牌化完善、港话通风格界面、用户系统、One API 集成等。

## Tasks

- [ ] 1. 品牌化资源修复
  - [x] 1.1 修复 Logo 文件路径配置
    - 修改 `packages/global/common/system/constants.ts` 中的 `LOGO_ICON` 路径
    - 确保 `/public/icon/logo.svg` 文件存在且正确
    - _Requirements: 1.1, 1.3, 1.5_
  - [ ] 1.2 添加鲁港通品牌 Logo 文件
    - 创建 `/public/icon/logo.png` (PNG 格式)
    - 创建 `/public/imgs/chat/lugang_banner.svg` (横幅 Logo)
    - 更新 `/public/favicon.ico`
    - _Requirements: 1.1, 1.2, 1.5_
  - [ ] 1.3 更新聊天界面 Banner 配置
    - 修改 `src/pageComponents/chat/constants.ts` 中的默认 Banner URL
    - _Requirements: 1.1_

- [ ] 2. 管理员登录路由修复
  - [x] 2.1 修复登录后路由逻辑
    - 修改 `src/pages/login/index.tsx`
    - 根据用户角色直接跳转到正确页面，避免闪烁
    - 管理员 → `/dashboard/agent`
    - 普通用户 → `/chat`
    - _Requirements: 3.1, 3.2_
  - [x] 2.2 修复首页路由逻辑
    - 修改 `src/pages/index.tsx`
    - 移除中间跳转逻辑，直接重定向到登录页
    - _Requirements: 3.1, 3.2_
  - [ ] 2.3 编写角色路由一致性测试
    - **Property 3: 角色路由一致性**
    - **Validates: Requirements 3.1, 3.2, 3.5**

- [ ] 3. 登录/注册页面港话通风格改造
  - [ ] 3.1 创建港话通风格登录页面组件
    - 创建 `src/pageComponents/login/LugangLoginPage.tsx`
    - 淡蓝色主题（替代粉红色）
    - 鲁港通 Logo 和品牌名称
    - 手机预览图展示
    - _Requirements: 1.3, 2.1_
  - [ ] 3.2 实现登录表单样式
    - 卡片式设计，淡蓝色阴影
    - 邮箱/手机号输入框
    - 蓝色登录按钮
    - 注册链接
    - _Requirements: 2.1, 2.2_
  - [ ] 3.3 实现注册表单
    - 邮箱注册表单
    - 验证码输入
    - 密码设置
    - _Requirements: 2.2, 2.3, 2.5, 2.6_
  - [ ] 3.4 编写邮箱格式验证测试
    - **Property 1: 邮箱格式验证**
    - **Validates: Requirements 2.5**

- [ ] 4. 聊天欢迎页实现
  - [ ] 4.1 创建欢迎页组件
    - 创建 `src/pageComponents/chat/WelcomePage.tsx`
    - 淡蓝色光晕背景效果
    - 居中问候语显示
    - _Requirements: 7.5_
  - [ ] 4.2 实现问候语交替显示
    - 普通话/粤语问候语配置
    - 3秒间隔交替动画
    - _Requirements: 7.5_
  - [ ] 4.3 实现快捷功能按钮
    - 淡蓝色主题按钮样式
    - 支持配置关联应用/知识库
    - 点击发送预设提示词
    - _Requirements: 7.2_
  - [ ] 4.4 实现欢迎页到聊天界面的切换
    - 发送第一条消息后隐藏欢迎页
    - 显示正常聊天界面
    - _Requirements: 7.3_

- [ ] 5. 普通用户聊天界面优化
  - [ ] 5.1 隐藏管理功能入口
    - 修改 `src/components/Layout/navbar.tsx`
    - 普通用户隐藏应用管理、知识库等入口
    - _Requirements: 7.1_
  - [ ] 5.2 实现简化用户菜单
    - 头像下拉菜单：额度显示、充值入口、退出登录
    - _Requirements: 7.2_
  - [ ] 5.3 编写普通用户界面权限测试
    - **Property 8: 普通用户界面权限**
    - **Validates: Requirements 7.1**

- [ ] 6. Checkpoint - 界面功能验证
  - 确保所有界面修改正常工作
  - 测试管理员和普通用户登录流程
  - 验证欢迎页显示和切换逻辑
  - 确保所有测试通过，如有问题请询问用户

- [ ] 7. One API 用户同步集成
  - [ ] 7.1 创建 One API 集成服务
    - 创建 `src/service/integration/oneapi.ts`
    - 实现用户创建 API 调用
    - 实现额度查询 API 调用
    - _Requirements: 8.1, 8.3_
  - [ ] 7.2 修改用户注册流程
    - 在 FastGPT 注册成功后同步创建 One API 用户
    - 分配初始额度
    - _Requirements: 2.4, 8.1_
  - [ ] 7.3 编写用户同步测试
    - **Property 2: 用户注册双系统同步**
    - **Validates: Requirements 2.4, 8.1, 8.3**

- [ ] 8. 额度显示与充值功能
  - [ ] 8.1 实现额度查询接口
    - 创建 `src/pages/api/integration/oneapi/quota.ts`
    - 从 One API 获取用户额度
    - _Requirements: 4.1_
  - [ ] 8.2 在用户菜单显示额度
    - 修改用户头像下拉菜单
    - 显示当前剩余额度
    - _Requirements: 4.1_
  - [ ] 8.3 实现充值跳转
    - 点击充值按钮跳转到 One API 充值页面
    - _Requirements: 4.2_
  - [ ] 8.4 编写额度同步测试
    - **Property 4: 额度同步一致性**
    - **Validates: Requirements 4.5, 8.2**

- [ ] 9. 额度不足提示
  - [ ] 9.1 实现额度检查逻辑
    - 在发送消息前检查用户额度
    - _Requirements: 4.4_
  - [ ] 9.2 实现额度不足提示 UI
    - 显示友好的提示信息
    - 提供充值入口
    - _Requirements: 4.4_

- [ ] 10. Checkpoint - 用户系统验证
  - 确保用户注册同步到 One API
  - 验证额度显示正确
  - 测试充值跳转功能
  - 确保所有测试通过，如有问题请询问用户

- [ ] 11. 管理员用户管理功能
  - [ ] 11.1 创建用户列表接口
    - 创建 `src/pages/api/admin/users.ts`
    - 支持分页和搜索
    - _Requirements: 5.1, 5.2_
  - [ ] 11.2 创建用户管理页面
    - 创建 `src/pages/admin/users/index.tsx`
    - 用户列表表格
    - 搜索功能
    - _Requirements: 5.1, 5.2, 5.5_
  - [ ] 11.3 实现用户禁用功能
    - 禁用/启用用户
    - 同步禁用 One API 用户
    - _Requirements: 5.3, 8.5_
  - [ ] 11.4 编写用户搜索测试
    - **Property 6: 用户搜索准确性**
    - **Validates: Requirements 5.2**
  - [ ] 11.5 编写用户禁用同步测试
    - **Property 5: 用户禁用同步**
    - **Validates: Requirements 5.3, 8.5**

- [ ] 12. 配置管理功能
  - [ ] 12.1 创建注册配置页面
    - 创建 `src/pages/admin/config/register.tsx`
    - 邮箱注册开关和 SMTP 配置
    - _Requirements: 6.1, 6.2_
  - [ ] 12.2 编写配置生效测试
    - **Property 7: 配置即时生效**
    - **Validates: Requirements 6.5**

- [ ] 13. Final Checkpoint - 完整功能验证
  - 确保所有功能正常工作
  - 验证品牌化显示正确
  - 测试完整用户流程（注册→登录→聊天→充值）
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 任务按优先级排序：品牌化修复 → 界面改造 → 用户系统 → 管理功能
- 所有测试任务均为必选，确保完整的测试覆盖
- 每个 Checkpoint 后应确保前面的功能稳定
- 域名配置（Requirement 9）已完成，不在任务列表中
