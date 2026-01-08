# 鲁港通AI - 快速开始指南

## 🚀 5分钟快速部署

### 前提条件
- ✅ 服务器IP: 156.225.30.134
- ✅ 已安装宝塔面板
- ✅ 已安装Docker和Docker Compose
- ✅ One API运行在8080端口

---

## 📋 部署步骤

### 1️⃣ SSH连接服务器
```bash
ssh root@156.225.30.134
```

### 2️⃣ 克隆GitHub仓库
```bash
cd /www/wwwroot
git clone https://github.com/taotie8304/lu-gang-connect-project.git
cd lu-gang-connect-project/lugang-ai-fastgpt
```

### 3️⃣ 配置环境变量
```bash
# 复制模板文件
cp projects/app/.env.local.example projects/app/.env.local

# 编辑配置
vim projects/app/.env.local
```

**必须修改的配置**:
```bash
# 1. 数据库密码
MONGODB_URI=mongodb://root:YOUR_PASSWORD@mongo:27017/lugang_ai?authSource=admin
PG_URL=postgresql://postgres:YOUR_PASSWORD@pg:5432/postgres

# 2. 应用密钥（生成方法: openssl rand -hex 16）
TOKEN_KEY=YOUR_RANDOM_32_CHARS
FILE_TOKEN_KEY=YOUR_RANDOM_32_CHARS
AES256_SECRET_KEY=YOUR_RANDOM_32_CHARS
ROOT_KEY=YOUR_RANDOM_32_CHARS

# 3. One API Token（从One API后台获取）
AIPROXY_API_TOKEN=sk-YOUR_REAL_TOKEN

# 4. 管理员密码
DEFAULT_ROOT_PSW=YOUR_ADMIN_PASSWORD
```

### 4️⃣ 同步修改docker-compose.yml
```bash
vim docker-compose.yml
```

修改数据库密码（与.env.local保持一致）:
```yaml
mongo:
  environment:
    MONGO_INITDB_ROOT_PASSWORD: YOUR_PASSWORD

pg:
  environment:
    POSTGRES_PASSWORD: YOUR_PASSWORD
```

### 5️⃣ 构建并启动
```bash
# 构建镜像（15-30分钟）
docker build --no-cache -t lugang-ai:v1 -f projects/app/Dockerfile .

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f lugang-ai
```

### 6️⃣ 配置防火墙
在宝塔面板 → 安全 → 添加端口规则:
- 端口: 3210
- 说明: 鲁港通AI前端

### 7️⃣ 访问系统
浏览器打开: `http://156.225.30.134:3210`

- 用户名: `root`
- 密码: `.env.local`中的`DEFAULT_ROOT_PSW`

---

## 🔧 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f lugang-ai

# 重启服务
docker-compose restart

# 停止服务
docker-compose stop

# 启动服务
docker-compose start

# 完全删除（包括数据）
docker-compose down -v

# 更新代码
git pull origin main
docker build --no-cache -t lugang-ai:v1 -f projects/app/Dockerfile .
docker-compose restart
```

---

## ⚠️ 常见问题

### 问题1: 端口被占用
```bash
# 查看端口占用
netstat -tulpn | grep 3210

# 修改docker-compose.yml端口映射
ports:
  - "3211:3000"  # 改为3211
```

### 问题2: 数据库连接失败
```bash
# 确保密码一致
# .env.local 和 docker-compose.yml 中的密码必须相同

# 重新初始化数据库
docker-compose down -v
docker-compose up -d
```

### 问题3: One API连接失败
```bash
# 检查One API状态
curl http://156.225.30.134:8080/api/status

# 检查Token是否正确
# 在One API后台重新生成Token
```

---

## 📞 获取帮助

- 详细文档: `DEPLOYMENT_GUIDE_GITHUB.md`
- 代码Review: `CODE_REVIEW_REPORT.md`
- 技术支持: support@lugangconnect.com

---

**部署完成后，请立即修改默认密码！** 🔒
