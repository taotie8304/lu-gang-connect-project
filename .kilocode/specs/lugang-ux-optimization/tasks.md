# 鲁港通 - 用户体验优化任务清单

## 任务状态说明
- [ ] 待处理
- [x] 已完成

## 阶段一：移动端导航权限控制（US-1）

### Task 1.1: NavigationSection 添加角色判断
- [x] 文件: `lugang-ai/projects/app/src/pageComponents/chat/slider/index.tsx`
- [x] 在 `NavigationSection` 中引入 `useUserStore` 获取 `userInfo`
- [x] 添加 `isAdmin` 判断: `!!userInfo?.team.permission.hasManagePer`
- [x] 修改条件: `enableUserChatOnly` 改为 `enableUserChatOnly || !isAdmin`（使用 `showSimplifiedNav` 变量）
- [x] 非管理员用户复用简化导航（仅显示首页）
- [x] 添加注释: `// 鲁港通 - 非管理员用户隐藏团队应用和精选应用`
- [x] 关联: US-1 (AC1, AC2, AC3, AC4, AC5)

## 阶段二：深度思考开关（US-2）- 已完成

### Task 2.1: 后端 ConvertCompatRequest 修改
- [x] 文件: `lugang-connect-enterprise/relay/adaptor/ali/main.go`
- [x] 读取 `request.EnableThinking` 字段
- [x] 默认关闭思考模式（`enableThinking = false`）
- [x] 开启时设置 `thinking_budget: 8000`
- [x] 关联: US-2 (AC1, AC2, AC3, AC4)

### Task 2.2: CompatChatRequest 结构体更新
- [x] 文件: `lugang-connect-enterprise/relay/adaptor/ali/model.go`
- [x] 添加 `EnableThinking *bool` 和 `ThinkingBudget *int` 字段
- [x] 关联: US-2

## 阶段三：联网搜索用户可控开关（US-3）- 已完成

### Task 3.1: 前端联网搜索开关 UI
- [x] 文件: `lugang-ai/projects/app/src/components/core/chat/ChatContainer/ChatBox/Input/ChatInput.tsx`
- [x] 添加"联网搜索"三级开关按钮（自动联网/开启联网/关闭联网）
- [x] 开关状态存储到 localStorage
- [x] 桌面端和移动端均可见
- [x] 关联: US-3 (AC1, AC2, AC5)

### Task 3.2: 前端请求参数传递
- [x] 文件: `lugang-ai/projects/app/src/components/core/chat/ChatContainer/ChatBox/type.d.ts`
- [x] 文件: `lugang-ai/projects/app/src/components/core/chat/ChatContainer/ChatBox/index.tsx`
- [x] 将 `__enableSearch__` 变量传递到后端请求
- [x] 关联: US-3 (AC3)

### Task 3.3: 后端联网搜索参数处理
- [x] 文件: `lugang-ai/packages/service/core/workflow/dispatch/ai/chat.ts`
- [x] 根据 __enableSearch__ 变量控制模型名 -internet 后缀
- [x] on → 追加 -internet，off → 移除 -internet，auto → 保持原配置
- [x] 关联: US-3 (AC4)

## 阶段四：代码推送与部署（US-4）

### Task 4.1: 推送代码到 GitHub
- [x] git add 所有修改文件
- [x] git commit（包含 Task 1.1 + Task 2.1/2.2 + docker-compose.yml 的修改）
- [x] git push 到远程仓库 (commit: 55ff12e)
- [x] 关联: US-4 (AC4)

### Task 4.2: 后端部署
- [ ] 等待 GitHub Actions 构建完成
- [ ] 更新服务器 docker-compose.yml
- [ ] 执行部署命令
- [ ] 验证服务正常运行
- [ ] 关联: US-4 (AC4, AC5)

## 执行顺序

```
Task 1.1 (隐藏团队应用) → Task 4.1 (推送代码) → Task 4.2 (部署)
                                                    ↑
Task 2.1/2.2 (已完成，等待推送) ─────────────────────┘

Task 3.1-3.3 (联网搜索开关) → 后续迭代
```
