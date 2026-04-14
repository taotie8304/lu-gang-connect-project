# Implementation Plan: 中文简繁搜索规范化

## Overview

分三个阶段实现：核心转换模块 → HTTP 工具集成 → 知识库搜索集成。使用 TypeScript，基于 `opencc-js` 库。

## Tasks

### 第一阶段：核心转换模块

- [x] 1. 创建 CJK Normalizer 模块
  - [x] 1.1 安装 opencc-js 依赖并创建转换模块
    - 在 `lugang-ai/packages/service/` 下执行 `pnpm add opencc-js`
    - 创建 `lugang-ai/packages/service/common/string/cjkNormalizer.ts`
    - 实现 `simplifiedToTraditional(text)` 函数
    - 实现 `traditionalToSimplified(text)` 函数
    - 实现 `containsChinese(text)` 辅助函数
    - 实现 `convertParamsS2T(params)` 递归对象转换函数
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.2 编写简繁转换 round-trip 属性测试
    - **Property 1: 简繁转换 round-trip**
    - **Validates: Requirements 2.4**

  - [x] 1.3 编写非中文字符保留属性测试
    - **Property 2: 非中文字符保留**
    - **Validates: Requirements 2.3**

  - [x] 1.4 编写递归参数转换属性测试
    - **Property 3: 递归参数转换完整性**
    - **Validates: Requirements 1.1, 1.3**

- [x] 2. Checkpoint - 验证核心转换模块
  - 确保所有测试通过，如有问题请询问用户

### 第二阶段：HTTP 工具集成

- [x] 3. 在 HTTP 工具中集成简繁转换
  - [x] 3.1 修改 http468.ts 支持简繁转换
    - 修改 `lugang-ai/packages/service/core/workflow/dispatch/tools/http468.ts`
    - 从 `variables` 中读取 `__enableS2T__` 变量
    - 当启用时，对 `httpReqUrl`、`params`、`requestBody` 中的中文字符串执行 S2T 转换
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [x] 3.2 修改 runHTTPTool 支持简繁转换
    - 修改 `lugang-ai/packages/service/core/app/http.ts`
    - 在 `RunHTTPToolParams` 中新增 `enableS2T?: boolean` 参数
    - 在 `buildHttpRequest` 中，当 `enableS2T` 为 true 时对 params 执行 `convertParamsS2T`
    - _Requirements: 1.1, 1.3_

  - [x] 3.3 修改 runTool.ts 传递 enableS2T 参数
    - 修改 `lugang-ai/packages/service/core/workflow/dispatch/child/runTool.ts`
    - 从工作流 `variables` 中读取 `__enableS2T__`
    - 传递给 `runHTTPTool` 调用
    - _Requirements: 1.4_

  - [x] 3.4 编写启用/禁用开关控制属性测试
    - **Property 4: 启用/禁用开关控制**
    - **Validates: Requirements 1.4, 1.5**

- [x] 4. Checkpoint - 验证 HTTP 工具简繁转换
  - 确保所有测试通过，如有问题请询问用户

### 第三阶段：知识库搜索集成

- [x] 5. 在知识库搜索中集成简繁兼容
  - [x] 5.1 添加 enableCjkNormalization 系统配置
    - 修改 `lugang-ai/packages/global/common/system/types/index.d.ts`
    - 在 `FeConfigsType` 中添加 `enableCjkNormalization?: boolean`
    - _Requirements: 3.3_

  - [x] 5.2 修改 searchDatasetData 支持查询扩展
    - 修改 `lugang-ai/packages/service/core/dataset/search/controller.ts`
    - 在 `searchDatasetData` 函数开头，当 `enableCjkNormalization` 启用时：
      - 对 `queries` 数组中每个查询生成繁体版本
      - 合并原始查询和繁体查询（去重）
      - 对 `reRankQuery` 也生成繁体版本
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 5.3 编写知识库查询扩展属性测试
    - **Property 5: 知识库查询扩展**
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 6. Final Checkpoint - 完整功能验证
  - 验证核心转换模块正常
  - 验证 HTTP 工具简繁转换正常
  - 验证知识库搜索简繁兼容正常
  - 确保所有测试通过，如有问题请询问用户

## Notes

- All tasks including property tests are required for comprehensive coverage
- 使用 `opencc-js` 库（纯 JS，无原生依赖），版本 ^1.0.5
- 属性测试使用 `fast-check` 库，最少 100 次迭代
- 所有代码注释使用 `// 鲁港通 - xxx` 格式
- HTTP 工具的简繁转换通过工作流变量 `__enableS2T__` 控制，用户可在工作流编辑器中配置
- 知识库搜索的简繁兼容通过系统配置 `enableCjkNormalization` 控制
