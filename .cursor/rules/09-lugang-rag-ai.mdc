---
description: RAG 知识库与 AI 工作流开发专项规范
globs:
  - "lugang-ai/**/knowledge/**"
  - "lugang-ai/**/workflow/**"
  - "lugang-ai/**/*search*"
  - "lugang-ai/**/*rag*"
alwaysApply: false
---

# RAG 知识库架构约束

## 核心设计原则
- 鲁港通知识库的数据来源：**香港政府开放 API**（data.gov.hk）和**山东省政府政策数据**，是平台核心竞争力，任何知识库相关改动须格外谨慎。
- 检索的首要指标是**召回率**（Recall），而不是速度。在召回率与速度之间有冲突时，优先保证召回率。

## 简繁搜索规范化（CJK Normalization）
- 知识库搜索的简繁兼容由系统配置 `feConfigs.enableCjkNormalization` 控制。
- 简繁转换使用 `opencc-js`（纯 JS，无原生依赖），模式为 `hk→cn`（香港繁体 → 大陆简体）。
- opencc-js 没有 TypeScript 类型声明，类型定义文件路径：`packages/service/common/string/opencc-js.d.ts`，修改时不得删除此文件。
- `__enableS2T__` 是工作流变量，用于控制是否启用简繁扩展搜索，修改工作流时需要保留此变量。

## 知识库数据更新规范
- 香港政府 API 数据应定期同步，同步脚本放置在根目录 `scripts/` 文件夹下。
- 数据分块（Chunking）策略：
  - 政策类文档（长文本）：按段落分块，每块不超过 800 tokens，块间保留 100 tokens 重叠。
  - 表格类数据（如补贴金额、申请条件）：以单条记录为一个 Chunk，保留完整字段。
  - 禁止跨文档合并 Chunk，会破坏引用追踪。

## 联网搜索与知识库混合检索
- 联网搜索结果与知识库结果混合使用时，必须标注来源（`[来自香港政府官方数据]` 或 `[来自互联网检索]`）。
- 联网搜索引用的修复逻辑：
  - 前端：`extractBareNumberReferences` + `cleanOrphanCitations` 两个函数负责解析和清理引用标记。
  - 后端：`search_info` 字段必须从 SSE 流中透传到前端，当前 fix 在 `openai.StreamHandler` 中。

## AI 工作流部署规范
- 工作流变更前必须先导出当前版本（JSON 备份），存放路径：`docs/workflow-backups/`。
- 新工作流上线前，必须在测试账号中完整跑通以下场景：
  1. 纯知识库检索（无联网）
  2. 联网搜索（带引用标注）
  3. 简繁混合输入（如同时包含「香港」和「香港」）
