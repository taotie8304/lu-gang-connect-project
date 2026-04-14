# 鲁港通 - 用户体验优化与功能增强

## 概述

鲁港通跨境AI智能平台的用户体验优化，涵盖移动端导航权限控制、AI 响应速度优化（深度思考开关）、联网搜索用户可控开关，以及后端部署流程优化。

## 用户故事

### US-1: 移动端普通用户隐藏管理入口
**作为** 鲁港通普通用户（非管理员）  
**我希望** 在移动端侧边栏中看不到"团队应用"和"精选应用"导航  
**以便** 界面更简洁，不会误入管理功能页面

**验收标准:**
- [ ] AC1: 非管理员用户在移动端侧边栏中不显示"团队应用"导航按钮
- [ ] AC2: 非管理员用户在移动端侧边栏中不显示"精选应用"导航按钮
- [ ] AC3: 管理员用户仍然可以看到完整导航（团队应用、精选应用）
- [ ] AC4: 桌面端行为不受影响（或同样对非管理员隐藏）
- [ ] AC5: 导航隐藏后，侧边栏布局正常，无空白或错位

**技术背景:**
- 侧边栏组件: `lugang-ai/projects/app/src/pageComponents/chat/slider/index.tsx`
- `NavigationSection` 组件控制导航显示
- 已有 `enableUserChatOnly` 系统级配置可隐藏团队应用，但这是全局配置，不区分用户角色
- `BottomSection` 组件已有 `isAdmin` 角色判断逻辑可参考
- 需要在 `NavigationSection` 中引入 `useUserStore` 获取用户角色信息

### US-2: 深度思考开关真正生效
**作为** 鲁港通用户  
**我希望** 前端的"深度思考"开关能真正控制 AI 的思考模式  
**以便** 在需要快速回答时关闭深度思考以加快响应速度，在需要深入分析时开启

**验收标准:**
- [x] AC1: 深度思考关闭时，后端发送 `enable_thinking: false` 给阿里百炼，响应速度明显加快
- [x] AC2: 深度思考开启时，后端发送 `enable_thinking: true, thinking_budget: 8000`，AI 进行深度推理
- [x] AC3: 前端 `__enableThinking__` 变量正确传递到后端 `GeneralOpenAIRequest.EnableThinking`
- [x] AC4: 默认状态为关闭（快速响应模式）

**技术背景:**
- 已完成代码修改，等待推送部署
- 修改文件: `lugang-connect-enterprise/relay/adaptor/ali/main.go`
- 数据流: ChatInput → ChatBox (`__enableThinking__`) → dispatch/ai/chat.ts → request.ts (`enable_thinking`) → GeneralOpenAIRequest.EnableThinking → ConvertCompatRequest → CompatChatRequest

### US-3: 联网搜索用户可控开关
**作为** 鲁港通用户  
**我希望** 在聊天界面有一个"联网搜索"开关，桌面端和移动端都可见  
**以便** 根据需要选择是否让 AI 联网搜索最新信息

**验收标准:**
- [ ] AC1: 聊天输入区域显示"联网搜索"开关按钮
- [ ] AC2: 开关在桌面端和移动端均可见且可操作
- [ ] AC3: 开关状态通过请求传递到后端
- [ ] AC4: 后端根据开关状态决定是否在模型 ID 后添加 `-internet` 后缀
- [ ] AC5: 开关状态在会话中保持（localStorage 或类似机制）

**技术背景:**
- 当前联网搜索通过模型 ID 后缀 `-internet` 控制（`qwen3.5-plus-internet`）
- 后端 `ConvertCompatRequest` 已支持 `-internet` 后缀解析
- 需要参考深度思考开关的实现模式（`__enableThinking__` 变量传递方式）
- 前端需要新增类似 `__enableSearch__` 的变量

### US-4: 后端部署流程优化
**作为** 鲁港通运维人员  
**我希望** 后端使用 GitHub Container Registry 镜像部署，而非本地构建  
**以便** 部署流程标准化，减少服务器资源消耗

**验收标准:**
- [x] AC1: `docker-compose.yml` 使用 `image: ghcr.io/taotie8304/lugang-enterprise:latest` 而非 `build`
- [x] AC2: 后端容器 `lugang-enterprise` 加入 `lugang-ai_default` 外部网络
- [x] AC3: 前端容器可通过 `http://lugang-enterprise:8080` 访问后端
- [ ] AC4: 代码推送后 GitHub Actions 自动构建新镜像
- [ ] AC5: 服务器 docker-compose.yml 同步更新

**技术背景:**
- 本地 `docker-compose.yml` 已修改完成
- 服务器路径: `/www/wwwroot/lugang-connect-enterprise/docker-compose.yml`
- 部署命令: `cd /www/wwwroot/lugang-connect-enterprise && docker pull ghcr.io/taotie8304/lugang-enterprise:latest && docker rm -f lugang-enterprise && docker compose up -d`

## 技术约束

### 前端修改原则
1. 注释格式统一为 `// 鲁港通 - xxx`
2. 尽量复用现有组件和 hooks（如 `useUserStore`、`useSystemStore`）
3. 移动端和桌面端行为保持一致

### 后端修改原则
1. 已完成的后端修改（Task 6 深度思考）不再变动
2. 联网搜索功能复用现有 `-internet` 后缀机制

### 部署原则
1. 所有代码变更先推送 GitHub，等 CI 构建完成后再部署
2. 部署前确认不会影响现有服务

## 依赖关系

```
US-1 (隐藏团队应用) → 独立，可立即实施
US-2 (深度思考) → 已完成，等待推送部署
US-3 (联网搜索开关) → 依赖前端 UI 开发 + 后端已有支持
US-4 (部署优化) → 依赖 US-1、US-2 完成后统一推送
```

## 风险评估

### 低风险
- US-1: 纯前端 UI 逻辑修改，不影响数据
- US-2: 已完成并验证逻辑正确性

### 中风险
- US-3: 需要前后端配合，涉及请求参数传递链路
- US-4: 部署操作需要确保服务不中断
