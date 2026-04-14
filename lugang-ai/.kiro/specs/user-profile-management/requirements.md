# Requirements Document

## Introduction

鲁港通用户信息管理功能，包含两个方向：

1. **普通用户侧**：修复"获取账户信息失败"错误，并扩展账户信息面板，支持查看/修改个人资料（姓名、昵称、手机号、邮箱、通讯地址），显示与鲁港通后端同步的剩余额度（tokens），以及充值入口（预留 Stripe 接口，暂不实现支付）。

2. **管理员侧**：在用户管理功能栏支持点击普通用户，查看并修改该用户的所有信息，包括密码。

所有用户信息变更需与鲁港通后端（One API）保持同步。

## Glossary

- **鲁港通前端**: 基于 FastGPT 二开的前端服务，域名 www.airscend.com
- **鲁港通后端**: 基于 One API 的后端服务，域名 api.airscend.com
- **普通用户**: 非管理员（root）的登录用户
- **管理员**: 拥有 root 权限的用户
- **额度（Quota）**: 鲁港通后端中用户可用的 token 数量，单位为 One API 内部单位
- **UserProfile**: 用户个人资料，包含姓名、昵称、手机号、邮箱、通讯地址
- **AccountInfoModal**: 账户信息弹窗组件
- **UserSettingsPanel**: 用户设置面板组件
- **AdminUserDetailModal**: 管理员查看/编辑用户详情的弹窗组件

## Requirements

### Requirement 1: 修复账户信息获取失败

**User Story:** As a 普通用户, I want 打开账户信息面板时不出现"获取账户信息失败"错误, so that 我可以正常查看自己的账户信息。

#### Acceptance Criteria

1. WHEN 普通用户打开账户信息弹窗, THE AccountInfoModal SHALL 通过 `/api/integration/oneapi/quota` 接口获取额度信息（不再调用不存在的 `/api/user/account-info` 接口）
2. IF 鲁港通后端无法连接或返回错误, THEN THE AccountInfoModal SHALL 显示默认值（额度为 0）而非错误提示
3. WHEN 额度数据加载中, THE AccountInfoModal SHALL 显示加载状态（Spinner）
4. WHEN 额度数据加载完成, THE AccountInfoModal SHALL 显示剩余额度数值

### Requirement 2: 用户个人资料查看与修改

**User Story:** As a 普通用户, I want 在账户信息面板中查看并修改我的个人资料, so that 我的信息保持最新且准确。

#### Acceptance Criteria

1. WHEN 普通用户打开账户信息弹窗, THE AccountInfoModal SHALL 显示当前用户的姓名、昵称、手机号、邮箱、通讯地址
2. WHEN 普通用户修改个人资料并提交, THE System SHALL 将变更保存到鲁港通前端数据库
3. WHEN 普通用户修改个人资料并提交, THE System SHALL 将变更同步到鲁港通后端（用户名/邮箱字段）
4. IF 提交的邮箱格式不合法, THEN THE AccountInfoModal SHALL 显示验证错误提示并阻止提交
5. IF 提交的手机号格式不合法, THEN THE AccountInfoModal SHALL 显示验证错误提示并阻止提交
6. WHEN 个人资料保存成功, THE AccountInfoModal SHALL 显示成功提示（Toast）

### Requirement 3: 额度显示与充值入口

**User Story:** As a 普通用户, I want 在账户信息面板中看到我的剩余额度并能进入充值页面, so that 我可以及时了解并补充使用额度。

#### Acceptance Criteria

1. WHEN 普通用户打开账户信息弹窗, THE AccountInfoModal SHALL 显示从鲁港通后端获取的剩余额度（remainingQuota）
2. WHEN 普通用户打开账户信息弹窗, THE AccountInfoModal SHALL 显示总额度（quota）和已用额度（usedQuota）
3. THE AccountInfoModal SHALL 显示一个充值按钮
4. WHEN 普通用户点击充值按钮, THE System SHALL 在新标签页打开鲁港通后端充值页面（`https://api.airscend.com/topup`）
5. WHERE Stripe 支付接口已配置, THE System SHALL 支持通过 Stripe 完成充值（当前阶段预留接口，不实现）

### Requirement 4: 管理员查看用户详情

**User Story:** As a 管理员, I want 在用户管理列表中点击普通用户查看其完整信息, so that 我可以了解用户的账户状态。

#### Acceptance Criteria

1. WHEN 管理员在用户管理列表点击某个用户行, THE AdminUserDetailModal SHALL 打开并显示该用户的详细信息
2. THE AdminUserDetailModal SHALL 显示用户的用户名、姓名、昵称、手机号、邮箱、通讯地址、账户状态、注册时间
3. THE AdminUserDetailModal SHALL 显示该用户在鲁港通后端的剩余额度
4. IF 鲁港通后端无法获取该用户额度, THEN THE AdminUserDetailModal SHALL 显示"暂无数据"而非报错

### Requirement 5: 管理员修改用户信息

**User Story:** As a 管理员, I want 在用户详情弹窗中修改用户的所有信息包括密码, so that 我可以帮助用户处理账户问题。

#### Acceptance Criteria

1. WHEN 管理员在 AdminUserDetailModal 中修改用户信息并保存, THE System SHALL 将变更保存到鲁港通前端数据库
2. WHEN 管理员在 AdminUserDetailModal 中修改用户信息并保存, THE System SHALL 将变更同步到鲁港通后端
3. WHEN 管理员在 AdminUserDetailModal 中设置新密码并保存, THE System SHALL 更新该用户在鲁港通前端的密码（bcrypt 加密）
4. WHEN 管理员在 AdminUserDetailModal 中设置新密码并保存, THE System SHALL 同步更新该用户在鲁港通后端的密码
5. IF 管理员输入的新密码少于 8 位, THEN THE AdminUserDetailModal SHALL 显示验证错误并阻止提交
6. WHEN 用户信息修改成功, THE AdminUserDetailModal SHALL 显示成功提示（Toast）
7. THE AdminUserDetailModal SHALL 不允许修改 root 用户的信息
