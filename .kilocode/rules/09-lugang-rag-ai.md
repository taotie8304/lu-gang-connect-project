---
inclusion: fileMatch: ["*rag*", "*knowledge*", "*vector*", "*embedding*", "*workflow*"]
---
# RAG / AI 规范

## 知识库
- 文档分块 ≤ 512 tokens，重叠 50 tokens
- Embedding 用 text-embedding-3-small（或同等中文模型）
- 搜索前做 CJK 简繁规范化（opencc-js）

## 工作流
- 通过 `__enableS2T__` 变量控制简繁转换
- `feConfigs.enableCjkNormalization` 控制知识库搜索规范化

## 模型接入
- 联网搜索模型（`-internet` 后缀）：必须走原生 DashScope 协议
- 非联网 Qwen 系列：走兼容模式（支持 `reasoning_content`）
- FastGPT 系统工具 SSE：用 `parseSystemToolStreamResult` 兼容两种返回格式

## 提示词
- 系统提示词简洁（< 500 tokens），避免增加 context 负担
- 工具描述（toolDescription）加"【必须调用】"前缀确保 LLM 调用
