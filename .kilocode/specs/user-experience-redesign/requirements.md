# Requirements Document

## Introduction

鲁港通用户体验重构项目，旨在实现类似"港话通"的用户体验。普通用户注册/登录后直接进入简洁的聊天界面，使用管理员配置好的 AI 助手；管理员则进入完整的管理后台。同时实现前后端用户信息同步、账户管理、知识库权限控制等功能。

## Glossary

- **Lugang_Frontend**: 鲁港通前端应用 (www.airscend.com)，基于 FastGPT 二开
- **Lugang_Backend**: 鲁港通后端服务 (api.airscend.com)，基于 One API
- **Admin_User**: 管理员用户，username 为 'root' 的用户
- **Normal_User**: 普通用户，非 root 的注册用户
- **Share_Link**: 分享链接，管理员创建的公开聊天入口
- **Knowledge_Base**: 知识库，存储文档和数据的集合
- **Citation**: 引用，AI 回答中引用的来源信息

## Requirements

### Requirement 1: 用户角色路由

**User Story:** As a user, I want to be redirected to the appropriate interface based on my role, so that I can access the features relevant to me.

#### Acceptance Criteria

1. WHEN a Normal_User logs in or registers, THE Lugang_Frontend SHALL redirect them to the default Share_Link chat interface
2. WHEN an Admin_User logs in, THE Lugang_Frontend SHALL redirect them to the management dashboard
3. THE Lugang_Frontend SHALL determine user role by checking if username equals 'root'
4. WHEN the default Share_Link is not configured, THE Lugang_Frontend SHALL display an error message to Normal_User

### Requirement 2: 普通用户聊天界面

**User Story:** As a normal user, I want a clean chat interface with quick action buttons, so that I can easily interact with the AI assistant.

#### Acceptance Criteria

1. WHEN a Normal_User enters the chat interface, THE Lugang_Frontend SHALL display the AI assistant configured by Admin_User
2. THE Lugang_Frontend SHALL display quick action buttons (domain selection) as configured in the workflow
3. WHEN a Normal_User clicks a quick action button, THE Lugang_Frontend SHALL send the corresponding prompt to the AI
4. THE Lugang_Frontend SHALL display chat history for the current user session
5. WHEN a Normal_User sends a message, THE Lugang_Frontend SHALL stream the AI response in real-time

### Requirement 3: 用户设置面板

**User Story:** As a normal user, I want to access my account settings from the chat interface, so that I can manage my profile and preferences.

#### Acceptance Criteria

1. WHEN a Normal_User clicks on their avatar in the bottom-left corner, THE Lugang_Frontend SHALL open a settings panel
2. THE Settings_Panel SHALL display the following menu items in order:
   - 活動中心 (Activity Center)
   - 語言 (Language)
   - 修改密碼 (Change Password)
   - 產品反饋 (Product Feedback)
   - 輔助使用設計 (Accessibility)
   - 使用條款 (Terms of Use)
   - 隱私政策 (Privacy Policy)
   - 個人資料收集聲明 (Personal Data Collection Statement)
   - 登出 (Logout)
3. WHEN a Normal_User clicks logout, THE Lugang_Frontend SHALL clear the session and redirect to login page

### Requirement 3.1: 活動中心 (Activity Center)

**User Story:** As a platform operator, I want to display marketing activities to users, so that I can promote business campaigns.

#### Acceptance Criteria

1. WHEN a Normal_User clicks 活動中心, THE Lugang_Frontend SHALL display a list of active campaigns
2. THE Admin_User SHALL be able to add, edit, and delete activity content from the admin dashboard
3. THE Activity_Content SHALL support: title, description, image, link, start_date, end_date
4. THE Lugang_Frontend SHALL only display activities within their valid date range
5. WHEN no activities are available, THE Lugang_Frontend SHALL display "暫無活動" message

### Requirement 3.2: 語言切換 (Language Switch)

**User Story:** As a user, I want to switch the interface language, so that I can use the platform in my preferred language.

#### Acceptance Criteria

1. WHEN a Normal_User clicks 語言, THE Lugang_Frontend SHALL display available language options
2. THE Language_Options SHALL include: 简体中文, 繁體中文, English, and other languages available in the source code
3. WHEN a user selects a language, THE Lugang_Frontend SHALL immediately switch the interface language
4. THE Lugang_Frontend SHALL persist the language preference for future sessions

### Requirement 3.3: 修改密碼 (Change Password)

**User Story:** As a user, I want to change my password directly from the settings panel, so that I can maintain account security.

#### Acceptance Criteria

1. WHEN a Normal_User clicks 修改密碼, THE Lugang_Frontend SHALL display a password change form
2. THE Password_Form SHALL require: current password, new password, confirm new password
3. THE Lugang_Frontend SHALL validate new password meets security requirements (uppercase, lowercase, numbers, 8-20 characters)
4. WHEN passwords match and validation passes, THE System SHALL update password in both frontend and backend
5. WHEN password change succeeds, THE Lugang_Frontend SHALL display success message and close the form

### Requirement 3.4: 產品反饋 (Product Feedback)

**User Story:** As a user, I want to send feedback about the product, so that I can report issues or suggestions.

#### Acceptance Criteria

1. WHEN a Normal_User clicks 產品反饋, THE Lugang_Frontend SHALL open the user's email client
2. THE Email SHALL be pre-addressed to service@airscend.com
3. THE Email subject SHALL be pre-filled with "鲁港通产品反馈"

### Requirement 3.5: 輔助使用設計 (Accessibility)

**User Story:** As a user, I want to know about accessibility features, so that I can get help if needed.

#### Acceptance Criteria

1. WHEN a Normal_User clicks 輔助使用設計, THE Lugang_Frontend SHALL display a modal with the following text:
   "本流動用應用程式已適當地採用輔助使用設計。如對本流動應用程式在使用上有任何查詢或意見，請發送電郵地址至 service@airscend.com 與我們聯繫。"
2. THE Modal SHALL have a close button to dismiss it

### Requirement 3.6: 使用條款 (Terms of Use)

**User Story:** As a user, I want to read the terms of use, so that I understand the platform rules.

#### Acceptance Criteria

1. WHEN a Normal_User clicks 使用條款, THE Lugang_Frontend SHALL display the terms of use content
2. THE Admin_User SHALL be able to update the terms of use content from the admin dashboard
3. THE Terms_Content SHALL support rich text formatting (markdown or HTML)

### Requirement 3.7: 隱私政策 (Privacy Policy)

**User Story:** As a user, I want to read the privacy policy, so that I understand how my data is handled.

#### Acceptance Criteria

1. WHEN a Normal_User clicks 隱私政策, THE Lugang_Frontend SHALL display the privacy policy content
2. THE Admin_User SHALL be able to update the privacy policy content from the admin dashboard
3. THE Privacy_Content SHALL support rich text formatting (markdown or HTML)

### Requirement 3.8: 個人資料收集聲明 (Personal Data Collection Statement)

**User Story:** As a user, I want to read the data collection statement, so that I understand what data is collected.

#### Acceptance Criteria

1. WHEN a Normal_User clicks 個人資料收集聲明, THE Lugang_Frontend SHALL display the data collection statement
2. THE Admin_User SHALL be able to update the statement content from the admin dashboard
3. THE Statement_Content SHALL support rich text formatting (markdown or HTML)

### Requirement 4: 知识库引用权限控制

**User Story:** As a platform operator, I want to control what citation information users can see, so that I can protect proprietary knowledge base content.

#### Acceptance Criteria

1. WHEN an AI response contains citations, THE Lugang_Frontend SHALL display citation information based on user role
2. FOR Normal_User, THE Lugang_Frontend SHALL only display URL citations (external links)
3. FOR Normal_User, THE Lugang_Frontend SHALL NOT display knowledge base file names or content
4. FOR Normal_User, THE Lugang_Frontend SHALL NOT allow downloading or viewing knowledge base files
5. FOR Admin_User, THE Lugang_Frontend SHALL display all citation information including file names and content
6. FOR Admin_User, THE Lugang_Frontend SHALL allow viewing and downloading knowledge base files
7. WHEN a Normal_User clicks a URL citation, THE Lugang_Frontend SHALL open the URL in a new browser tab

### Requirement 5: 前后端用户同步

**User Story:** As a platform operator, I want user information synchronized between frontend and backend, so that I can manage all users from a single dashboard.

#### Acceptance Criteria

1. WHEN a new user registers on Lugang_Frontend, THE System SHALL create a corresponding user in Lugang_Backend
2. THE User_Sync SHALL include: username, email, phone (if provided), display_name
3. WHEN user information is updated on Lugang_Frontend, THE System SHALL sync changes to Lugang_Backend
4. WHEN user sync fails, THE System SHALL log the error but not block the user operation
5. THE Admin_User SHALL be able to view all synced users in Lugang_Backend user management

### Requirement 6: 用户信息扩展

**User Story:** As a user, I want to provide additional profile information, so that the platform can better serve my needs.

#### Acceptance Criteria

1. THE User_Profile SHALL support the following fields: name, username, phone (required), email (required), birth_date, address, google_account
2. WHEN a user registers, THE Lugang_Frontend SHALL require phone and email fields
3. THE Lugang_Frontend SHALL validate email format before submission
4. THE Lugang_Frontend SHALL validate phone format (Chinese mobile number) before submission
5. WHEN a user updates profile, THE System SHALL sync changes to Lugang_Backend

### Requirement 7: 账户管理功能

**User Story:** As a normal user, I want to manage my account settings, so that I can control my subscription and billing.

#### Acceptance Criteria

1. THE Account_Management SHALL allow users to change their password
2. WHEN a user changes password, THE System SHALL validate the new password meets security requirements
3. THE Account_Management SHALL display the user's current subscription plan
4. THE Account_Management SHALL display the user's current balance/quota
5. THE Account_Management SHALL provide a recharge/top-up function
6. WHEN a user initiates recharge, THE System SHALL redirect to the payment interface

### Requirement 8: 密码修改

**User Story:** As a user, I want to change my password securely, so that I can maintain account security.

#### Acceptance Criteria

1. WHEN a user requests password change, THE Lugang_Frontend SHALL require current password verification
2. THE Lugang_Frontend SHALL require new password to contain uppercase, lowercase, and numbers (8-20 characters)
3. THE Lugang_Frontend SHALL require password confirmation to match new password
4. WHEN password change succeeds, THE System SHALL update password in both Lugang_Frontend and Lugang_Backend
5. WHEN password change fails, THE Lugang_Frontend SHALL display appropriate error message

### Requirement 9: 订阅与余额查询

**User Story:** As a user, I want to view my subscription status and balance, so that I can manage my usage.

#### Acceptance Criteria

1. THE Lugang_Frontend SHALL fetch subscription information from Lugang_Backend
2. THE Subscription_Info SHALL display: plan name, plan status, expiration date
3. THE Balance_Info SHALL display: current balance, usage quota, remaining quota
4. WHEN balance is low, THE Lugang_Frontend SHALL display a warning notification
5. THE Lugang_Frontend SHALL refresh subscription/balance information periodically

### Requirement 10: 充值功能

**User Story:** As a user, I want to recharge my account, so that I can continue using the AI services.

#### Acceptance Criteria

1. THE Recharge_Function SHALL display available recharge packages
2. WHEN a user selects a package, THE Lugang_Frontend SHALL initiate payment process
3. THE Payment_Process SHALL support common payment methods (WeChat Pay, Alipay)
4. WHEN payment succeeds, THE System SHALL update user balance in Lugang_Backend
5. WHEN payment succeeds, THE Lugang_Frontend SHALL refresh and display updated balance
6. WHEN payment fails, THE Lugang_Frontend SHALL display error message and allow retry

