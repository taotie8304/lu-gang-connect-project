# Requirements Document

## Introduction

鲁港通跨境AI智能平台的引用系统优化，解决三个核心问题：
1. 知识库返回不相关引用（如问签证问题却引用公司注册处文档）
2. 联网搜索结果未显示网络来源 URL，仅显示知识库引用
3. 社交媒体视频引用缺少预览图和直接跳转功能

## Glossary

- **Citation_System**: 引用系统，负责在 AI 回答下方展示来源信息
- **Knowledge_Base_Citation**: 知识库引用，来自 FastGPT 知识库搜索结果的引用
- **Web_Citation**: 联网搜索引用，来自模型联网搜索（阿里百炼 enable_search）返回的网络来源
- **Video_Citation**: 视频引用，来自社交媒体平台（YouTube、抖音、B站等）的视频链接引用
- **Relevance_Score**: 相关性分数，知识库搜索结果与用户问题的匹配度
- **Similarity_Threshold**: 相似度阈值，用于过滤低相关性搜索结果
- **Search_Result_Metadata**: 联网搜索结果元数据，包含 URL、标题、摘要等信息
- **OG_Metadata**: Open Graph 元数据，网页中用于社交分享的标题、描述、图片等信息
- **ResponseTags**: 前端引用渲染组件，位于 AI 回答下方

## Requirements

### Requirement 1: 知识库引用相关性过滤

**User Story:** As a 普通用户, I want 只看到与我问题相关的知识库引用, so that 引用信息对我有参考价值而非干扰。

#### Acceptance Criteria

1. WHEN 知识库搜索返回结果, THE Citation_System SHALL 根据 Relevance_Score 过滤低相关性结果
2. WHEN 引用的 Relevance_Score 低于 Similarity_Threshold, THE Citation_System SHALL 不在前端展示该引用
3. THE Citation_System SHALL 支持管理员在工作流中配置 Similarity_Threshold 值
4. WHEN 所有知识库搜索结果均低于阈值, THE Citation_System SHALL 不显示知识库引用区域
5. THE Citation_System SHALL 保留管理员查看全部引用的能力（不受阈值过滤影响）

### Requirement 2: 联网搜索来源引用展示

**User Story:** As a 普通用户, I want 看到 AI 联网搜索查阅的网页来源, so that 我可以验证信息来源并进一步阅读。

#### Acceptance Criteria

1. WHEN 模型使用联网搜索（enable_search）回答问题, THE Citation_System SHALL 解析模型返回的搜索结果元数据
2. WHEN 联网搜索结果包含来源 URL, THE Citation_System SHALL 在引用区域展示网页标题和 URL
3. WHEN 用户点击联网搜索引用, THE Citation_System SHALL 在新标签页打开来源 URL
4. THE Citation_System SHALL 区分显示知识库引用和联网搜索引用（使用不同图标或标签）
5. WHEN 同时存在知识库引用和联网搜索引用, THE Citation_System SHALL 分组展示两类引用
6. THE Citation_System SHALL 从阿里百炼 API 响应中提取 search_results 字段的 URL 和标题信息

### Requirement 3: 视频引用富媒体展示

**User Story:** As a 普通用户, I want 看到视频引用的预览图和标题, so that 我可以快速判断视频内容并直接跳转观看。

#### Acceptance Criteria

1. WHEN 引用 URL 指向已知视频平台（YouTube、抖音、B站、小红书等）, THE Citation_System SHALL 识别为视频引用
2. WHEN 识别到视频引用, THE Citation_System SHALL 展示视频缩略图预览
3. WHEN 识别到视频引用, THE Citation_System SHALL 展示视频标题
4. WHEN 用户点击视频引用, THE Citation_System SHALL 在新标签页打开原始视频页面
5. THE Citation_System SHALL 通过 OG_Metadata 获取视频缩略图和标题信息
6. IF OG_Metadata 获取失败, THEN THE Citation_System SHALL 使用平台默认图标和 URL 作为降级展示

### Requirement 4: 阿里百炼联网搜索结果透传

**User Story:** As a 系统开发者, I want 鲁港通后端正确透传阿里百炼的联网搜索结果, so that 前端可以获取完整的搜索来源信息。

#### Acceptance Criteria

1. WHEN 阿里百炼返回包含 search_results 的响应, THE Lugang_Backend SHALL 将 search_results 透传到鲁港通前端
2. THE Lugang_Backend SHALL 在 CompatChatResponse 中保留 search_results 字段
3. THE Lugang_Frontend SHALL 解析响应中的 search_results 并转换为 Web_Citation 格式
4. WHEN search_results 为空, THE Citation_System SHALL 不显示联网搜索引用区域
5. THE search_results 透传 SHALL 同时支持流式和非流式响应模式
