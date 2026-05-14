---
inclusion: always
---
# 全局代码规范

## TypeScript
- 严格模式；禁用 `any`（用 `unknown` 替代）
- 接口优于类型别名；枚举优于字符串常量
- 工具函数加 JSDoc

## 错误处理
- 异步操作必须 try/catch
- 用户可见错误必须提供可操作的中文提示
- 禁止 `console.log`（用 `logger` 模块）

## Git
- Commit 格式：`type(scope): 描述`（feat/fix/docs/refactor/test）
- 不提交 `.env`、`node_modules`、构建产物
