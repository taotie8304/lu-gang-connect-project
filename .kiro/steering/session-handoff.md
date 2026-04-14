---
inclusion: always
---

# Session 交接文件

> 本文件记录 session 间的工作交接信息，每次 session 结束时自动更新。

## 本次 Session 完成的工作

### 1. ✅ 项目文档整理
- **创建主文档**：创建 `PROJECT-MASTER.md`，整合所有重要信息
  - 包含所有账号密码、服务器配置、数据库信息
  - 包含完整部署指南和常见问题解答
  - 包含命名规范和技术架构说明
- **删除冗余文档**：删除 13 个临时文档（已整合到主文档）
- **修复 .gitignore**：删除错误的 `*.md` 规则
- **创建整理说明**：创建 `文档整理说明.md` 记录整理过程

### 2. ✅ 临时测试文件清理
- **删除测试文件**：删除 47 个临时测试和检查文件
  - 测试文件：6 个（test_*.js）
  - 检查文件：14 个（check_*.js, check_*.sh, check_*.sql）
  - 修复文件：3 个（fix_*.js）
  - 生成文件：5 个（generate_*.js）
  - 临时 SQL：10 个（*.sql）
  - 临时 Shell：8 个（*.sh）
  - 其他临时文件：8 个
- **保留实用工具**：保留 16 个实用工具脚本
  - 系统内容管理工具（add_*.js, convert_*.js, update_*.js）
  - 批量操作工具（update_all_system_contents.sh, reset_root_password.js）
- **创建清理总结**：创建 `清理总结.md` 记录清理详情

### 3. ✅ Steering 文件整合
- **整合命名规范**：将 `lugang-naming.md` 的内容整合到 `PROJECT-MASTER.md`
- **更新主文档**：添加"命名规范"章节到主文档
- **更新交接文件**：更新本文件反映最新工作状态

## 当前待办任务（按优先级）

1. **项目文档维护**：
   - 定期更新 `PROJECT-MASTER.md` 中的信息
   - 有新功能完成时更新"已完成功能"章节
   - 有重要决策时更新"重要决策记录"章节

2. **用户设置多语言功能验证**：
   - 清除浏览器缓存或使用新的无痕窗口
   - 访问 https://www.airscend.com
   - 测试语言切换功能
   - 验证用户设置面板的多语言显示

3. **联网搜索引用修复验证**：
   - 等待 GitHub Actions 构建后端镜像
   - 服务器上拉取新镜像并重启后端容器
   - 用联网搜索模型测试引用是否正常显示

## 未解决的问题或 Bug

- 联网搜索引用修复正在验证中（已切换 internet 模型到原生协议，待测试）
- 用户设置多语言功能已部署，待用户验证（需清除浏览器缓存）

## 已解决的问题

- ✅ 前端使用条款功能 - 数据库内容更新和组件修复
- ✅ 后端 root 密码重置 - 使用标准 bcrypt 哈希
- ✅ 项目文档混乱 - 已整理并创建主文档
- ✅ 临时测试文件过多 - 已清理 47 个临时文件
- ✅ .gitignore 错误配置 - 已修复 `*.md` 规则

## 重要文件路径

### 主文档
- **项目主文档**：`PROJECT-MASTER.md` - 包含所有重要信息的统一文档
- **文档整理说明**：`文档整理说明.md` - 记录文档整理过程
- **清理总结**：`清理总结.md` - 记录文件清理详情

### 前端关键文件
- 系统内容组件：`lugang-ai/projects/app/src/components/SystemContentModal/index.tsx`
- 用户设置面板：`lugang-ai/projects/app/src/components/UserSettingsPanel/index.tsx`
- 系统内容常量：`lugang-ai/packages/global/support/systemContent/constant.ts`
- 系统内容 API：`lugang-ai/projects/app/src/pages/api/system/content/[key].ts`
- 翻译文件：`lugang-ai/packages/web/i18n/{语言}/`

### 后端关键文件
- 密码加密函数：`lugang-connect-enterprise/common/crypto.go`

### 数据库
- 前端数据库：MongoDB `lugang_ai` 数据库（不是 `fastgpt`）
- 后端数据库：MySQL `lugang_connect` 数据库

### 实用工具脚本
- 系统内容添加：`add_*.js`（6个）
- 繁简转换：`convert_*.js`（3个）
- 系统内容更新：`update_*.js`（3个）
- 批量更新：`update_all_system_contents.sh`
- 密码重置：`reset_root_password.js`

## 特殊注意事项

- **前端数据库名称**：前端连接的是 `lugang_ai` 数据库，环境变量 `MONGODB_URI` 中指定
- **后端密码加密**：使用标准 bcrypt（`bcrypt.GenerateFromPassword`），不是双重 SHA256
- **前端密码加密**：使用双重 SHA256 哈希（`hashStr(hashStr(password))`）
- **docker-compose 服务名称**：前端服务名是 `lugang-ai`，不是 `app`
- 运行测试使用 `pnpm vitest run --config vitest.simple.config.mts`（不要用 npx）
- fast-check v4 没有 `stringOf` 方法，用 `fc.array(...).map(chars => chars.join(''))` 替代
- 项目使用 pnpm workspace monorepo 结构，fast-check 安装在根目录 devDependencies
- opencc-js 没有 TypeScript 类型声明，已手动创建在 `packages/service/common/string/opencc-js.d.ts`
