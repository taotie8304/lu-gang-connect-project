# 鲁港通跨境AI智能平台 - 服务器部署指南

## 📋 部署概览

本指南将帮助您在服务器上部署鲁港通跨境AI智能平台（基于 FastGPT 4.14.4 定制）。

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户访问                                  │
│                       │                                      │
│                       ▼                                      │
│              www.airscend.com:443                           │
│                    (Nginx)                                   │
│                       │                                      │
│         ┌────────────┴────────────┐                         │
│         ▼                         ▼                          │
│   FastGPT (3210)           One API (8080)                   │
│   鲁港通AI主应用            api.airscend.com                 │
│         │                         │                          │
│         └────────────┬────────────┘                         │
│                      │                                       │
│    ┌─────────────────┼─────────────────┐                    │
│    ▼                 ▼                 ▼                     │
│  MongoDB          PostgreSQL        Redis                   │
│  (27017)           (5432)          (6380)                   │
└─────────────────────────────────────────────────────────────┘
```

### 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 IP | 156.225.30.134 |
| FastGPT 域名 | www.airscend.com |
| One API 域名 | api.airscend.com |
| FastGPT 端口 | 3210 |
| One API 端口 | 8080 |

---

## 🚀 快速部署步骤

### 第一步：推送代码触发构建

```bash
# 在本地开发机器上
cd lu-gang-connect-project

# 提交代码
git add .
git commit -m "feat: 鲁港通平台集成完成"

# 推送到 GitHub（自动触发 Docker 镜像构建）
git push origin main
```

### 第二步：等待 GitHub Actions 构建完成

1. 访问 GitHub 仓库的 Actions 页面
2. 查看 "Build and Push Docker Image" 工作流
3. 等待构建完成（约 5-10 分钟）
4. 构建成功后，镜像会推送到：
   ```
   ghcr.io/<your-github-username>/lugang-ai:latest
   ```

### 第三步：服务器部署

```bash
# SSH 登录服务器
ssh root@156.225.30.134

# 进入项目目录
cd /www/wwwroot/lugang-ai-fastgpt

# 拉取最新代码
git pull origin main

# 执行部署脚本
./deploy-prod.sh
```

---

## 📝 详细部署步骤

### 1. 服务器环境准备

#### 1.1 安装 Docker 和 Docker Compose

```bash
# 安装 Docker（如果未安装）
curl -fsSL https://get.docker.com | bash -s docker

# 启动 Docker
systemctl start docker
systemctl enable docker

# 验证安装
docker --version
docker-compose --version
```

#### 1.2 创建项目目录

```bash
# 创建目录
mkdir -p /www/wwwroot/lugang-ai-fastgpt
cd /www/wwwroot/lugang-ai-fastgpt

# 克隆代码（首次部署）
git clone https://github.com/<your-username>/lu-gang-connect-project.git .
```

### 2. 配置环境变量

#### 2.1 创建部署配置文件

```bash
# 创建 .env.deploy 文件
cat > .env.deploy << 'EOF'
# GitHub 用户名（必填）
GITHUB_USERNAME=your-github-username

# 镜像标签
IMAGE_TAG=latest

# GitHub Container Registry Token（私有仓库需要）
GHCR_TOKEN=ghp_xxxxxxxxxxxx

# 数据库密码（请修改为强密码）
MONGO_PASSWORD=LuGang@Mongo2025
PG_PASSWORD=LuGang@PG2025
EOF
```

#### 2.2 配置应用环境变量

```bash
# 编辑环境变量文件
nano projects/app/.env.local
```

**必须修改的配置项：**

```bash
# 管理员密码（首次登录使用）
DEFAULT_ROOT_PSW=YourStrongPassword2025

# 数据库密码（与 .env.deploy 保持一致）
MONGODB_URI=mongodb://root:LuGang@Mongo2025@mongo:27017/lugang_ai?authSource=admin
PG_URL=postgresql://postgres:LuGang@PG2025@pg:5432/postgres

# 安全密钥（使用随机字符串）
TOKEN_KEY=<随机32位字符串>
FILE_TOKEN_KEY=<随机32位字符串>
AES256_SECRET_KEY=<随机32位字符串>
ROOT_KEY=<随机32位字符串>

# One API 配置
AIPROXY_API_ENDPOINT=http://156.225.30.134:8080
AIPROXY_API_TOKEN=sk-your-oneapi-admin-token

# One API 集成（用于用户同步和额度查询）
ONE_API_URL=http://156.225.30.134:8080
ONE_API_TOKEN=sk-your-oneapi-admin-token

# 域名配置
FE_DOMAIN=https://www.airscend.com
FILE_DOMAIN=https://www.airscend.com
```

**生成随机密钥：**

```bash
# 生成随机密钥
openssl rand -hex 16
```

### 3. 登录 GitHub Container Registry

```bash
# 使用 Personal Access Token 登录
echo "ghp_xxxxxxxxxxxx" | docker login ghcr.io -u your-github-username --password-stdin
```

### 4. 执行部署

```bash
# 赋予执行权限
chmod +x deploy-prod.sh

# 执行部署脚本
./deploy-prod.sh
```

### 5. 验证部署

```bash
# 检查容器状态
docker-compose -f docker-compose.prod.yml ps

# 检查应用健康状态
curl http://localhost:3210/api/health

# 查看应用日志
docker logs -f lugang-ai-app
```

---

## 🔧 Nginx 反向代理配置

### FastGPT (www.airscend.com)

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name www.airscend.com;

    # SSL 证书配置
    ssl_certificate /www/server/panel/vhost/cert/www.airscend.com/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/www.airscend.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE;
    ssl_prefer_server_ciphers on;

    # HTTP 重定向到 HTTPS
    if ($scheme = http) {
        return 301 https://$host$request_uri;
    }

    # 代理配置
    location / {
        proxy_pass http://127.0.0.1:3210;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://127.0.0.1:3210;
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
```

### One API (api.airscend.com)

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name api.airscend.com;

    # SSL 证书配置
    ssl_certificate /www/server/panel/vhost/cert/api.airscend.com/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/api.airscend.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE;
    ssl_prefer_server_ciphers on;

    if ($scheme = http) {
        return 301 https://$host$request_uri;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE 支持（用于流式响应）
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

---

## 🔄 更新部署

当有新代码推送后：

```bash
# 方式一：使用部署脚本（推荐）
cd /www/wwwroot/lugang-ai-fastgpt
git pull origin main
./deploy-prod.sh

# 方式二：手动更新
docker pull ghcr.io/<your-username>/lugang-ai:latest
docker-compose -f docker-compose.prod.yml up -d --force-recreate lugang-ai
```

---

## 🛠 常用运维命令

### 查看服务状态

```bash
# 查看所有容器状态
docker-compose -f docker-compose.prod.yml ps

# 查看应用日志
docker logs -f lugang-ai-app

# 查看最近 100 行日志
docker logs --tail 100 lugang-ai-app
```

### 重启服务

```bash
# 重启所有服务
docker-compose -f docker-compose.prod.yml restart

# 只重启应用
docker-compose -f docker-compose.prod.yml restart lugang-ai
```

### 停止服务

```bash
# 停止所有服务
docker-compose -f docker-compose.prod.yml down

# 停止并删除数据卷（危险！会删除数据）
docker-compose -f docker-compose.prod.yml down -v
```

### 数据备份

```bash
# 备份 MongoDB
docker exec lugang-ai-mongo mongodump \
  --username root \
  --password LuGang@Mongo2025 \
  --authenticationDatabase admin \
  --out /data/backup/$(date +%Y%m%d)

# 复制备份到宿主机
docker cp lugang-ai-mongo:/data/backup ./backup/

# 备份 PostgreSQL
docker exec lugang-ai-pg pg_dump \
  -U postgres postgres > ./backup/pg_$(date +%Y%m%d).sql
```

---

## ❗ 故障排查

### 1. 镜像拉取失败

```bash
# 检查登录状态
docker login ghcr.io

# 检查镜像是否存在
docker manifest inspect ghcr.io/<your-username>/lugang-ai:latest

# 重新登录
echo "your-token" | docker login ghcr.io -u your-username --password-stdin
```

### 2. 容器启动失败

```bash
# 查看详细日志
docker logs lugang-ai-app

# 检查配置文件
cat projects/app/.env.local

# 检查端口占用
netstat -tlnp | grep 3210
```

### 3. 数据库连接失败

```bash
# 检查数据库容器状态
docker-compose -f docker-compose.prod.yml ps mongo pg

# 测试 MongoDB 连接
docker exec -it lugang-ai-mongo mongosh \
  --username root \
  --password LuGang@Mongo2025 \
  --authenticationDatabase admin

# 测试 PostgreSQL 连接
docker exec -it lugang-ai-pg psql -U postgres
```

### 4. One API 连接失败

```bash
# 检查 One API 服务状态
curl http://156.225.30.134:8080/api/status

# 检查环境变量配置
grep ONE_API projects/app/.env.local
```

---

## 🔐 安全建议

1. **修改所有默认密码**
   - MongoDB 密码
   - PostgreSQL 密码
   - 管理员密码
   - 所有密钥

2. **使用防火墙限制端口**
   ```bash
   # 只开放必要端口
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP
   ufw allow 443/tcp   # HTTPS
   ufw enable
   ```

3. **定期备份数据**
   ```bash
   # 添加定时备份任务
   crontab -e
   # 每天凌晨 3 点备份
   0 3 * * * /www/wwwroot/lugang-ai-fastgpt/backup.sh
   ```

4. **监控服务状态**
   - 使用宝塔面板监控
   - 配置告警通知

---

## 📞 技术支持

如有问题，请联系技术支持或提交 GitHub Issue。
