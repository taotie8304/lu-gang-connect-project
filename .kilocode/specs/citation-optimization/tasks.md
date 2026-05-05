# Implementation Plan: 引用系统优化

## Overview

分三个阶段实现：知识库引用过滤 → 联网搜索来源透传 → 视频富媒体展示。每个阶段独立可交付。

## Tasks

### 第一阶段：知识库引用相关性过滤

- [x] 1. 实现知识库引用相关性过滤
  - [x] 1.1 在 ResponseTags 组件中添加分数过滤逻辑
    - 修改 `lugang-ai/projects/app/src/components/core/chat/ChatContainer/ChatBox/components/ResponseTags.tsx`
    - 在 `citationRenderList` 的 `useMemo` 中，对普通用户的 `uniqueQuoteItems` 增加 score 过滤
    - 从 `feConfigs` 读取 `citationRelevanceThreshold`，默认 0.4
    - 管理员（isRoot）不受过滤影响
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 1.2 添加 citationRelevanceThreshold 配置项
    - 修改 `lugang-ai/packages/global/common/system/types/index.d.ts` 添加 `citationRelevanceThreshold?: number`
    - 在系统配置中添加默认值
    - _Requirements: 1.3_

  - [x] 1.3 编写引用过滤属性测试
    - **Property 1: 知识库引用相关性过滤**
    - **Validates: Requirements 1.1, 1.2, 1.5**

- [x] 2. Checkpoint - 验证知识库引用过滤
  - 确保普通用户只看到高相关性引用
  - 确保管理员看到全部引用
  - 确保所有测试通过，如有问题请询问用户

### 第二阶段：联网搜索来源透传与展示

- [x] 3. 后端：启用阿里百炼搜索来源返回
  - [x] 3.1 修改 ConvertCompatRequest 添加 search_options
    - 修改 `lugang-connect-enterprise/relay/adaptor/ali/main.go`
    - 当 `enableSearch=true` 时，设置 `SearchOptions.EnableSource = true`
    - _Requirements: 4.1, 4.2_

  - [x] 3.2 确认流式响应透传 search_info
    - 检查 `lugang-connect-enterprise/relay/adaptor/openai/main.go` 的 `StreamHandler`
    - 确认包含 `search_info` 的 SSE chunk 被正确透传（当前 `render.StringData(c, data)` 应已处理）
    - 如需修改，确保 `search_info` chunk 不被过滤
    - _Requirements: 4.5_

- [x] 4. 前端：定义联网搜索引用类型
  - [x] 4.1 添加 WebSearchCitation 类型定义
    - 修改 `lugang-ai/packages/global/core/chat/type.d.ts`
    - 添加 `WebSearchCitation` 类型（index, title, url, icon, siteName）
    - 在 `ChatHistoryItemResType` 中添加 `webSearchCitations?: WebSearchCitation[]`
    - _Requirements: 2.1_

  - [x] 4.2 解析 LLM 响应中的 search_info
    - 修改 `lugang-ai/packages/service/core/ai/llm/request.ts`
    - 在 `createStreamResponse` 和 `createCompleteResponse` 中捕获 `search_info` 字段
    - 将 `search_results` 转换为 `WebSearchCitation[]` 并返回
    - _Requirements: 2.1, 2.6, 4.3_

  - [x] 4.3 将 webSearchCitations 传递到 responseData
    - 修改 `lugang-ai/packages/service/core/workflow/dispatch/ai/chat.ts`
    - 将 `createLLMResponse` 返回的 `webSearchCitations` 写入 `responseData`
    - _Requirements: 4.3_

  - [x] 4.4 编写搜索结果解析属性测试
    - **Property 2: 联网搜索结果解析**
    - **Validates: Requirements 2.1, 2.6, 4.3**

- [x] 5. 前端：渲染联网搜索引用
  - [x] 5.1 修改 addStatisticalDataToHistoryItem 提取 webSearchCitations
    - 修改 `lugang-ai/projects/app/src/global/core/chat/utils.ts`
    - 从 `flatResData` 中提取 `webSearchCitations` 字段
    - _Requirements: 2.1_

  - [x] 5.2 修改 ResponseTags 组件渲染联网搜索引用
    - 修改 `lugang-ai/projects/app/src/components/core/chat/ChatContainer/ChatBox/components/ResponseTags.tsx`
    - 将 `webSearchCitations` 转换为 `CitationRenderItem[]`，type 为 'web'
    - 在引用列表中分组展示：知识库引用在前，联网搜索引用在后
    - 联网搜索引用使用地球图标，点击在新标签页打开 URL
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 5.3 编写引用分组属性测试
    - **Property 4: 引用分组正确性**
    - **Validates: Requirements 2.4, 2.5**

- [x] 6. Checkpoint - 验证联网搜索引用展示
  - 确保联网搜索时显示来源 URL
  - 确保知识库引用和联网搜索引用分组展示
  - 确保所有测试通过，如有问题请询问用户

### 第三阶段：视频引用富媒体展示

- [x] 7. 实现视频平台识别和富媒体展示
  - [x] 7.1 创建视频平台识别工具函数
    - 创建 `lugang-ai/packages/global/common/string/videoUtils.ts`
    - 实现 `detectVideoPlatform(url)` 函数，识别 YouTube/B站/抖音/小红书
    - 实现 `getVideoThumbnail(url)` 函数，返回缩略图 URL（YouTube 直接构造，其他降级）
    - _Requirements: 3.1, 3.5, 3.6_

  - [x] 7.2 修改 ResponseTags 支持视频引用卡片
    - 修改 `ResponseTags.tsx`
    - 对识别为视频的引用，渲染带缩略图的卡片样式
    - 缩略图加载失败时降级为平台图标
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 7.3 编写视频平台识别属性测试
    - **Property 3: 视频平台识别与缩略图生成**
    - **Validates: Requirements 3.1, 3.5**

- [x] 8. Final Checkpoint - 完整功能验证
  - 验证知识库引用过滤正常
  - 验证联网搜索来源展示正常
  - 验证视频引用富媒体展示正常
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 三个阶段独立可交付，可以分批部署
- 属性测试使用 fast-check 库，最少 100 次迭代
- 所有代码注释使用 `// 鲁港通 - xxx` 格式
