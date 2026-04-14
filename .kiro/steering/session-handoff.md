---
inclusion: always
---

# Session 交接文件

> 本文件记录 session 间的工作交接信息，每次 session 结束时自动更新。

## 本次 Session 完成的工作

### 1. ✅ 前端使用条款功能修复
- **问题诊断**：发现前端连接的是 `lugang_ai` 数据库，而不是 `fastgpt`
- **数据库更新**：将完整使用条款内容（6760 字符）更新到正确的数据库 `lugang_ai`
- **代码修复**：修复 `SystemContentModal` 组件的 API 响应数据解析逻辑
  - 原代码：`data.content`
  - 修复后：`result.data.content`（因为 API 返回格式为 `{ code, data: { content } }`）
- **部署**：代码已推送到 GitHub（commit e89a0eb），前端容器已重新创建并启动
- **验证**：API 测试通过，返回完整内容（6760 字符）

### 2. ✅ 后端 root 密码重置
- **问题诊断**：发现后端使用标准 bcrypt 哈希，不是 SHA256 双重哈希
- **密码更新**：生成正确的 bcrypt 哈希并更新到数据库
  - 用户名：`root`
  - 密码：`Huijin8304*`
  - 哈希：`$2b$10$hML/kqD3MYazuxEM9apG5uycdzTWgGzGnXdpP8BUsybhXT6.x4XfK`
- **验证**：数据库已成功更新

## 当前待办任务（按优先级）

1. **用户验证前端使用条款**：
   - 清除浏览器缓存或使用新的无痕窗口
   - 访问 https://www.airscend.com
   - 登录任意用户，点击左下角头像 → 使用条款
   - 应该能看到完整内容

2. **用户验证后端登录**：
   - 访问 https://api.airscend.com
   - 使用 `root` / `Huijin8304*` 登录

3. **联网搜索引用修复验证**：
   - 等待 GitHub Actions 构建后端镜像
   - 服务器上拉取新镜像并重启后端容器
   - 用联网搜索模型测试引用是否正常显示

## 未解决的问题或 Bug

- 联网搜索引用修复正在验证中（已切换 internet 模型到原生协议，待测试）
- husky install 在 .git 目录不在 lugang-ai 根目录时会报错（不影响功能）
- `activity-date-filter.property.test.ts` 有 2 个测试因 NaN 日期边界问题失败（与当前功能无关）

## 重要文件路径

- 前端系统内容组件：`lugang-ai/projects/app/src/components/SystemContentModal/index.tsx`
- 系统内容常量定义：`lugang-ai/packages/global/support/systemContent/constant.ts`
- 后端密码加密函数：`lugang-connect-enterprise/common/crypto.go`
- 前端数据库：MongoDB `lugang_ai` 数据库（不是 `fastgpt`）
- 后端数据库：MySQL `lugang_connect` 数据库

## 特殊注意事项

- **前端数据库名称**：前端连接的是 `lugang_ai` 数据库，环境变量 `MONGODB_URI` 中指定
- **后端密码加密**：使用标准 bcrypt（`bcrypt.GenerateFromPassword`），不是双重 SHA256
- **前端密码加密**：使用双重 SHA256 哈希（`hashStr(hashStr(password))`）
- **docker-compose 服务名称**：前端服务名是 `lugang-ai`，不是 `app`
- 运行测试使用 `pnpm vitest run --config vitest.simple.config.mts`（不要用 npx）
- fast-check v4 没有 `stringOf` 方法，用 `fc.array(...).map(chars => chars.join(''))` 替代
- 项目使用 pnpm workspace monorepo 结构，fast-check 安装在根目录 devDependencies
- opencc-js 没有 TypeScript 类型声明，已手动创建在 `packages/service/common/string/opencc-js.d.ts`
