# Requirements Document

## Introduction

本文档定义了鲁港通 AI 平台聊天显示优化的需求。目标是解决当前聊天界面中存在的显示问题，包括图片引用失败、搜索结果质量控制、思考模式显示优化、Markdown 渲染问题以及引用内容显示控制。

## Glossary

- **Chat_Display**: 聊天显示组件，负责渲染 AI 回复内容
- **Thinking_Mode**: 深度思考模式，显示 AI 的推理过程
- **Citation**: 引用标记，显示 AI 回复中引用的来源
- **Markdown_Renderer**: Markdown 渲染器，负责将 Markdown 格式转换为 HTML
- **Search_Filter**: 搜索过滤器，控制联网搜索的结果来源
- **Image_Reference**: 图片引用功能，在 AI 回复中显示图片

## Requirements

### Requirement 1: 修复图片引用显示

**User Story:** As a 鲁港通用户, I want AI 回复中完全不显示图片, so that 避免显示带有第三方联系方式或不合规内容的图片。

#### Acceptance Criteria

1. WHEN AI 回复包含图片引用（Markdown 或 HTML 格式）THEN THE Chat_Display SHALL 完全移除图片元素
2. THE Chat_Display SHALL 不显示图片链接、alt 文本或任何图片相关提示
3. THE Chat_Display SHALL 静默处理图片内容，不留任何痕迹
4. WHEN 用户上传图片作为输入 THEN THE Chat_Display SHALL 正常处理（此功能不受影响）
5. THE AI_Model SHALL 通过 System Prompt 被指导使用文字描述而非图片引用

### Requirement 2: 思考模式内容控制

**User Story:** As a 鲁港通用户, I want 思考模式只显示推理逻辑或答案大纲, so that 我不会在思考阶段就看到完整答案，避免重复阅读和过长等待。

#### Acceptance Criteria

1. WHEN AI 生成思考内容 THEN THE AI_Model SHALL 只输出推理逻辑框架和答案大纲
2. THE AI_Model SHALL NOT 在思考模式中输出完整的答案内容
3. THE AI_Model SHALL 在思考模式中使用简洁的要点形式（如：步骤1、步骤2）
4. WHEN 思考模式完成 THEN THE AI_Model SHALL 在最终答案中提供完整详细的内容
5. THE Chat_Display SHALL 保持现有的展开/折叠功能（不需要新增按钮）

### Requirement 3: 思考模式背景色修复

**User Story:** As a 鲁港通用户, I want 思考模式和最终答案有明显的视觉区分, so that 我可以清楚地识别哪部分是思考过程，哪部分是最终答案。

#### Acceptance Criteria

1. WHEN 显示思考模式内容 THEN THE Chat_Display SHALL 使用灰色背景（如 #F7F8FA）
2. WHEN 显示最终答案内容 THEN THE Chat_Display SHALL 使用与页面背景一致的颜色（白色或透明）
3. THE Chat_Display SHALL 在思考模式和最终答案之间添加明显的分隔线或间距
4. THE Chat_Display SHALL 确保样式不会互相污染（思考模式的样式不影响最终答案）
5. WHEN 用户切换主题（深色/浅色）THEN THE Chat_Display SHALL 自动调整背景色以保持对比度

### Requirement 4: Markdown 表格渲染修复

**User Story:** As a 鲁港通用户, I want 表格内容正确渲染, so that 我可以清晰地阅读表格数据。

#### Acceptance Criteria

1. WHEN AI 回复包含 Markdown 表格 THEN THE Markdown_Renderer SHALL 正确渲染表格结构
2. THE Markdown_Renderer SHALL 移除表格单元格中的 `<br>` 标签
3. WHEN 表格单元格需要换行 THEN THE Markdown_Renderer SHALL 使用 CSS 控制换行而非 HTML 标签
4. THE Markdown_Renderer SHALL 确保表格单元格内容正确对齐
5. THE Markdown_Renderer SHALL 支持表格内的文本自动换行（word-wrap）
6. WHEN 表格内容过长 THEN THE Markdown_Renderer SHALL 提供横向滚动功能

### Requirement 5: 隐藏引用内容

**User Story:** As a 鲁港通普通用户, I want 不看到引用来源的详细信息, so that 界面更简洁，专注于 AI 的回答内容。

#### Acceptance Criteria

1. WHEN AI 回复包含引用 THEN THE Chat_Display SHALL 不显示引用标记（如 [1], [2]）给普通用户
2. THE Chat_Display SHALL 不显示引用来源列表给普通用户
3. WHEN 管理员用户登录 THEN THE Chat_Display SHALL 可选择显示引用内容（通过配置控制）
4. THE Chat_Display SHALL 保留引用数据在后台（用于审计和调试）
5. THE Chat_Display SHALL 自动移除回复文本中的引用标记（如 [1], [2]）
6. WHEN 引用标记被移除 THEN THE Chat_Display SHALL 确保文本内容仍然连贯可读

### Requirement 6: 响应式显示优化

**User Story:** As a 鲁港通用户, I want 在不同设备上都能良好显示聊天内容, so that 我可以在手机和电脑上都能舒适阅读。

#### Acceptance Criteria

1. THE Chat_Display SHALL 在移动端自动调整表格宽度
2. THE Chat_Display SHALL 在移动端自动调整思考模式区域的显示
3. WHEN 在小屏幕设备上 THEN THE Chat_Display SHALL 优先显示最终答案，折叠思考过程
4. THE Chat_Display SHALL 确保所有文本内容在移动端可读（字体大小适中）

## Technical Notes

### 前端相关文件
- 聊天显示组件：`lugang-ai/projects/app/src/components/ChatBox/`
- Markdown 渲染器：`lugang-ai/packages/web/components/Markdown/`
- 引用解析器：可能在 `lugang-ai/projects/app/src/web/core/chat/utils.ts`

### 后端相关文件
- 搜索过滤逻辑：可能需要在工作流节点配置中添加
- 联网搜索接口：`lugang-connect-enterprise/relay/adaptor/ali/`

### 配置项
- 可能需要添加系统配置项：
  - `enableCitationDisplay`: 是否显示引用内容（默认 false，管理员可设为 true）
  - `imageProxyUrl`: 图片代理服务器地址（用于解决跨域问题）
  - `thinkingModePrompt`: 思考模式的 system prompt（指导 AI 只输出推理框架）

## Priority

1. **高优先级**：Requirement 3（背景色修复）、Requirement 4（表格渲染）、Requirement 5（隐藏引用）
2. **中优先级**：Requirement 1（图片显示修复）、Requirement 2（思考模式内容控制）
3. **低优先级**：Requirement 6（响应式优化）

## Dependencies

- Requirement 1 可能需要配置图片代理或 CORS 设置
- Requirement 2 需要在 AI 模型的 system prompt 或工作流配置中实现
- Requirement 3 和 Requirement 4 需要同时修改以确保一致性
- Requirement 4 依赖于 Markdown 渲染器的实现
- Requirement 5 需要修改前端显示逻辑，不影响后端数据
