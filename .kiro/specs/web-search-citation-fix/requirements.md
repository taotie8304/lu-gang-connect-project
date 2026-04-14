# Requirements Document

## Introduction

鲁港通跨境AI智能平台使用阿里百炼模型进行联网搜索回答。当模型联网搜索后，回答文本中会包含数字引用序号（如 `[1]`、`[2]`），但底部引用区域经常无法显示对应的网页链接地址。用户看到引用序号却找不到来源，体验很差。

本需求旨在彻底解决联网搜索引用显示不完整的问题，确保回答中的每个引用序号都能在底部找到对应的网页链接。

## Glossary

- **Citation_Parser**: 联网搜索引用解析器，负责从 AI 响应中提取网页引用数据
- **Citation_Renderer**: 引用渲染组件，负责在聊天界面底部显示引用链接列表
- **Search_Info**: 阿里百炼模型返回的联网搜索结果元数据，包含 `search_results` 数组
- **Inline_Reference**: AI 回答文本中的内联引用标记，如 `[1]`、`[2]`
- **One_API**: 鲁港通后端 AI 模型网关，负责转发 AI API 请求
- **Fallback_Parser**: 当 Search_Info 不可用时，从回答文本中提取引用的备用解析器

## Requirements

### Requirement 1: 联网搜索引用数据提取

**User Story:** As a 用户, I want 联网搜索的引用数据被完整提取, so that 底部引用区域能显示所有网页来源。

#### Acceptance Criteria

1. WHEN Search_Info 字段存在于 AI 响应中, THE Citation_Parser SHALL 从 search_results 数组中提取所有网页引用（包含 index、title、url）
2. WHEN Search_Info 字段不存在（被 One_API 转发丢弃）, THE Fallback_Parser SHALL 从回答文本中提取数字引用序号并尝试匹配对应的网页链接
3. WHEN 回答文本中包含 `[title](url)` 格式的 markdown 链接, THE Fallback_Parser SHALL 提取这些链接作为联网搜索引用
4. WHEN 回答文本中仅包含纯数字引用（如 `[1]`、`[2]`）且无 Search_Info, THE Citation_Parser SHALL 保留这些数字引用序号信息以便前端处理
5. IF 提取到的引用数据中存在重复 URL, THEN THE Citation_Parser SHALL 按 URL 去重后返回唯一引用列表

### Requirement 2: 内联引用序号与底部引用的对应关系

**User Story:** As a 用户, I want 回答中的引用序号与底部引用列表一一对应, so that 我能通过序号找到对应的网页来源。

#### Acceptance Criteria

1. WHEN 底部引用列表显示联网搜索引用, THE Citation_Renderer SHALL 按照 AI 模型返回的 index 顺序排列引用
2. WHEN 回答文本中包含数字引用（如 `[1]`）且底部有对应的联网搜索引用, THE Citation_Renderer SHALL 确保底部引用的序号与文本中的引用序号一致
3. WHEN 联网搜索引用数据不可用但回答文本中有数字引用序号, THE Citation_Renderer SHALL 在底部显示提示信息而非空白区域

### Requirement 3: 前端引用渲染优化

**User Story:** As a 用户, I want 联网搜索引用在底部清晰展示, so that 我能方便地查看和点击引用来源。

#### Acceptance Criteria

1. WHEN 联网搜索引用存在, THE Citation_Renderer SHALL 显示引用序号、标题和可点击的链接
2. WHEN 用户点击联网搜索引用, THE Citation_Renderer SHALL 在新标签页中打开对应的网页地址
3. WHEN 回答同时包含知识库引用和联网搜索引用, THE Citation_Renderer SHALL 分别展示两类引用，联网搜索引用带有明确的来源标识

### Requirement 4: 回答文本中无效引用序号的清理

**User Story:** As a 用户, I want 回答中不出现无法对应到来源的引用序号, so that 我不会感到困惑。

#### Acceptance Criteria

1. WHEN 回答文本中包含数字引用序号（如 `[1]`）且对应的联网搜索引用数据可用, THE Citation_Parser SHALL 保留这些引用序号
2. WHEN 回答文本中包含数字引用序号但无任何联网搜索引用数据, THE Citation_Parser SHALL 移除这些孤立的数字引用序号
3. IF 部分引用序号有对应数据而部分没有, THEN THE Citation_Parser SHALL 仅移除无对应数据的引用序号
