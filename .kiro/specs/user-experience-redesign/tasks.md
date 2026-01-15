# Implementation Plan: 鲁港通用户体验重构

## Overview

本实现计划分为四个阶段：
1. 第一阶段：用户角色路由和基础聊天界面
2. 第二阶段：用户设置面板
3. 第三阶段：知识库权限控制和用户同步
4. 第四阶段：账户管理和充值功能

## Tasks

### 第一阶段：用户角色路由和基础聊天界面

- [x] 1. 配置默认分享链接环境变量
  - 在 `.env.local` 添加 `NEXT_PUBLIC_DEFAULT_SHARE_ID`
  - _Requirements: 1.1, 1.4_

- [-] 2. 实现用户角色路由逻辑
  - [x] 2.1 修改 `src/pages/index.tsx` 实现角色判断
    - 判断 username === 'root' 为管理员
    - 管理员跳转 `/dashboard/agent`
    - 普通用户跳转 `/chat/share?shareId={shareId}`
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 2.2 编写用户角色判断的属性测试
    - **Property 1: User Role Routing**
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 3. Checkpoint - 确保角色路由正常工作
  - 测试 root 用户登录跳转到管理后台
  - 测试普通用户登录跳转到聊天界面

### 第二阶段：用户设置面板

- [ ] 4. 创建用户设置面板组件
  - [ ] 4.1 创建 `src/components/UserSettingsPanel/index.tsx`
    - 实现面板 UI 和菜单列表
    - 包含所有 9 个菜单项
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 4.2 集成到聊天界面
    - 在左下角用户头像添加点击事件
    - 打开设置面板
    - _Requirements: 3.1_

- [ ] 5. 实现语言切换功能
  - [ ] 5.1 创建语言选择组件
    - 显示可用语言列表
    - 调用 i18n 切换语言
    - _Requirements: 3.2.1, 3.2.2, 3.2.3_
  
  - [ ] 5.2 实现语言偏好持久化
    - 保存到 localStorage 和用户配置
    - _Requirements: 3.2.4_
  
  - [ ] 5.3 编写语言偏好持久化属性测试
    - **Property 7: Language Preference Persistence**
    - **Validates: Requirements 3.2.3, 3.2.4**

- [ ] 6. 实现修改密码功能
  - [ ] 6.1 创建密码修改表单组件
    - 当前密码、新密码、确认密码输入框
    - _Requirements: 3.3.1, 3.3.2_
  
  - [ ] 6.2 实现密码验证逻辑
    - 验证密码规则（大小写、数字、8-20位）
    - _Requirements: 3.3.3_
  
  - [ ] 6.3 创建密码修改 API
    - 验证当前密码
    - 更新前端和后端密码
    - _Requirements: 3.3.4, 3.3.5_
  
  - [ ] 6.4 编写密码验证属性测试
    - **Property 3: Password Validation Rules**
    - **Validates: Requirements 3.3.3, 8.2**

- [ ] 7. 实现产品反馈功能
  - 创建 mailto 链接到 service@airscend.com
  - _Requirements: 3.4.1, 3.4.2, 3.4.3_

- [ ] 8. 实现辅助使用设计弹窗
  - 创建模态框显示无障碍说明文字
  - _Requirements: 3.5.1, 3.5.2_

- [ ] 9. 实现内容管理功能
  - [ ] 9.1 创建系统内容数据模型
    - SystemContent Schema (terms_of_use, privacy_policy, data_collection)
    - _Requirements: 3.6, 3.7, 3.8_
  
  - [ ] 9.2 创建内容管理 API
    - GET /api/system/content/{key} - 获取内容
    - PUT /api/system/content/{key} - 更新内容（管理员）
    - _Requirements: 3.6.2, 3.7.2, 3.8.2_
  
  - [ ] 9.3 创建内容显示组件
    - 支持 Markdown 渲染
    - _Requirements: 3.6.3, 3.7.3, 3.8.3_

- [ ] 10. 实现活动中心功能
  - [ ] 10.1 创建活动数据模型
    - Activity Schema
    - _Requirements: 3.1.2, 3.1.3_
  
  - [ ] 10.2 创建活动管理 API
    - CRUD 操作
    - 按日期过滤
    - _Requirements: 3.1.2, 3.1.4_
  
  - [ ] 10.3 创建活动列表组件
    - 显示有效活动
    - 空状态显示
    - _Requirements: 3.1.1, 3.1.5_
  
  - [ ] 10.4 编写活动日期过滤属性测试
    - **Property 6: Activity Date Filtering**
    - **Validates: Requirements 3.1.4**

- [ ] 11. Checkpoint - 确保设置面板所有功能正常
  - 测试所有菜单项点击
  - 测试语言切换
  - 测试密码修改

### 第三阶段：知识库权限控制和用户同步

- [ ] 12. 实现知识库引用权限控制
  - [ ] 12.1 修改引用显示组件
    - 根据用户角色过滤引用类型
    - 普通用户只显示 URL 类型
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ] 12.2 禁止普通用户查看/下载知识库文件
    - 移除文件链接和下载按钮
    - _Requirements: 4.4_
  
  - [ ] 12.3 管理员保留完整权限
    - 显示所有引用类型
    - 允许查看和下载
    - _Requirements: 4.5, 4.6_
  
  - [ ] 12.4 编写引用权限过滤属性测试
    - **Property 2: Citation Permission Filtering**
    - **Validates: Requirements 4.2, 4.3, 4.4**

- [ ] 13. 实现前后端用户同步
  - [ ] 13.1 创建用户同步服务
    - `src/service/integration/userSync.ts`
    - _Requirements: 5.1, 5.2_
  
  - [ ] 13.2 修改注册 API 添加同步逻辑
    - 注册成功后同步到后端
    - 同步失败不阻塞注册
    - _Requirements: 5.3, 5.4_
  
  - [ ] 13.3 修改用户更新 API 添加同步逻辑
    - 信息更新后同步到后端
    - _Requirements: 5.3_
  
  - [ ] 13.4 编写用户同步属性测试
    - **Property 4: User Sync Data Integrity**
    - **Validates: Requirements 5.1, 5.2**

- [ ] 14. 实现用户信息扩展
  - [ ] 14.1 创建用户扩展字段模型
    - UserExtension Schema
    - _Requirements: 6.1_
  
  - [ ] 14.2 修改注册表单
    - 添加电话（必填）和邮箱（必填）字段
    - _Requirements: 6.2_
  
  - [ ] 14.3 实现字段验证
    - 邮箱格式验证
    - 手机号格式验证
    - _Requirements: 6.3, 6.4_
  
  - [ ] 14.4 编写用户资料验证属性测试
    - **Property 5: User Profile Validation**
    - **Validates: Requirements 6.3, 6.4**

- [ ] 15. Checkpoint - 确保权限控制和用户同步正常
  - 测试普通用户看不到知识库文件
  - 测试管理员可以看到完整引用
  - 测试用户注册后后端有对应记录

### 第四阶段：账户管理和充值功能

- [ ] 16. 实现订阅和余额查询
  - [ ] 16.1 创建后端 API 调用服务
    - 获取用户订阅信息
    - 获取用户余额信息
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ] 16.2 创建订阅/余额显示组件
    - 显示计划名称、状态、到期日期
    - 显示余额、配额、剩余配额
    - _Requirements: 9.2, 9.3_
  
  - [ ] 16.3 实现余额不足提醒
    - 低余额时显示警告
    - _Requirements: 9.4_

- [ ] 17. 实现充值功能
  - [ ] 17.1 创建充值套餐显示组件
    - 显示可用套餐列表
    - _Requirements: 10.1_
  
  - [ ] 17.2 集成支付接口
    - 微信支付 / 支付宝
    - _Requirements: 10.2, 10.3_
  
  - [ ] 17.3 实现支付回调处理
    - 更新用户余额
    - 刷新显示
    - _Requirements: 10.4, 10.5_

- [ ] 18. 最终 Checkpoint
  - 完整流程测试
  - 确保所有测试通过

## Notes

- 所有测试任务都是必须完成的
- 每个阶段完成后进行 Checkpoint 验证
- 属性测试使用 fast-check 库
- 每个属性测试运行最少 100 次迭代

