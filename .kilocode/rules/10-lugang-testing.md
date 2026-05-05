---
description: 测试规范与质量保证标准
globs:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
alwaysApply: false
---

# 测试规范

## 统一测试命令
- 运行测试的标准命令（只能用这个，不要用 npx）：
  ```bash
  pnpm vitest run --config vitest.simple.config.mts
  ```
- Go 后端测试：`go test ./... -v`

## 属性测试规范（fast-check）
- 项目已引入 `fast-check` 做属性测试（Property-Based Testing），安装在根目录 `devDependencies`。
- 每个属性测试最少执行 **100 次迭代**。
- **关键注意**：fast-check v4 没有 `stringOf` 方法，用以下方式替代：
  ```typescript
  // 鲁港通 - 正确用法
  fc.array(fc.char()).map(chars => chars.join(''))
  // 而不是 fc.stringOf(...) ← 这在 v4 中不存在
  ```

## 测试文件管理规范
- 临时测试文件（`test_*.js`, `check_*.sh` 等）在完成任务后**必须删除**，不得提交到 Git。
- 需要长期保留的工具脚本放入根目录 `scripts/` 文件夹，并在文件头部注明用途。
- 每次 session 结束时，检查根目录是否有临时文件残留，有则清理后再提交。

## 测试覆盖重点
新增功能时，以下场景必须有对应测试：
1. **边界值**：空字符串、null、超长输入。
2. **中文字符**：简体/繁体/繁简混合的输入。
3. **API 降级**：外部 API（香港政府接口）超时或返回异常格式时的降级行为。
