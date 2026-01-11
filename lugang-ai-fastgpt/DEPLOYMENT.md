# 鲁港通AI - 部署指南

## 概述

本文档介绍如何使用 GitHub Actions 自动构建 Docker 镜像，并在堡塔服务器上部署鲁港通AI系统。

## 架构说明

```
GitHub Repository
       │
       ▼ (push to main)
GitHub Actions (自动构建)
       │
       ▼ (push image)
GitHub Container Registry (ghcr.io)
       │
       ▼ (docker pull)
堡塔服务器 (Docker Compose)
```

## 前置要求

### GitHub 仓库设置

1. **启用 GitHub Actions**
   - 进入仓库 Settings → Actions → General
   - 选择 "Allow all actions and reusable workflows"

2. **启用 GitHub Packages**
   - 进入仓库 Settings → Actions → General
   - 在 "Workflow permissions" 中选择 "Read and write permissions"

3. **设置仓库可见性**（如果需要公开镜像）
   - 进入仓库 Settings → Packages
   - 将包的可见性设置为 Public（可选）

### 堡塔服务器要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB 内存
- 至少 20GB 磁盘空间

## 自动构建流程

### 触发条件

GitHub Actions 会在以下情况自动触发构建：

1. **推送到 main 分支**
   - 修改 `lugang-ai-fastgpt/` 目录下的文件
   - 修改 `.github/workflows/docker-build.yml`

2. **手动触发**
   - 进入 Actions 页面
   - 选择 "Build and Push Docker Image" workflow
   - 点击 "Run workflow"
   - 可选择是否使用国内镜像加速

### 构建产物

构建成功后，镜像会推送到：
```
ghcr.io/<your-username>/lugang-ai:latest
ghcr.io/<your-username>/lugang-ai:<commit-sha>
```

## 服务器部署步骤

### 1. 准备配置文件

```bash
# 进入项目目录
cd /www/wwwroot/lugang-ai-fastgpt

# 复制环境变量模板
cp projects/app/.env.local.example projects/app/.env.local

# 编辑配置文件
nano projects/app/.env.local
```

**必须修改的配置项：**
- `DEFAULT_ROOT_PSW` - 管理员密码
- `MONGODB_URI` - MongoDB 连接字符串（修改密码）
- `PG_URL` - PostgreSQL 连接字符串（修改密码）
- `TOKEN_KEY`, `FILE_TOKEN_KEY`, `AES256_SECRET_KEY`, `ROOT_KEY` - 安全密钥
- `AIPROXY_API_TOKEN` - One API Token
- `FE_DOMAIN`, `FILE_DOMAIN` - 服务器域名/IP

### 2. 设置环境变量

```bash
# 设置 GitHub 用户名
export GITHUB_USERNAME=your-github-username

# 如果镜像是私有的，需要设置 Token
export GHCR_TOKEN=your-github-token
```

### 3. 登录 GitHub Container Registry

```bash
# 使用 Token 登录
echo $GHCR_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin
```

### 4. 拉取并启动服务

**方式一：使用部署脚本**
```bash
chmod +x deploy-prod.sh
./deploy-prod.sh
```

**方式二：手动部署**
```bash
# 拉取最新镜像
docker pull ghcr.io/$GITHUB_USERNAME/lugang-ai:latest

# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker logs -f lugang-ai-app
```

### 5. 验证部署

```bash
# 检查容器状态
docker-compose -f docker-compose.prod.yml ps

# 检查健康状态
curl http://localhost:3210/api/health

# 访问 Web 界面
# http://YOUR_SERVER_IP:3210
```

## 更新部署

当 GitHub 上有新的代码推送后：

```bash
# 拉取最新镜像
docker pull ghcr.io/$GITHUB_USERNAME/lugang-ai:latest

# 重启服务
docker-compose -f docker-compose.prod.yml up -d --force-recreate lugang-ai

# 或使用部署脚本
./deploy-prod.sh
```

## 故障排查

### 构建失败

1. **检查 GitHub Actions 日志**
   - 进入 Actions 页面查看详细错误信息

2. **常见问题**
   - 权限不足：检查 Workflow permissions 设置
   - 网络超时：尝试使用国内镜像加速（手动触发时选择）
   - 内存不足：GitHub Actions 提供 7GB 内存，通常足够

### 部署失败

1. **镜像拉取失败**
   ```bash
   # 检查登录状态
   docker login ghcr.io
   
   # 检查镜像是否存在
   docker manifest inspect ghcr.io/$GITHUB_USERNAME/lugang-ai:latest
   ```

2. **容器启动失败**
   ```bash
   # 查看详细日志
   docker logs lugang-ai-app
   
   # 检查配置文件
   cat projects/app/.env.local
   ```

3. **数据库连接失败**
   ```bash
   # 检查数据库容器状态
   docker-compose -f docker-compose.prod.yml ps
   
   # 检查网络连接
   docker exec lugang-ai-app ping mongo
   ```

## 安全建议

1. **修改默认密码**
   - MongoDB: `MONGO_INITDB_ROOT_PASSWORD`
   - PostgreSQL: `POSTGRES_PASSWORD`
   - 管理员: `DEFAULT_ROOT_PSW`

2. **使用强密钥**
   ```bash
   # 生成随机密钥
   openssl rand -hex 16
   ```

3. **限制端口访问**
   - 使用防火墙限制 27017, 5432, 6380 端口
   - 只开放 3210 端口给外部访问

4. **定期备份**
   ```bash
   # 备份 MongoDB
   docker exec lugang-ai-mongo mongodump --out /data/backup
   
   # 备份 PostgreSQL
   docker exec lugang-ai-pg pg_dump -U postgres postgres > backup.sql
   ```

## 联系支持

如有问题，请联系技术支持或提交 GitHub Issue。
