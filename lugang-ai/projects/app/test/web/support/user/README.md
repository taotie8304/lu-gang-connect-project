# 鲁港通 - 用户功能测试

## 语言偏好持久化属性测试

### 安装依赖

在运行测试之前，需要先安装 fast-check 依赖：

```bash
# 在项目根目录 (lugang-ai) 运行
cd /path/to/lugang-ai
pnpm install

# 如果遇到虚拟存储位置错误，请先运行：
pnpm install --force
```

### 运行测试

```bash
# 在 lugang-ai/projects/app 目录运行
cd projects/app
pnpm vitest run test/web/support/user/languagePreference.test.ts

# 或者在根目录运行
cd lugang-ai
pnpm test --filter lugang-ai-app test/web/support/user/languagePreference.test.ts
```

### 测试说明

`languagePreference.test.ts` 实现了 Property 7: Language Preference Persistence

**验证需求**: Requirements 3.2.3, 3.2.4

**测试内容**:
1. 语言偏好在页面刷新后保持不变
2. 语言偏好正确保存到 localStorage
3. 语言偏好正确保存到 Cookie（非 iframe 环境）
4. 多次保存相同语言的幂等性
5. 新语言选择覆盖旧语言

每个属性测试运行 100 次迭代，使用 fast-check 生成随机测试数据。
