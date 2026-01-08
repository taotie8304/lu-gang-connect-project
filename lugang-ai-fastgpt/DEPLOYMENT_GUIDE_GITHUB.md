# 鲁港通AI - GitHub部署指南

## 📋 目录
1. [代码Review结果](#代码review结果)
2. [GitHub仓库准备](#github仓库准备)
3. [宝塔服务器部署步骤](#宝塔服务器部署步骤)
4. [部署后验证](#部署后验证)
5. [常见问题](#常见问题)

---

## 🔍 代码Review结果

### ✅ 已验证正确的配置

#### 1. 插件服务禁用配置
- **状态**: ✅ 正确
- **文件**: `.env.local`
- **配置**: `PLUGIN_BASE_URL=` (空值)
- **逻辑**: 所有使用`pluginClient`的文件都已添加空值检查

#### 2. Docker Compose配置
- **状态**: ✅ 正确
- **文件**: `docker-compose.yml`
- **服务**: 
  - ✅ MongoDB (端口27017)
  - ✅ PostgreSQL (端口5432)
  - ✅ Redis (端口6380，避免与宝塔冲突)
  - ❌ MinIO (已禁用)
  - ❌ Sandbox (已禁用)
  - ❌ Plugin (已禁用)

#### 3. 品牌定制
- **状态**: ✅ 正确
- **系统标题**: "鲁港通AI助手"
- **Slogan**: "你好👋，我是鲁港通AI助手！"
- **Logo**: `/icon/logo.png`
- **隐藏功能**: GitHub链接、应用商店、推广功能

#### 4. One API集成
- **状态**: ⚠️ 需要配置
- **端点**: `http://156.225.30.134:8080`
- **Token**: `sk-your-oneapi-token` (占位符，需要替换)

### ⚠️ 需要注意的配置

#### 1. 数据库密码（生产环境需修改）
```bash
# MongoDB
MONGO_INITDB_ROOT_PASSWORD=password  # ⚠️ 建议修改

# PostgreSQL
POSTGRES_PASSWORD=password  # ⚠️ 建议修改

# 应用密钥
TOKEN_KEY=lugangai2025  # ⚠️ 建议修改为随机字符串
```

#### 2. One API Token
```bash
AIPROXY_API_TOKEN=sk-your-oneapi-token  # ❌ 必须替换为真实Token
```

### 🔧 代码逻辑验证

#### 已修复的空值检查逻辑

| 文件 | 函数/模块 | 空值处理 | 状态 |
|------|-----------|----------|------|
| `model.ts` | `loadModelProviders` | 返回空modelProviders | ✅ |
| `tool/api.ts` | `APIGetSystemToolList` | 返回空数组 | ✅ |
| `tool/api.ts` | `APIRunSystemTool` | 条件创建实例 | ✅ |
| `tool/api.ts` | `getSystemToolTags` | 返回空数组 | ✅ |
| `templates/register.ts` | `getFileTemplates` | 返回空数组 | ✅ |
| `controller.ts` | `preloadModelProviders` | 跳过加载 | ✅ |
| `config/utils.ts` | `loadSystemModels` | 条件加载 | ✅ |
| `presign.ts` | API Handler | 返回错误 | ✅ |
| `parse.ts` | API Handler | 返回错误 | ✅ |
| `delete.ts` | API Handler | 返回错误 | ✅ |
| `confirm.ts` | API Handler | 返回错误 | ✅ |
| `installWithUrl.ts` | API Handler | 返回错误 | ✅ |

### ❌ 发现的潜在问题

#### 1. pluginClient初始化问题
**文件**: `packages/service/thirdProvider/fastgptPlugin/index.ts`

**当前代码**:
```typescript
export const pluginClient = createClient({
  baseUrl: PLUGIN_BASE_URL,  // 空字符串会导致Invalid URL
  token: PLUGIN_TOKEN
});
```

**问题**: 当`PLUGIN_BASE_URL`为空时，`createClient`可能会抛出Invalid URL错误

**建议修复**:
```typescript
export const pluginClient = PLUGIN_BASE_URL 
  ? createClient({
      baseUrl: PLUGIN_BASE_URL,
      token: PLUGIN_TOKEN
    })
  : null;  // 或者创建一个mock client
```

**影响**: 虽然所有调用处都有空值检查，但初始化时可能会报错

#### 2. 端口冲突风险
- MongoDB: 27017 (可能与宝塔其他服务冲突)
- PostgreSQL: 5432 (可能与宝塔其他服务冲突)
- Redis: 6380 (已避免冲突)

**建议**: 检查宝塔服务器是否已有这些端口占用

---

## 📦 GitHub仓库准备

### 1. 确认仓库结构

你的GitHub仓库应该包含以下结构：
```
lu-gang-connect-project/
├── lugang-ai-fastgpt/          # FastGPT前端项目
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── packages/
│   ├── projects/
│   │   └── app/
│   │       ├── .env.local
│   │       ├── data/
│   │       │   └── config.json
│   │       └── public/
│   │           ├── icon/
│   │           │   └── logo.png
│   │           └── favicon.png
│   └── ...
└── lugang-connect-enterprise/  # One API后端项目
    └── ...
```

### 2. 敏感信息处理

⚠️ **重要**: 确保以下文件不要提交到GitHub：
- `.env.local` 中的真实密码和Token
- 数据库数据文件 (`data/mongo`, `data/pg`, `data/redis`)

**建议**: 创建 `.env.local.example` 模板文件：
```bash
# 在GitHub中提交模板文件
cp projects/app/.env.local projects/app/.env.local.example

# 将敏感信息替换为占位符
sed -i 's/password/YOUR_PASSWORD/g' projects/app/.env.local.example
sed -i 's/sk-your-oneapi-token/YOUR_ONEAPI_TOKEN/g' projects/app/.env.local.example
```

### 3. .gitignore 配置

确保 `.gitignore` 包含：
```gitignore
# 环境变量
.env.local
.env.production

# 数据文件
data/mongo/
data/pg/
data/redis/
data/minio/

# Node modules
node_modules/
.pnpm-store/

# Build outputs
.next/
dist/
build/

# Logs
*.log
npm-debug.log*
```

---

## 🚀 宝塔服务器部署步骤

### 前置条件

1. **服务器信息**:
   - IP: 156.225.30.134
   - 已安装: 宝塔面板
   - 已安装: Docker & Docker Compose

2. **检查Docker安装**:
```bash
docker --version
docker-compose --version
```

如果未安装，在宝塔面板安装Docker管理器插件。

---

### 步骤1: SSH连接服务器

```bash
# 使用宝塔终端或SSH客户端
ssh root@156.225.30.134
```

---

### 步骤2: 清理旧部署（如果存在）

```bash
# 停止并删除旧容器
cd /www/wwwroot/lugang-ai-fastgpt
docker-compose down -v

# 备份旧数据（可选）
mv data data.backup.$(date +%Y%m%d_%H%M%S)

# 删除旧代码
cd /www/wwwroot
rm -rf lugang-ai-fastgpt
```

---

### 步骤3: 从GitHub克隆项目

```bash
# 进入部署目录
cd /www/wwwroot

# 克隆GitHub仓库
git clone https://github.com/taotie8304/lu-gang-connect-project.git

# 进入FastGPT项目目录
cd lu-gang-connect-project/lugang-ai-fastgpt
```

---

### 步骤4: 配置环境变量

```bash
# 复制环境变量模板
cp projects/app/.env.local.example projects/app/.env.local

# 编辑环境变量（使用vim或nano）
vim projects/app/.env.local
```

**必须修改的配置**:
```bash
# 1. 数据库密码（建议修改）
MONGO_INITDB_ROOT_PASSWORD=YOUR_STRONG_PASSWORD
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD

# 2. 应用密钥（建议修改）
TOKEN_KEY=YOUR_RANDOM_STRING_32_CHARS
FILE_TOKEN_KEY=YOUR_RANDOM_STRING_32_CHARS
AES256_SECRET_KEY=YOUR_RANDOM_STRING_32_CHARS
ROOT_KEY=YOUR_RANDOM_STRING_32_CHARS

# 3. One API Token（必须修改）
AIPROXY_API_TOKEN=sk-YOUR_REAL_ONEAPI_TOKEN

# 4. 默认root密码（建议修改）
DEFAULT_ROOT_PSW=YOUR_ADMIN_PASSWORD
```

**生成随机密钥**:
```bash
# 生成32位随机字符串
openssl rand -hex 16
```

---

### 步骤5: 同步修改docker-compose.yml密码

```bash
vim docker-compose.yml
```

修改MongoDB和PostgreSQL密码，与`.env.local`保持一致：
```yaml
mongo:
  environment:
    MONGO_INITDB_ROOT_PASSWORD: YOUR_STRONG_PASSWORD  # 与.env.local一致

pg:
  environment:
    POSTGRES_PASSWORD: YOUR_STRONG_PASSWORD  # 与.env.local一致
```

---

### 步骤6: 检查端口占用

```bash
# 检查端口是否被占用
netstat -tulpn | grep -E '27017|5432|6380|3210'

# 如果有冲突，修改docker-compose.yml中的端口映射
# 例如: "27018:27017" 将MongoDB映射到27018
```

---

### 步骤7: 构建Docker镜像

```bash
# 构建FastGPT镜像（需要15-30分钟）
docker build --no-cache -t lugang-ai:v1 -f projects/app/Dockerfile .

# 查看构建结果
docker images | grep lugang-ai
```

**预期输出**:
```
lugang-ai    v1    abc123def456    2 minutes ago    1.2GB
```

---

### 步骤8: 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

**预期输出**:
```
NAME                IMAGE              STATUS
lugang-ai-app       lugang-ai:v1       Up (healthy)
lugang-ai-mongo     mongo:5.0.18       Up
lugang-ai-pg        pgvector/pgvector  Up
lugang-ai-redis     redis:7.2-alpine   Up
```

---

### 步骤9: 查看日志

```bash
# 查看应用日志
docker-compose logs -f lugang-ai

# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f mongo
docker-compose logs -f pg
docker-compose logs -f redis
```

**正常启动日志应包含**:
```
[Info] PLUGIN_BASE_URL is not set, skipping plugin model providers loading
Load models success, total: X, active: Y
Server listening on port 3000
```

---

### 步骤10: 配置宝塔防火墙

在宝塔面板中：
1. 进入 **安全** 页面
2. 添加端口规则：
   - 3210 (FastGPT前端)
   - 8080 (One API，如果需要外部访问)
3. 保存规则

---

## ✅ 部署后验证

### 1. 健康检查

```bash
# 检查应用健康状态
curl -I http://localhost:3210/api/health

# 预期返回: HTTP/1.1 200 OK
```

### 2. 访问前端

浏览器访问: `http://156.225.30.134:3210`

**预期看到**:
- 系统标题: "鲁港通AI助手"
- Slogan: "你好👋，我是鲁港通AI助手！"
- 鲁港通Logo

### 3. 测试登录

- 用户名: `root`
- 密码: `.env.local`中设置的`DEFAULT_ROOT_PSW`

### 4. 检查One API连接

在FastGPT中：
1. 进入 **模型配置**
2. 检查是否能看到DeepSeek和Qwen模型
3. 测试对话功能

---

## 🔄 更新部署

当GitHub代码更新后：

```bash
# 1. 进入项目目录
cd /www/wwwroot/lu-gang-connect-project/lugang-ai-fastgpt

# 2. 拉取最新代码
git pull origin main

# 3. 重新构建镜像
docker build --no-cache -t lugang-ai:v1 -f projects/app/Dockerfile .

# 4. 重启服务
docker-compose down
docker-compose up -d

# 5. 查看日志
docker-compose logs -f lugang-ai
```

---

## 🐛 常见问题

### 问题1: Docker构建失败 - "Invalid URL"

**原因**: `pluginClient`初始化时PLUGIN_BASE_URL为空

**解决方案**:
```bash
# 修改 packages/service/thirdProvider/fastgptPlugin/index.ts
# 添加条件判断（已在本地修复，需要推送到GitHub）
```

### 问题2: 端口冲突

**错误**: `bind: address already in use`

**解决方案**:
```bash
# 1. 查找占用端口的进程
lsof -i :27017

# 2. 停止冲突服务或修改docker-compose.yml端口映射
vim docker-compose.yml
# 修改: "27018:27017"
```

### 问题3: 数据库连接失败

**错误**: `MongoServerError: Authentication failed`

**解决方案**:
```bash
# 确保.env.local和docker-compose.yml中的密码一致
# 删除数据卷重新初始化
docker-compose down -v
docker-compose up -d
```

### 问题4: One API连接失败

**错误**: 无法获取模型列表

**解决方案**:
```bash
# 1. 检查One API是否运行
curl http://156.225.30.134:8080/api/status

# 2. 检查Token是否正确
# 在One API后台生成新Token并更新.env.local

# 3. 重启FastGPT
docker-compose restart lugang-ai
```

### 问题5: 前端无法访问

**解决方案**:
```bash
# 1. 检查容器状态
docker-compose ps

# 2. 检查防火墙
firewall-cmd --list-ports

# 3. 检查宝塔安全规则
# 在宝塔面板添加3210端口
```

---

## 📝 维护命令

```bash
# 查看容器状态
docker-compose ps

# 查看资源使用
docker stats

# 重启服务
docker-compose restart

# 停止服务
docker-compose stop

# 启动服务
docker-compose start

# 完全删除（包括数据）
docker-compose down -v

# 备份数据
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 查看网络
docker network ls
docker network inspect lugang-ai-network
```

---

## 🔐 安全建议

1. **修改默认密码**: 首次登录后立即修改root密码
2. **使用强密码**: 数据库和应用密钥使用32位以上随机字符串
3. **定期备份**: 每天备份`data/`目录
4. **监控日志**: 定期检查`docker-compose logs`
5. **更新镜像**: 定期更新基础镜像版本
6. **限制访问**: 使用宝塔防火墙限制IP访问

---

## 📞 技术支持

- 项目GitHub: https://github.com/taotie8304/lu-gang-connect-project
- 技术支持: support@lugangconnect.com
- FastGPT官方文档: https://doc.fastgpt.in/

---

**部署完成！** 🎉
