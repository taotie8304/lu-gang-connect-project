# 鲁港通项目主文档

> 最后更新：2026-05-13

---

## 项目概述

| 服务 | 技术基础 | 端口 | 域名 |
|------|---------|------|------|
| 前端 lugang-ai | FastGPT 4.14.4 二开，Next.js 14 + TypeScript + Chakra UI | 3210 | www.airscend.com |
| 后端 lugang-connect-enterprise | One API v0.6.10，Go + Gin | 8080 | api.airscend.com |

包管理：`pnpm`（monorepo）

---

## 重要账号密码

| 服务 | 用户名 | 密码 | 加密方式 |
|------|--------|------|---------|
| 前端管理员 | `root` | `Huijin8304*` | 双重 SHA256 |
| 后端管理员 | `root` | `Huijin8304*` | bcrypt |
| SSH 服务器 | `root` | `Huijin8304*` | — |

**数据库连接**：
- MongoDB：`mongodb://root:password@172.17.0.1:27017/lugang_ai?authSource=admin`
- MySQL：`lugang_connect:huijin8304@tcp(172.17.0.1:3306)/lugang_connect?charset=utf8&parseTime=True&loc=Local`
- PostgreSQL：`host=172.17.0.1 port=5432 user=postgres password=password dbname=postgres`
- Redis：`172.17.0.1:6379`（无密码）

**GitHub**：https://github.com/taotie8304/lu-gang-connect-project
- 前端镜像：`ghcr.io/taotie8304/lugang-ai:latest`
- 后端镜像：`ghcr.io/taotie8304/lugang-enterprise:latest`

---

## 服务器信息

- IP：`156.225.30.134`（香港），SSH：`ssh root@156.225.30.134`
- 管理面板：宝塔面板
- 项目目录：`/www/wwwroot/lugang-ai`

---

## Docker 容器

| 容器名 | 端口 | 说明 |
|--------|------|------|
| lugang-ai-app | 3210:3000 | 前端，docker-compose 管理 |
| lugang-enterprise | 8080:8080 | 后端，⚠️ 单独 docker run |
| lugang-ai-mongo | 27017 | MongoDB |
| lugang-ai-pg | 5432 | PostgreSQL 向量库 |
| lugang-ai-redis | 6379 | Redis |
| lugang-ai-plugin | — | FastGPT 系统工具 |
| lugang-ai-minio | 9000 | 对象存储 |
| lugang-ai-sandbox | — | 代码沙箱 |

---

## 部署命令

**更新前端**：
```bash
docker pull ghcr.io/taotie8304/lugang-ai:latest
cd /www/wwwroot/lugang-ai && docker-compose up -d --force-recreate lugang-ai
docker logs lugang-ai-app --tail 30
```

**更新后端**（⚠️ 不能用 docker-compose）：
```bash
docker pull ghcr.io/taotie8304/lugang-enterprise:latest
docker stop lugang-enterprise && docker rm lugang-enterprise
docker run -d --name lugang-enterprise --restart always \
  --network lugang-connect-enterprise_default -p 8080:8080 \
  -e GIN_MODE=release -e PORT=8080 -e "TRUSTED_PROXIES=127.0.0.1,::1" \
  -e "SQL_DSN=lugang_connect:huijin8304@tcp(172.17.0.1:3306)/lugang_connect?charset=utf8&parseTime=True&loc=Local&sql_mode=''" \
  -e SQL_MAX_IDLE_CONNS=10 -e SQL_MAX_OPEN_CONNS=100 -e SQL_MAX_LIFETIME=3600 \
  -e SESSION_SECRET=lugang_enterprise_2024_secure_key_change_me \
  -e LUGANG_KNOWLEDGE_BASE_ENABLED=true -e LUGANG_DEMO_MODE=false -e LUGANG_ENTERPRISE_MODE=true \
  -e MEMORY_CACHE_ENABLED=true -e SYNC_FREQUENCY=300 -e THEME=berry \
  -e LOG_LEVEL=info -e TZ=Asia/Shanghai -e LANG=C.UTF-8 -e LC_ALL=C.UTF-8 \
  ghcr.io/taotie8304/lugang-enterprise:latest
docker logs lugang-enterprise --tail 30
```

**查看状态**：`docker ps --format "table {{.Names}}\t{{.Status}}"`

---

## 已完成功能

- [x] CJK 简繁搜索规范化（opencc-js）
- [x] 联网搜索引用修复（Citation Parser + StreamHandler）
- [x] ⏳ 联网搜索 internet 模型切回原生协议（验证中）
- [x] 使用条款 + 多语言（简/繁/英）
- [x] 后端 root 密码重置（bcrypt）
- [x] 用户设置面板多语言
- [x] 香港智能交通助手 hk-transport-plugin（2026-05-13，629.4KB）
- [x] 深度思考内容截断（500字预览 + 展开按钮）

---

## 重要决策

| 决策 | 结论 |
|------|------|
| 简繁转换 | opencc-js，由工作流变量 `__enableS2T__` 控制 |
| 联网搜索协议 | `-internet` 后缀必须走原生 DashScope，不走兼容模式 |
| 前端密码 | 双重 SHA256：`hashStr(hashStr(password))` |
| 后端密码 | bcrypt |
| 数据库名 | 前端连 `lugang_ai`（不是 `fastgpt`） |
| 多语言 key | 繁体：`{key}` / 简体：`{key}_zh-CN` / 英文：`{key}_en` |
| 交通插件 toolId | `hk_transport_assistant`（下划线） |
| 测试命令 | `pnpm vitest run --config vitest.simple.config.mts` |

---

## 关键文件路径

| 文件 | 路径 |
|------|------|
| 系统内容组件 | `lugang-ai/projects/app/src/components/SystemContentModal/index.tsx` |
| 用户设置面板 | `lugang-ai/projects/app/src/components/UserSettingsPanel/index.tsx` |
| 系统内容 API | `lugang-ai/projects/app/src/pages/api/system/content/[key].ts` |
| 密码加密 | `lugang-connect-enterprise/common/crypto.go` |
| 前端环境变量 | `/www/wwwroot/lugang-ai/projects/app/.env.local` |

---

## 常见排障

```bash
# 前端无法访问：清缓存或 Ctrl+Shift+R
# 前端容器问题
docker logs lugang-ai-app --tail 200 && netstat -tulpn | grep 3210
# 数据库连接失败
docker exec -it lugang-ai-mongo mongosh -u root -p password --authenticationDatabase admin
# 后端无法启动
docker logs lugang-enterprise --tail 100 && netstat -tulpn | grep 8080
# 多语言不生效
curl -H "Cookie: NEXT_LOCALE=zh-CN" https://www.airscend.com/api/system/content/terms_of_use
# MongoDB 备份
docker exec lugang-ai-mongo mongodump -u root -p password --authenticationDatabase admin -d lugang_ai -o /tmp/backup
docker cp lugang-ai-mongo:/tmp/backup ./mongodb_backup_$(date +%Y%m%d)
```

---

技术支持：service@airscend.com
