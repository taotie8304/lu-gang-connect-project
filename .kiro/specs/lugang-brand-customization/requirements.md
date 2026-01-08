# Requirements Document

## Introduction

本文档定义了将 Lobe Chat 定制为"鲁港通跨境AI服务平台"的完整需求。

**核心目标：** 建立拥有自主知识产权的鲁港通跨境AI服务平台，用于获取政府认可度、融资和投资。

**关键原则：**
- 必须移除所有第三方品牌标识（Lobe、OpenAI 等）
- 代码中不能出现任何除了鲁港通之外的标识
- 保留核心 AI 功能，但使用中国境内可用的服务

## 项目架构背景

当前系统由两个组件组成：

1. **lugang-connect-enterprise** (Go 后端) - http://156.225.30.134:8080/
   - 提供 AI 模型管理（DeepSeek、通义千问等）
   - 用户管理、权限控制、计费系统
   - 作为 OpenAI 兼容的 API 代理服务

2. **lugang-chat-custom** (前端聊天界面) - 基于 Lobe Chat 二次开发
   - 通过 `OPENAI_PROXY_URL` 连接到后端
   - 当前版本：1.82.8，需升级到 1.143.2
   - 需要完整的品牌定制化

**当前已配置（通过环境变量）：**
- 模型列表已限制为 4 个模型
- 已设置品牌标题和描述
- 已禁用部分 Provider

**仍需解决的问题：**
- 源代码中的 Lobe/OpenAI 品牌元素未移除
- 界面上仍显示第三方品牌内容
- 远程资源拉取导致性能问题
- 版本需要升级融合

**版本升级说明：** 需要将当前版本 (1.82.8) 升级融合到新版本 (1.143.2)，同时保持品牌定制化修改。

## Glossary

- **System**: 鲁港通跨境AI服务平台
- **User**: 使用鲁港通平台的终端用户
- **Specified_Models**: 指定的可用模型列表（DeepSeek对话、通义千问Plus、通义千问Turbo、通义千问Max）
- **Default_Model**: 默认模型（通义千问Max）
- **Lugang_Brand**: 鲁港通品牌标识、链接和内容（参考 http://156.225.30.134:8080/about）
- **Discovery_Content**: 发现页面展示的新闻资讯内容（来源：https://www.news.gov.hk/chi/rss/index.html）
- **China_Services**: 中国境内可用的 AI 服务（DeepSeek、阿里通义等）

## 需要保留的核心功能

以下功能必须保留，但需要移除所有 Lobe/OpenAI 品牌标识：

1. **智能联网搜索** - 实时联网访问，获取新闻、数据、趋势等
2. **思维链 (CoT)** - AI 推理过程可视化
3. **分支对话** - 延续模式和独立模式的对话分支
4. **白板 (Artifacts)** - 实时创建 SVG、HTML、文档等内容
5. **文件上传/知识库** - 多类型文件上传和知识库管理
6. **模型视觉识别** - 使用 DeepSeek/阿里的视觉识别能力（非 OpenAI）
7. **TTS & STT 语音会话** - 仅保留中国境内可用的语音服务
8. **文生图 (Text to Image)** - 文本到图片生成
9. **插件系统 (Tools Calling)** - 保留插件功能，移除 Lobe 标识
10. **渐进式 Web 应用 (PWA)** - 桌面和移动端优化体验
11. **移动设备适配** - 移动端用户体验优化

## Requirements

### Requirement 1: 模型选择限制

**User Story:** As a 系统管理员, I want 限制用户可选择的模型, so that 用户只能使用中国境内可用的指定模型。

#### Acceptance Criteria

1. WHEN 用户打开设置页面 THEN THE System SHALL 仅显示以下模型：DeepSeek对话、通义千问Plus、通义千问Turbo、通义千问Max
2. WHEN 用户点击聊天框左上角模型选择器 THEN THE System SHALL 仅显示指定的四个模型
3. WHEN 用户点击紫色图标 THEN THE System SHALL 仅显示指定的四个模型
4. WHEN 用户创建新对话 THEN THE System SHALL 默认使用"通义千问Max"模型
5. WHEN 用户点击助手查看详情 THEN THE System SHALL 仅在模型选择中显示指定的四个模型
6. THE System SHALL 移除所有 OpenAI、Azure、Anthropic 等境外模型的配置选项

### Requirement 2: 移除所有第三方品牌元素

**User Story:** As a 系统管理员, I want 移除所有第三方品牌元素, so that 平台完全呈现鲁港通自主品牌形象。

#### Acceptance Criteria

1. WHEN 用户打开语音服务设置 THEN THE System SHALL 不显示任何 OpenAI/Microsoft Edge Speech 相关选项
2. WHEN 用户查看系统助手 THEN THE System SHALL 不显示任何 OpenAI/Lobe 字样
3. WHEN 用户浏览任何页面 THEN THE System SHALL 不显示 OpenAI/Lobe/LobeHub 品牌标识或名称
4. THE System SHALL 在代码中移除所有 lobehub.com、openai.com 等第三方域名引用
5. THE System SHALL 将所有 "LobeChat" 文字替换为 "鲁港通AI"

### Requirement 3: 鲁港通品牌定制

**User Story:** As a 系统管理员, I want 将所有品牌元素替换为鲁港通品牌, so that 平台完全呈现鲁港通自主知识产权形象。

#### Acceptance Criteria

1. WHEN 用户打开关于页面 THEN THE System SHALL 显示鲁港通品牌信息（参考 http://156.225.30.134:8080/about）
2. WHEN 用户查看文件管理功能 THEN THE System SHALL 显示鲁港通品牌字样
3. WHEN 用户查看页面左下角 THEN THE System SHALL 不显示任何外部链接
4. WHEN 用户查看任何页面标题或 Logo THEN THE System SHALL 显示鲁港通品牌
5. THE System SHALL 更新 package.json 中的名称、描述、作者等信息为鲁港通
6. THE System SHALL 更新所有元数据（meta tags、manifest 等）为鲁港通品牌

### Requirement 4: 发现页面内容定制

**User Story:** As a 用户, I want 在发现页面看到相关的新闻资讯, so that 我可以获取山东/香港经济贸易教育投资等权威信息。

#### Acceptance Criteria

1. WHEN 用户点击发现按钮 THEN THE System SHALL 显示来自香港政府新闻网的 RSS 资讯（https://www.news.gov.hk/chi/rss/index.html）
2. WHEN 发现页面加载 THEN THE System SHALL 不显示原有的 Lobe 助手市场、插件市场等内容
3. WHEN 用户浏览发现页面 THEN THE System SHALL 展示经济贸易、教育、投资、身份规划等分类内容
4. WHEN 发现页面显示新闻 THEN THE System SHALL 链接到香港政府新闻网等官方站点
5. THE System SHALL 移除所有指向 chat-agents.lobehub.com 的请求

### Requirement 5: 移除不需要的功能入口

**User Story:** As a 系统管理员, I want 移除不需要的功能入口, so that 用户界面更简洁。

#### Acceptance Criteria

1. THE System SHALL 移除页面左下角的所有外部链接（GitHub、Discord 等）
2. THE System SHALL 隐藏指向 Lobe 官方的扩展插件市场入口
3. IF 文件管理功能未完全实现 THEN THE System SHALL 隐藏入口或显示"即将推出"
4. THE System SHALL 保留插件系统功能，但移除 Lobe 插件市场链接

### Requirement 6: 性能优化

**User Story:** As a 用户, I want 平台响应迅速, so that 我可以流畅地使用各项功能。

#### Acceptance Criteria

1. WHEN 用户从设置切换到聊天页面 THEN THE System SHALL 在 2 秒内完成页面切换
2. WHEN 用户点击发现按钮 THEN THE System SHALL 在 3 秒内显示内容
3. WHEN 用户点击文件管理 THEN THE System SHALL 在 2 秒内响应
4. WHEN 用户新建助手并点击 THEN THE System SHALL 立即响应并跳转到聊天界面
5. WHEN 用户点击聊天按钮 THEN THE System SHALL 不出现长时间转圈等待
6. THE System SHALL 禁用所有对 Lobe 远程服务器的请求以提升性能

### Requirement 7: 禁用远程资源拉取

**User Story:** As a 系统管理员, I want 禁止平台拉取 Lobe 的远程资源, so that 平台性能更快且完全独立。

#### Acceptance Criteria

1. WHEN 平台启动 THEN THE System SHALL 不请求以下远程 API：
   - chat-agents.lobehub.com
   - chat-plugins.lobehub.com
   - registry.npmmirror.com/@lobehub/*
2. WHEN 用户使用任何功能 THEN THE System SHALL 不从 Lobe 服务器获取数据
3. THE System SHALL 将 AGENTS_INDEX_URL 配置为空或本地地址
4. THE System SHALL 将 PLUGINS_INDEX_URL 配置为空或本地地址
5. THE System SHALL 移除所有 lobehub.com 域名的硬编码引用

### Requirement 8: 语音服务本地化

**User Story:** As a 系统管理员, I want 语音服务使用中国境内可用的服务, so that 用户可以正常使用 TTS/STT 功能。

#### Acceptance Criteria

1. THE System SHALL 移除 OpenAI Audio 语音选项
2. THE System SHALL 移除 Microsoft Edge Speech 语音选项（如果在中国不可用）
3. THE System SHALL 配置使用中国境内可用的 TTS/STT 服务（如阿里云语音、讯飞等）
4. WHEN 用户使用语音功能 THEN THE System SHALL 提供高品质的中文语音体验

### Requirement 9: 视觉识别模型配置

**User Story:** As a 系统管理员, I want 视觉识别使用中国境内可用的模型, so that 用户可以正常使用图片识别功能。

#### Acceptance Criteria

1. THE System SHALL 移除 OpenAI gpt-4-vision 模型配置
2. THE System SHALL 配置使用 DeepSeek 或阿里通义的视觉识别模型
3. WHEN 用户上传图片 THEN THE System SHALL 使用中国境内模型进行识别
4. THE System SHALL 确保视觉识别功能正常工作

### Requirement 10: 界面元素清理

**User Story:** As a 系统管理员, I want 移除所有不需要的界面元素, so that 界面简洁且符合鲁港通品牌。

#### Acceptance Criteria

1. THE System SHALL 移除页面左下角的 GitHub/Discord/Twitter 等外部链接
2. THE System SHALL 移除所有指向 lobehub.com 的链接
3. THE System SHALL 移除关于页面中的 Lobe 团队信息
4. WHEN 用户查看关于页面 THEN THE System SHALL 显示鲁港通的版权信息和联系方式
5. THE System SHALL 更新 favicon 和 logo 为鲁港通品牌图标

### Requirement 11: 版本升级融合

**User Story:** As a 系统管理员, I want 将当前版本升级到最新版本, so that 平台可以获得最新功能和性能优化。

#### Acceptance Criteria

1. THE System SHALL 从版本 1.82.8 升级到版本 1.143.2
2. WHEN 版本升级完成 THEN THE System SHALL 保留所有品牌定制化修改
3. WHEN 版本升级完成 THEN THE System SHALL 保留模型限制配置
4. WHEN 版本升级完成 THEN THE System SHALL 移除所有第三方品牌引用
5. THE System SHALL 确保升级后以下核心功能正常运行：
   - 智能联网搜索
   - 思维链 (CoT)
   - 分支对话
   - 白板 (Artifacts)
   - 文件上传/知识库
   - 视觉识别
   - TTS/STT 语音会话
   - 文生图
   - 插件系统
   - PWA
   - 移动端适配

### Requirement 12: 代码级品牌清理

**User Story:** As a 系统管理员, I want 代码中不出现任何第三方品牌标识, so that 平台具有完全的自主知识产权。

#### Acceptance Criteria

1. THE System SHALL 在所有源代码文件中移除 "LobeChat"、"Lobe"、"lobehub" 字样
2. THE System SHALL 在所有源代码文件中移除 "OpenAI" 字样（保留必要的 API 调用代码）
3. THE System SHALL 更新所有注释中的品牌引用为鲁港通
4. THE System SHALL 更新所有错误消息中的品牌引用为鲁港通
5. THE System SHALL 确保 git 提交历史不影响最终产品的品牌呈现

## 参考资源

- 鲁港通品牌信息：http://156.225.30.134:8080/about
- 香港政府新闻 RSS：https://www.news.gov.hk/chi/rss/index.html
- Lobe Chat 开发文档（仅供技术参考）：https://github.com/lobehub/lobe-chat/blob/next/README.zh-CN.md
