---
inclusion: fileMatch: ["*.test.ts", "*.spec.ts", "*.test.tsx", "vitest*"]
---
# 测试规范

## 命令
```bash
pnpm vitest run --config vitest.simple.config.mts
```

## 规则
- 新功能必须有对应测试
- 属性测试用 fast-check（最少 100 次迭代）
- 测试命名：`描述_期望结果`
- 禁止测试依赖外部网络（Mock API 调用）
- 修改现有功能：确保原有测试不破坏

## 覆盖率目标
- 核心业务逻辑 > 80%；工具函数 > 90%
