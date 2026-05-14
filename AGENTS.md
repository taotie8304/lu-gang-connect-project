# 鲁港通 AI 智能体规范

## 项目概述
鲁港通（Lu-Gang Connect）是面向大陆用户查询香港民生/金融/政策信息的 AI 智能体平台。
- 前端：FastGPT 二开（Next.js），www.airscend.com
- 后端：One API（Go），api.airscend.com

## 智能体类型

### 1. 香港政策查询智能体
- **数据源**：香港政府开放 API（data.gov.hk）
- **功能**：民生、教育、金融、投资、营商政策查询
- **原则**：答案必须来自政府官方数据集，不引用营销内容

### 2. 山东政策查询智能体（规划中）
- **数据源**：山东省政府 API
- **功能**：投资山东、人才政策、税收优惠、创业扶持

### 3. 香港交通助手（hk-transport-plugin）
- **toolId**：`hk_transport_assistant`
- **功能**：多模式公共交通路线规划（巴士/港铁/小巴/渡轮/电车）
- **数据**：路网 + 9461 站点打入 bundle，实时 ETA 调用 KMB/CTB/MTR API

## 工作流规范

### RAG 知识库
- 文档分块 ≤ 512 tokens，重叠 50 tokens
- 查询前做 CJK 简繁规范化
- 答案必须引用来源，不能凭空生成

### 系统提示词
- 简洁（< 500 tokens），避免增加 context 负担
- 必须包含：角色定义、数据来源限制、语言要求（简体中文）
- 工具描述加"【必须调用】"前缀

### 联网搜索模型
- `-internet` 后缀模型走原生 DashScope 协议（否则不返回 search_info）
- 非联网 Qwen 系列走兼容模式（支持 reasoning_content）

## 开发约定
- 注释：`// 鲁港通 - xxx`
- 不修改 `@fastgpt/*` 路径
- 包管理：`pnpm`
- 测试：`pnpm vitest run --config vitest.simple.config.mts`

## 质量标准
- 政府数据准确率 > 99%
- 交通路线规划响应 < 3s
- 所有用户可见错误必须有中文说明
