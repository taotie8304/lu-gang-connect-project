# Requirements Document

## Introduction

本文档定义了鲁港通跨境AI智能平台的完整功能需求，包括品牌化完善、用户系统、充值系统、以及 FastGPT 与 One API 的深度集成。目标是打造一个面向普通用户的简洁聊天平台，同时为管理员提供完整的后台管理功能。

## Glossary

- **FastGPT**: 鲁港通跨境AI智能平台的前端应用，提供聊天界面和应用管理
- **One_API**: API 管理和分发系统，负责用户额度、充值、令牌管理
- **普通用户**: 通过注册登录使用聊天功能的终端用户
- **管理员**: 拥有后台管理权限的用户（root 或被授权的管理员）
- **额度**: 用户可使用的 API 调用配额，以 tokens 计算
- **兑换码**: 用于充值额度的一次性代码

## Requirements

### Requirement 1: 品牌化完善

**User Story:** As a 用户, I want 看到完整的鲁港通品牌标识, so that 我能识别这是鲁港通官方平台。

#### Acceptance Criteria

1. WHEN 用户访问聊天界面 THEN THE System SHALL 在左上角显示鲁港通 Logo 图片
2. WHEN 用户查看模型列表 THEN THE System SHALL 为每个模型显示正确的图标
3. WHEN 用户访问登录页面 THEN THE System SHALL 显示鲁港通品牌 Logo 和名称
4. THE System SHALL 在所有页面的页脚显示"鲁港通科技"版权信息
5. WHEN 用户查看浏览器标签 THEN THE System SHALL 显示"鲁港通跨境AI智能平台"标题和 favicon

### Requirement 2: 用户注册系统

**User Story:** As a 新用户, I want 能够注册账号, so that 我可以使用平台的聊天功能。

#### Acceptance Criteria

1. WHEN 用户访问登录页面 THEN THE System SHALL 显示"注册"链接
2. WHEN 用户点击注册 THEN THE System SHALL 提供邮箱注册方式
3. WHEN 用户提交注册信息 THEN THE System SHALL 发送验证邮件
4. WHEN 用户完成邮箱验证 THEN THE System SHALL 创建用户账号并分配初始额度
5. IF 用户输入无效邮箱格式 THEN THE System SHALL 显示错误提示并阻止提交
6. IF 邮箱已被注册 THEN THE System SHALL 提示用户该邮箱已存在

### Requirement 3: 用户登录与界面路由

**User Story:** As a 已注册用户, I want 登录后直接进入聊天界面, so that 我可以快速开始使用。

#### Acceptance Criteria

1. WHEN 普通用户登录成功 THEN THE System SHALL 重定向到聊天界面
2. WHEN 管理员用户登录成功 THEN THE System SHALL 重定向到管理后台
3. WHEN 普通用户点击"个人中心" THEN THE System SHALL 显示简化的用户信息页面
4. WHEN 管理员点击"个人中心" THEN THE System SHALL 显示完整的管理后台
5. THE System SHALL 根据用户角色显示不同的菜单选项

### Requirement 4: 用户额度与充值系统（One API 集成）

**User Story:** As a 用户, I want 能够查看和充值我的使用额度, so that 我可以持续使用平台服务。

#### Acceptance Criteria

1. WHEN 用户查看个人中心 THEN THE System SHALL 显示当前剩余额度
2. WHEN 用户点击充值 THEN THE System SHALL 跳转到 One API 的充值页面
3. WHEN 用户输入有效兑换码 THEN THE System SHALL 增加用户额度
4. IF 用户额度不足 THEN THE System SHALL 在聊天时提示充值
5. THE System SHALL 同步 FastGPT 用户与 One API 用户的额度信息

### Requirement 5: 管理员后台 - 用户管理

**User Story:** As a 管理员, I want 管理平台用户, so that 我可以维护用户秩序和服务质量。

#### Acceptance Criteria

1. WHEN 管理员访问用户管理页面 THEN THE System SHALL 显示所有用户列表
2. WHEN 管理员搜索用户 THEN THE System SHALL 支持按用户名、邮箱搜索
3. WHEN 管理员禁用用户 THEN THE System SHALL 阻止该用户登录
4. WHEN 管理员调整用户额度 THEN THE System SHALL 更新用户的可用额度
5. THE System SHALL 显示每个用户的注册时间、最后登录时间、使用额度

### Requirement 6: 管理员后台 - 注册渠道配置

**User Story:** As a 管理员, I want 配置用户注册方式, so that 我可以控制用户如何注册平台。

#### Acceptance Criteria

1. WHEN 管理员访问注册配置页面 THEN THE System SHALL 显示可用的注册方式列表
2. THE System SHALL 支持配置邮箱注册（开启/关闭、SMTP 设置）
3. THE System SHALL 支持配置手机号注册（开启/关闭、短信服务设置）
4. THE System SHALL 支持配置第三方登录（微信、支付宝等）
5. WHEN 管理员保存配置 THEN THE System SHALL 立即生效

### Requirement 7: 聊天界面优化

**User Story:** As a 普通用户, I want 简洁的聊天界面, so that 我可以专注于对话而不被复杂功能干扰。

#### Acceptance Criteria

1. WHEN 普通用户进入聊天界面 THEN THE System SHALL 隐藏应用管理、知识库等管理功能
2. THE System SHALL 在聊天界面显示简化的用户菜单（个人中心、充值、退出）
3. WHEN 用户发送消息 THEN THE System SHALL 显示清晰的对话气泡
4. THE System SHALL 支持移动端响应式布局
5. WHEN 聊天界面加载 THEN THE System SHALL 显示欢迎语和使用提示

### Requirement 8: FastGPT 与 One API 用户同步

**User Story:** As a 系统架构师, I want FastGPT 和 One API 用户系统联动, so that 用户只需一次注册即可使用所有功能。

#### Acceptance Criteria

1. WHEN 用户在 FastGPT 注册 THEN THE System SHALL 自动在 One API 创建对应用户
2. WHEN 用户在 One API 充值 THEN THE System SHALL 同步额度到 FastGPT
3. THE System SHALL 使用统一的用户标识关联两个系统
4. IF One API 用户不存在 THEN THE System SHALL 自动创建并关联
5. WHEN 用户被禁用 THEN THE System SHALL 同时禁用两个系统的账号

### Requirement 9: 域名与安全配置

**User Story:** As a 运维人员, I want 配置正式域名和 HTTPS, so that 平台可以安全稳定地对外服务。

#### Acceptance Criteria

1. THE System SHALL 通过 www.airscend.com 访问 FastGPT 主站
2. THE System SHALL 通过 api.airscend.com 访问 One API 管理后台
3. THE System SHALL 支持 HTTPS 加密访问
4. WHEN 用户通过 HTTP 访问 THEN THE System SHALL 自动重定向到 HTTPS
5. THE System SHALL 正确配置 CORS 允许跨域请求
