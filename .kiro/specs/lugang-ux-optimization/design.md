# 鲁港通 - 用户体验优化设计文档

## US-1: 移动端普通用户隐藏管理入口

### 设计方案

在 `NavigationSection` 组件中引入用户角色判断，对非管理员用户隐藏"团队应用"和"精选应用"导航。

### 修改文件

`lugang-ai/projects/app/src/pageComponents/chat/slider/index.tsx`

### 修改逻辑

```typescript
// NavigationSection 组件中新增：
const { userInfo } = useUserStore();
const isAdmin = !!userInfo?.team.permission.hasManagePer;

// 鲁港通 - 非管理员用户隐藏团队应用和精选应用导航
// 复用 enableUserChatOnly 的简化导航逻辑
if (enableUserChatOnly || !isAdmin) {
  // 返回简化导航（仅首页）
}
```

### 参考实现

`BottomSection` 组件已有相同的角色判断模式：
```typescript
const { userInfo } = useUserStore();
const isAdmin = !!userInfo?.team.permission.hasManagePer;
const showSettingButton = isAdmin && !isShare && !enableUserChatOnly;
```

### 影响范围
- 仅影响 `NavigationSection` 组件的渲染逻辑
- 不影响路由、数据、权限等后端逻辑
- 管理员体验不变

---

## US-2: 深度思考开关（已完成）

### 已实施方案

修改 `ConvertCompatRequest` 函数，读取 `request.EnableThinking` 字段：

```go
// 鲁港通 - 深度思考开关：读取前端传来的 enable_thinking 参数
enableThinking := false
if request.EnableThinking != nil && *request.EnableThinking {
    enableThinking = true
    // thinking_budget 默认 8000
}
```

### 已修改文件
- `lugang-connect-enterprise/relay/adaptor/ali/main.go` - ConvertCompatRequest 函数
- `lugang-connect-enterprise/relay/adaptor/ali/model.go` - CompatChatRequest 结构体

---

## US-3: 联网搜索用户可控开关（待实施）

### 设计方案

参考深度思考开关的实现模式，在聊天输入区域添加"联网搜索"开关。

### 数据流设计

```
用户点击"联网搜索"开关
  → ChatInput 组件 localStorage 存储状态
  → ChatBox 读取状态，设置 __enableSearch__ 变量
  → dispatch/ai/chat.ts 将变量传入请求
  → request.ts 将 enable_search 字段加入请求体
  → 后端 GeneralOpenAIRequest 接收 enable_search
  → 后端根据 enable_search 决定是否添加 -internet 后缀
```

### 前端修改文件（预估）
- `ChatInput.tsx` - 添加联网搜索开关 UI
- `chat.ts` (dispatch) - 传递 enable_search 变量
- `request.ts` - 请求体添加 enable_search 字段

### 后端修改
- 当前后端通过模型 ID 后缀 `-internet` 判断是否联网搜索
- 可能需要新增 `enable_search` 请求字段，或在前端动态拼接模型 ID 后缀

---

## US-4: 后端部署流程（已完成本地配置）

### docker-compose.yml 配置

```yaml
services:
  lugang-enterprise:
    image: ghcr.io/taotie8304/lugang-enterprise:latest
    container_name: lugang-enterprise
    networks:
      - default
      - lugang-ai

networks:
  lugang-ai:
    external: true
    name: lugang-ai_default
```

### 部署步骤
1. 推送代码到 GitHub
2. 等待 GitHub Actions 构建镜像
3. 服务器执行部署命令
