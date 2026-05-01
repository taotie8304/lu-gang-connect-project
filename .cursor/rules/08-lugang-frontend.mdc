---
description: 前端 Next.js / FastGPT 二开专项规范
globs:
  - "lugang-ai/**/*.ts"
  - "lugang-ai/**/*.tsx"
alwaysApply: false
---

# 前端架构约束（FastGPT 二开）

## 绝对禁止事项
- 禁止修改 `@fastgpt/*` 开头的导入路径，这些是第三方依赖包路径。
- 禁止引入新的 CSS 框架（项目已使用 Chakra UI，严格在此体系内扩展）。
- 禁止修改 `lugang-ai/packages/` 下的核心包（除非是明确的业务定制需求）。

## 组件开发规范
- 严格遵循单一职责原则：
  - 单个组件超过 **150 行**必须拆分为子组件。
  - 单个函数超过 **40 行**需要考虑拆分。
- Props 和 API 响应必须定义清晰的 TypeScript 接口，**严禁使用 `any` 类型**。
- 跨组件状态通信优先使用现有的状态管理方案（Zustand / Context），禁止超过 2 层的 Props 透传。

## 多语言（i18n）开发规范
- 所有用户可见的中文文案必须走 i18n 翻译键（`t('xxx')`），严禁硬编码中文字符串进 JSX。
- 新增翻译键时，必须同时在以下三个文件中添加对应内容：
  - `packages/web/i18n/zh/`（简体中文）
  - `packages/web/i18n/en/`（英文）
  - `packages/web/i18n/zh_HK/`（繁体中文）
- 系统内容（使用条款、隐私政策）的多语言 Key 命名规则：
  - 繁体：`{base_key}`
  - 简体：`{base_key}_zh-CN`
  - 英文：`{base_key}_en`

## 数据库连接注意事项
- 前端连接的 MongoDB 数据库名称是 `lugang_ai`，**不是** `fastgpt`。
- 前端密码加密方式：双重 SHA256（`hashStr(hashStr(password))`），与后端 bcrypt 不同，禁止混用。

## 订阅功能开发规范（⚠️ 待完成模块）
- 订阅功能当前**尚未完成**，是最高优先级的待开发模块。
- 开发订阅功能时，必须先阅读 FastGPT 上游仓库的 `support/user/team/` 相关代码，理解其团队/配额体系后再进行二开。
- 订阅套餐的定价、功能限制信息必须通过后台配置（MongoDB SystemConfig 集合）管理，严禁硬编码进前端代码。
- 支付回调接口必须做幂等性保护（防止重复回调导致重复开通）。
