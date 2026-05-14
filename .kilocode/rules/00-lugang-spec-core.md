---
inclusion: always
---
# 鲁港通核心规范

## 项目结构
```
lu-gang-connect-project/
├── lugang-ai/          # 前端 (Next.js, 端口3210)
├── lugang-connect-enterprise/  # 后端 (Go, 端口8080)
└── hk-transport-plugin/        # 香港交通插件
```

## 核心约束
- 不修改 `@fastgpt/*` 导入路径
- 包管理器：`pnpm`（monorepo）
- 测试：`pnpm vitest run --config vitest.simple.config.mts`
- 代码注释：`// 鲁港通 - xxx`
