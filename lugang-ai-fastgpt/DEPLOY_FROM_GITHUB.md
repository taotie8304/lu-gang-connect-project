# 从GitHub部署鲁港通AI

## 方案说明

由于服务器内存有限（7.6G），在服务器上构建Docker镜像会占用5.6G内存，可能导致系统崩溃。

因此采用**GitHub Actions自动构建**方案：
- GitHub云端自动构建Docker镜像
- 服务器直接拉取已构建好的镜像
- 节省服务器资源，部署更快

---

## 步骤1: 配置GitHub仓库

### 1.1 启用GitHub Container Registry

1. 访问您的GitHub仓库：https://github.com/taotie8304/lu-gang-connect-project

2. 点击 **Settings** → **Actions** → **General**

3. 滚动到 **Workflow permissions**，选择：
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests**

4. 点击 **Save**

### 1.2 设置包为公开（重要）

构建完成后，需要将包设置为公开，否则服务器无法拉取：

1. 访问：https://github.com/taotie8304?tab=packages

2. 找到 **lugang-ai** 包

3. 点击进入包页面

4. 点击右侧 **Package settings**

5. 滚动到底部 **Danger Zone**

6. 点击 **Change visibility** → 选择 **Public** → 确认

---

## 步骤2: 推送代码触发构建

### 2.1 提交并推送代码

在本地（您的电脑）执行：

```bash
cd lu-gang-connect-project

# 添加所有文件
git add .

# 提交
git commit -m "Add GitHub Actions for Docker build"

# 推送到GitHub
git push origin main
```

### 2.2 查看构建进度

1. 访问：https://github.com/taotie8304/lu-gang-connect-project/actions

2. 查看 **Build and Push Docker Image** 工作流

3. 等待构建完成（约10-15分钟）

4. 看到绿色✅表示成功

---

## 步骤3: 服务器部署

### 3.1 配置环境变量

在服务器上执行：

```bash
cd /www/wwwroot/lugang-ai-fastgpt

# 创建环境变量文件
cat > projects/app/.env.local << 'EOF'
# 日志配置
LOG_DEPTH=3
LOG_LEVEL=info
STORE_LOG_LEVEL=warn

# 管理员密码
DEFAULT_ROOT_PSW=lugang2024

# 数据库配置
DB_MAX_LINK=10
MONGODB_URI=mongodb://root:password@mongo:27017/lugang_ai?authSource=admin
MONGODB_LOG_URI=mongodb://root:password@mongo:27017/lugang_ai?authSource=admin

# PostgreSQL
PG_URL=postgresql://postgres:password@pg:5432/postgres

# Redis
REDIS_URL=redis://redis:6379

# 密钥
TOKEN_KEY=fastgpttokenkey2024
FILE_TOKEN_KEY=fastgptfilekey2024
AES256_SECRET_KEY=fastgptaes256key2024
ROOT_KEY=fastgptrootkey2024

# One API配置
AIPROXY_API_ENDPOINT=http://156.225.30.134:8080
AIPROXY_API_TOKEN=sk-your-oneapi-token

# 插件服务（禁用）
PLUGIN_BASE_URL=
PLUGIN_TOKEN=

# 域名配置
FE_DOMAIN=http://156.225.30.134:3210
FILE_DOMAIN=http://156.225.30.134:3210

# 功能开关
HIDE_CHAT_COPYRIGHT_SETTING=true
USE_IP_LIMIT=false
SHOW_COUPON=false
SHOW_DISCOUNT_COUPON=false

# 安全配置
WORKFLOW_MAX_RUN_TIMES=500
WORKFLOW_MAX_LOOP_TIMES=50
SERVICE_REQUEST_MAX_CONTENT_LENGTH=10
CHECK_INTERNAL_IP=false

# 性能配置
EMBEDDING_CHUNK_SIZE=10
MULTIPLE_DATA_TO_BASE64=true
EOF
```

### 3.2 获取One API Token

1. 访问：http://156.225.30.134:8080
2. 登录One API
3. 创建或复制Token（格式：`sk-xxxxxx`）
4. 编辑环境变量：

```bash
nano projects/app/.env.local
```

修改这一行：
```
AIPROXY_API_TOKEN=sk-你的真实Token
```

保存退出（Ctrl+O, Enter, Ctrl+X）

### 3.3 拉取镜像并启动

```bash
cd /www/wwwroot/lugang-ai-fastgpt

# 停止现有服务
docker-compose down

# 拉取最新镜像（不需要构建！）
docker-compose pull

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f lugang-ai
```

---

## 步骤4: 验证部署

### 4.1 检查服务状态

```bash
docker-compose ps
```

应该看到所有服务都是 **Up** 状态

### 4.2 访问系统

浏览器打开：http://156.225.30.134:3210

- 账号：`root`
- 密码：`lugang2024`（或您设置的密码）

---

## 后续更新

每次修改代码后：

```bash
# 1. 本地提交并推送
git add .
git commit -m "更新说明"
git push origin main

# 2. 等待GitHub Actions构建完成（10-15分钟）

# 3. 服务器更新
cd /www/wwwroot/lugang-ai-fastgpt
docker-compose pull
docker-compose up -d
```

---

## 常见问题

### Q1: 拉取镜像失败

**错误**：`pull access denied`

**原因**：包未设置为公开

**解决**：按照步骤1.2设置包为公开

### Q2: GitHub Actions构建失败

**检查**：
1. 访问 Actions 页面查看错误日志
2. 确认 Workflow permissions 已设置为 Read and write

### Q3: 服务启动失败

**检查**：
1. 环境变量是否正确配置
2. One API Token是否有效
3. 查看日志：`docker-compose logs -f lugang-ai`

---

## 优势

✅ **节省服务器资源**：不在服务器上构建，内存占用低
✅ **部署速度快**：直接拉取镜像，几分钟完成
✅ **自动化**：推送代码自动构建，无需手动操作
✅ **稳定可靠**：GitHub云端构建，不受服务器限制
