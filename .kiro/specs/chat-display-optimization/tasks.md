# Implementation Plan: Chat Display Optimization

## Overview

本实施计划将聊天显示优化功能分解为可执行的编码任务。重点解决6个问题：禁用图片显示、思考模式内容控制、背景色修复、表格渲染优化、引用内容隐藏和响应式显示。

## Tasks

- [x] 1. 禁用图片显示功能
  - 修改 Markdown 图片渲染组件，完全移除图片显示
  - 添加 System Prompt 指导 AI 使用文字描述
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.1 修改图片渲染组件
  - 修改 `lugang-ai/projects/app/src/components/Markdown/img/Image.tsx`
  - 将图片渲染改为返回 null（不显示任何内容）
  - 确保用户上传的图片功能不受影响
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.2 添加 AI 对话节点 System Prompt
  - 在工作流的 AI 对话节点配置中添加提示词
  - 指导 AI 使用文字描述而非图片引用
  - 提示词内容："请使用文字描述来说明内容，不要引用或显示图片。"
  - _Requirements: 1.5_

- [x] 2. 修复思考模式背景色样式
  - 修改思考模式组件的样式，确保不污染最终答案
  - 使用 CSS 隔离技术
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.1 修改思考模式组件样式
  - 修改 `lugang-ai/projects/app/src/components/core/chat/components/AIResponseBox.tsx`
  - 为 AccordionPanel 添加明确的背景色样式（灰色 #F7F8FA）
  - 确保样式只应用于思考模式区域，不影响最终答案
  - 添加 margin 或 padding 确保思考模式和最终答案之间有间距
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2.2 测试样式隔离
  - 验证思考模式的灰色背景不会影响最终答案的背景色
  - 测试不同主题（浅色/深色）下的显示效果
  - _Requirements: 3.4, 3.5_

- [x] 3. 隐藏引用内容
  - 对普通用户完全隐藏引用标记和来源
  - 移除回复文本中的引用标记
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 3.1 修改引用链接组件
  - 修改 `lugang-ai/projects/app/src/components/Markdown/A.tsx`
  - 在 CiteLink 组件中，对普通用户直接返回 null（不显示任何内容）
  - 保留管理员的引用显示功能
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 3.2 创建引用标记移除工具函数
  - 创建 `lugang-ai/projects/app/src/components/Markdown/utils.ts`
  - 实现 `removeCitationMarks(text: string): string` 函数
  - 使用正则表达式移除 [1], [2] 等引用标记
  - 处理移除后的多余空格，确保文本连贯
  - _Requirements: 5.5, 5.6_

- [x] 3.3 在 Markdown 渲染器中应用引用标记移除
  - 修改 `lugang-ai/projects/app/src/components/Markdown/index.tsx`
  - 在渲染前调用 `removeCitationMarks` 函数处理文本
  - 只对普通用户应用此处理（管理员保留引用标记）
  - _Requirements: 5.5, 5.6_

- [x] 3.4 编写引用标记移除的单元测试
  - 创建测试文件 `utils.test.ts`
  - 测试移除单个和多个引用标记
  - 测试处理没有引用标记的文本
  - 测试移除后文本的连贯性
  - _Requirements: 5.5, 5.6_

- [x] 4. 修复 Markdown 表格渲染
  - 移除表格中的 `<br>` 标签
  - 优化表格样式
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 4.1 创建表格预处理函数
  - 在 `lugang-ai/projects/app/src/components/Markdown/utils.ts` 中添加函数
  - 实现 `preprocessTableMarkdown(text: string): string` 函数
  - 使用正则表达式移除表格单元格中的 `<br>` 标签
  - _Requirements: 4.2, 4.3_

- [x] 4.2 在 Markdown 渲染器中应用表格预处理
  - 修改 `lugang-ai/projects/app/src/components/Markdown/index.tsx`
  - 在渲染前调用 `preprocessTableMarkdown` 函数
  - _Requirements: 4.2, 4.3_

- [x] 4.3 优化表格 CSS 样式
  - 修改 `lugang-ai/projects/app/src/components/Markdown/index.module.scss`
  - 添加表格样式：`word-wrap: break-word`, `white-space: normal`
  - 添加横向滚动：`overflow-x: auto`
  - 确保表格单元格内容正确对齐
  - _Requirements: 4.4, 4.5, 4.6_

- [x] 4.4 编写表格渲染的单元测试
  - 测试移除 `<br>` 标签功能
  - 测试表格样式应用
  - _Requirements: 4.2, 4.3_

- [x] 5. 优化响应式显示
  - 确保移动端正确显示
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5.1 优化移动端表格显示
  - 修改 `lugang-ai/projects/app/src/components/Markdown/index.module.scss`
  - 添加媒体查询 `@media (max-width: 768px)`
  - 设置表格在移动端的最大宽度和滚动
  - _Requirements: 6.1_

- [x] 5.2 优化移动端思考模式显示
  - 修改 `lugang-ai/projects/app/src/components/core/chat/components/AIResponseBox.tsx`
  - 在小屏幕设备上默认折叠思考模式
  - 调整字体大小确保可读性（至少 14px）
  - _Requirements: 6.2, 6.3, 6.4_

- [x] 6. Checkpoint - 测试所有功能
  - 测试图片不显示
  - 测试思考模式背景色正确
  - 测试引用内容已隐藏
  - 测试表格渲染正确
  - 测试移动端显示正常
  - 确保所有测试通过，询问用户是否有问题

## Notes

- 所有任务都是必做任务，包含完整的测试覆盖
- 每个任务都引用了具体的需求编号，便于追溯
- Checkpoint 任务确保增量验证
- 重点关注样式隔离，避免思考模式样式污染最终答案
