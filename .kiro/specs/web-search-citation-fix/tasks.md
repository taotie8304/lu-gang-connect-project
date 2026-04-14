# Implementation Plan: 联网搜索引用修复

## Overview

修复联网搜索引用显示不完整的问题。采用多层防御策略：增强 Citation_Parser 的 fallback 能力，新增裸数字引用提取和孤立引用清理功能，确保回答中的每个引用序号都能在底部找到对应链接。

## Tasks

- [x] 1. 增强 Citation_Parser 解析能力
  - [x] 1.1 在 searchInfoParser.ts 中新增 `extractBareNumberReferences` 函数
    - 从回答文本中提取 `[1]`、`[2]` 等裸数字引用序号
    - 返回去重、升序排列的数字数组
    - _Requirements: 1.2, 1.4_
  - [x] 1.2 在 searchInfoParser.ts 中新增 `cleanOrphanCitations` 函数
    - 接收回答文本和 WebSearchCitation 数组
    - 保留有对应 citation 的 `[N]`，移除无对应的 `[N]`
    - 非引用格式的文本内容保持不变
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 1.3 编写 Property 1 属性测试：Search results 解析完整性与去重
    - **Property 1: Search results 解析完整性与去重**
    - **Validates: Requirements 1.1, 1.5**
  - [x] 1.4 编写 Property 2 属性测试：Markdown 链接提取正确性
    - **Property 2: Markdown 链接提取正确性**
    - **Validates: Requirements 1.3**
  - [x] 1.5 编写 Property 3 属性测试：裸数字引用提取
    - **Property 3: 裸数字引用提取**
    - **Validates: Requirements 1.2, 1.4**
  - [x] 1.6 编写 Property 4 属性测试：孤立引用清理
    - **Property 4: 孤立引用清理**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 2. 集成 cleanOrphanCitations 到请求流程
  - [x] 2.1 修改 request.ts 中的 createStreamResponse 和 createCompleteResponse
    - 在返回 answerText 前调用 cleanOrphanCitations
    - 当有 webSearchCitations 时保留匹配的引用序号，无 citations 时移除所有裸引用
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Checkpoint - 确保所有测试通过
  - 运行 `pnpm vitest run --config vitest.simple.config.mts` 确保所有测试通过
  - 如有问题请询问用户

- [x] 4. 前端引用渲染优化
  - [x] 4.1 修改 ResponseTags.tsx 增加无引用数据时的提示
    - 当回答文本中有 `[N]` 引用但 webSearchCitations 为空时，显示"引用来源暂不可用"提示
    - _Requirements: 2.3_

- [x] 5. 验证后端 search_info 透传
  - [x] 5.1 检查 openai/main.go 的 StreamHandler 确保 search_info chunk 不被过滤
    - 确认空 choices + 有 search_info 的 chunk 能正确透传给客户端
    - 如需修改则更新 StreamHandler 的过滤逻辑
    - _Requirements: 1.1_

- [x] 6. Final Checkpoint - 全面验证
  - 运行所有相关测试确保通过
  - 如有问题请询问用户

## Notes

- Tasks 中所有测试均为必须任务
- 测试使用 `pnpm vitest run --config vitest.simple.config.mts`
- fast-check v4 没有 `stringOf` 方法，用 `fc.array(...).map(chars => chars.join(''))` 替代
- 代码注释使用 `// 鲁港通 - xxx` 格式
