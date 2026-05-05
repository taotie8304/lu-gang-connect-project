# Requirements Document

## Introduction

本文档定义了鲁港通 AI 平台的用户前端界面需求。目标是将当前"管理后台优先"的设计改为"聊天界面优先"的用户体验，参考港话通（HKChat）的设计风格。

## 参考产品

港话通 (HKChat): https://chat.hkchat.app/

## 核心设计理念

- 普通用户登录后直接进入简洁的聊天界面
- 用户不能选择模型，由管理员预设的智能路由自动处理
- 管理员通过工作流配置"什么问题用什么模型回答"
- 管理员通过特定入口访问完整后台

## Glossary

- **User_Interface**: 普通用户看到的前端聊天界面
- **Admin_Dashboard**: 管理员后台，包含应用配置、模型管理等
- **Chat_View**: 聊天主界面，包含对话输入和历史记录
- **Settings_Modal**: 用户设置弹窗，包含基本账户设置
- **Sidebar**: 侧边栏，包含对话历史和用户信息
- **Landing_Page**: 落地页/登录页

## Requirements

### Requirement 1: 用户登录流程简化

**User Story:** As a 普通用户, I want 登录后直接进入聊天界面, so that 我可以立即开始使用 AI 对话功能。

#### Acceptance Criteria

1. WHEN 用户访问平台首页 THEN THE User_Interface SHALL 显示简洁的落地页或直接跳转到登录页
2. WHEN 用户完成登录 THEN THE User_Interface SHALL 直接跳转到聊天界面而非管理后台
3. THE User_Interface SHALL 支持多种登录方式（邮箱、手机、第三方OAuth）
4. WHEN 用户未登录访问聊天页面 THEN THE User_Interface SHALL 重定向到登录页

### Requirement 2: 简洁聊天界面

**User Story:** As a 普通用户, I want 一个简洁的聊天界面, so that 我可以专注于与 AI 对话。

#### Acceptance Criteria

1. THE Chat_View SHALL 显示居中的欢迎语和输入框
2. THE Chat_View SHALL 在顶部中央显示鲁港通 Logo
3. THE Chat_View SHALL 在右上角提供新建对话按钮
4. THE Chat_View SHALL 在左上角提供侧边栏切换按钮
5. WHEN 用户输入消息 THEN THE Chat_View SHALL 显示对话内容
6. THE Chat_View SHALL 支持图片上传和语音输入功能
7. THE Chat_View SHALL 在输入框上方显示功能快捷按钮（可选）

### Requirement 3: 侧边栏功能

**User Story:** As a 普通用户, I want 通过侧边栏管理对话历史, so that 我可以查看和切换历史对话。

#### Acceptance Criteria

1. THE Sidebar SHALL 默认隐藏，通过按钮切换显示
2. WHEN 侧边栏展开 THEN THE Sidebar SHALL 显示对话历史列表
3. THE Sidebar SHALL 提供对话搜索功能
4. THE Sidebar SHALL 在底部显示当前登录用户信息
5. WHEN 用户点击历史对话 THEN THE Chat_View SHALL 加载该对话内容
6. THE Sidebar SHALL 支持删除历史对话

### Requirement 4: 用户设置弹窗

**User Story:** As a 普通用户, I want 通过简单的设置菜单管理账户, so that 我可以修改基本设置而不需要进入复杂后台。

#### Acceptance Criteria

1. WHEN 用户点击头像或用户名 THEN THE Settings_Modal SHALL 弹出设置菜单
2. THE Settings_Modal SHALL 包含以下选项：
   - 个人中心（头像、昵称）
   - 语言设置
   - 主题设置（可选）
   - 退出登录
3. THE Settings_Modal SHALL 不显示模型配置、应用管理等管理员功能
4. THE Settings_Modal SHALL 显示当前版本号

### Requirement 5: 管理员入口分离

**User Story:** As a 管理员, I want 通过特定入口访问完整后台, so that 普通用户不会看到复杂的管理功能。

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL 通过特定 URL 路径访问（如 /admin）
2. WHEN 非管理员用户访问管理后台 THEN THE User_Interface SHALL 显示无权限提示或重定向
3. THE Admin_Dashboard SHALL 保留所有现有的管理功能
4. WHEN 管理员登录 THEN THE User_Interface SHALL 提供进入管理后台的入口

### Requirement 6: 智能路由与默认应用配置

**User Story:** As a 管理员, I want 配置智能路由规则让系统自动选择合适的模型回答用户问题, so that 用户无需关心技术细节即可获得最佳回答。

#### Acceptance Criteria

1. THE User_Interface SHALL 使用管理员预设的默认应用进行对话
2. THE Lugang_Platform SHALL 支持通过工作流配置问题分类和模型路由规则
3. WHEN 用户提问 THEN THE Lugang_Platform SHALL 根据管理员配置的路由规则自动选择合适的模型/应用
4. THE User_Interface SHALL 不显示模型选择、应用切换等功能给普通用户
5. THE User_Interface SHALL 不显示应用创建、编辑等管理功能给普通用户

### Requirement 7: 响应式设计

**User Story:** As a 用户, I want 在不同设备上都能良好使用, so that 我可以在手机和电脑上都能使用平台。

#### Acceptance Criteria

1. THE User_Interface SHALL 适配桌面端和移动端
2. WHEN 在移动端访问 THEN THE Chat_View SHALL 自动调整布局
3. THE Sidebar SHALL 在移动端以抽屉形式展示
