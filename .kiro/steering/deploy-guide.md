---
inclusion: manual
---

# 鲁港通 - 服务器部署速查

> 每次部署时参考此文件，避免重复询问用户。

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 IP | 156.225.30.134 |
| 登录方式 | `ssh root@156.225.30.134` |
| 项目目录 | `/www/wwwroot/lugang-ai` |
| 面板 | 宝塔面板（BT-Panel） |
| 前端域名 | www.airscend.com |
| 后端域名 | api.airscend.com |
| 前端端口 | 3210 |
| 后端端口 | 8080 |
| GitHub 仓库 | taotie8304/lu-gang-connect-project |

## 容器列表

| 容器名 | 镜像 | 说明 |
|--------|------|------|
| lugang-ai-app | ghcr.io/taotie8304/lugang-ai:latest | 前端（FastGPT 二开） |
| lugang-enterprise | ghcr.io/taotie8304/lugang-enterprise:latest | 后端（One API 二开） |
| lugang-ai-mongo | mongo:5.0.18 | MongoDB 数据库 |
| lugang-ai-pg | pgvector/pgvector:pg15 | PostgreSQL 向量数据库 |
| lugang-ai-redis | redis:7.2-alpine | Redis 缓存 |
| lugang-ai-minio | minio | 对象存储 |
| lugang-ai-sandbox | fastgpt-sandbox:v4.14.4 | 代码沙箱 |

## 部署方式

服务器上**没有 git 仓库**，不需要 `git pull`。部署流程是：
1. 本地推送代码到 GitHub
2. GitHub Actions 自动构建 Docker 镜像并推送到 ghcr.io
3. 服务器上拉取新镜像并重启容器

**重要：前端和后端的部署方式不同！**
- 前端（lugang-ai-app）：在 docker-compose.yml 中定义，用 `docker-compose up` 部署
- 后端（lugang-enterprise）：**不在 docker-compose.yml 中**，是单独用 `docker run` 启动的，必须手动停止/删除/重新运行

## 只更新前端

```bash
docker pull ghcr.io/taotie8304/lugang-ai:latest
cd /www/wwwroot/lugang-ai
docker-compose up -d --force-recreate lugang-ai
docker logs lugang-ai-app --tail 30
```

## 只更新后端

**注意：后端不在 docker-compose.yml 中，不能用 docker-compose 命令！**

```bash
docker pull ghcr.io/taotie8304/lugang-enterprise:latest
docker stop lugang-enterprise && docker rm lugang-enterprise
docker run -d \
  --name lugang-enterprise \
  --restart always \
  --network lugang-connect-enterprise_default \
  -p 8080:8080 \
  -e GIN_MODE=release \
  -e PORT=8080 \
  -e "TRUSTED_PROXIES=127.0.0.1,::1" \
  -e SQL_MAX_IDLE_CONNS=10 \
  -e "SQL_DSN=lugang_connect:huijin8304@tcp(172.17.0.1:3306)/lugang_connect?charset=utf8&parseTime=True&loc=Local&sql_mode=''" \
  -e LUGANG_KNOWLEDGE_BASE_ENABLED=true \
  -e THEME=berry \
  -e MEMORY_CACHE_ENABLED=true \
  -e SQL_MAX_LIFETIME=3600 \
  -e LUGANG_DEMO_MODE=false \
  -e LANG=C.UTF-8 \
  -e SESSION_SECRET=lugang_enterprise_2024_secure_key_change_me \
  -e LC_ALL=C.UTF-8 \
  -e LOG_LEVEL=info \
  -e TZ=Asia/Shanghai \
  -e SQL_MAX_OPEN_CONNS=100 \
  -e LUGANG_ENTERPRISE_MODE=true \
  -e SYNC_FREQUENCY=300 \
  ghcr.io/taotie8304/lugang-enterprise:latest
docker logs lugang-enterprise --tail 30
```

## 前端+后端都更新

```bash
# 拉取镜像
docker pull ghcr.io/taotie8304/lugang-ai:latest
docker pull ghcr.io/taotie8304/lugang-enterprise:latest

# 更新前端（docker-compose）
cd /www/wwwroot/lugang-ai
docker-compose up -d --force-recreate lugang-ai

# 更新后端（docker run）
docker stop lugang-enterprise && docker rm lugang-enterprise
docker run -d \
  --name lugang-enterprise \
  --restart always \
  --network lugang-connect-enterprise_default \
  -p 8080:8080 \
  -e GIN_MODE=release \
  -e PORT=8080 \
  -e "TRUSTED_PROXIES=127.0.0.1,::1" \
  -e SQL_MAX_IDLE_CONNS=10 \
  -e "SQL_DSN=lugang_connect:huijin8304@tcp(172.17.0.1:3306)/lugang_connect?charset=utf8&parseTime=True&loc=Local&sql_mode=''" \
  -e LUGANG_KNOWLEDGE_BASE_ENABLED=true \
  -e THEME=berry \
  -e MEMORY_CACHE_ENABLED=true \
  -e SQL_MAX_LIFETIME=3600 \
  -e LUGANG_DEMO_MODE=false \
  -e LANG=C.UTF-8 \
  -e SESSION_SECRET=lugang_enterprise_2024_secure_key_change_me \
  -e LC_ALL=C.UTF-8 \
  -e LOG_LEVEL=info \
  -e TZ=Asia/Shanghai \
  -e SQL_MAX_OPEN_CONNS=100 \
  -e LUGANG_ENTERPRISE_MODE=true \
  -e SYNC_FREQUENCY=300 \
  ghcr.io/taotie8304/lugang-enterprise:latest

# 检查日志
docker logs lugang-ai-app --tail 20
docker logs lugang-enterprise --tail 20
```

## 查看日志

```bash
# 前端日志
docker logs -f lugang-ai-app --tail 100

# 后端日志
docker logs -f lugang-enterprise --tail 100

# 所有容器状态
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

## 回滚

```bash
# 如果新版本有问题，用之前的备份镜像回滚
docker-compose up -d --force-recreate lugang-ai
# 或者指定旧镜像 tag
```

## 注意事项

- 没有测试环境，部署直接上生产
- docker-compose.yml 在 `/www/wwwroot/lugang-ai/` 目录下
- 前端环境变量在 `/www/wwwroot/lugang-ai/projects/app/.env.local`
- GitHub Actions 构建大约需要 5-10 分钟
