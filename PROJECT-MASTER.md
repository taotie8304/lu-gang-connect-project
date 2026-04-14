# 鲁港通项目 - 主文档

> 本文档整合了所有重要的项目信息、配置、密码和部署指南。
> 最后更新：2026-04-14

---

## 📋 目录

1. [项目概述](#项目概述)
2. [重要账号密码](#重要账号密码)
3. [服务器信息](#服务器信息)
4. [数据库配置](#数据库配置)
5. [Docker 容器列表](#docker-容器列表)
6. [部署指南](#部署指南)
7. [已完成功能](#已完成功能)
8. [技术架构](#技术架构)
9. [重要决策记录](#重要决策记录)
10. [常见问题](#常见问题)

---

## 项目概述

**项目名称**：鲁港通跨境AI智能平台

**前端（lugang-ai）**：
- 基于 FastGPT 4.14.4 二次开发
- 技术栈：Next.js 14, React, TypeScript, Chakra UI
- 端口：3210
- 域名：https://www.airscend.com
- 包管理器：pnpm（monorepo 结构）

**后端（lugang-connect-enterprise）**：
- 基于 One API v0.6.10
- 技术栈：Go, Gin
- 端口：8080
- 域名：https://api.airscend.com

---

## 重要账号密码

### 前端管理员账号

**超级管理员**：
- 用户名：`root`
- 密码：`Huijin8304*`
- 邮箱：robert8304@gmail.com
- 权限：完全控制
- 密码加密方式：双重 SHA256 哈希

### 后端管理员账号

**后端 API 管理**：
- 用户名：`root`
- 密码：`Huijin8304*`
- 登录地址：https://api.airscend.com
- 密码加密方式：标准 bcrypt

### 数据库密码

**MongoDB（前端数据库）**：
- 主机：172.17.0.1:27017（Docker 内部）或 localhost:27017（宿主机）
- 数据库名：`lugang_ai`（注意：不是 `fastgpt`）
- 用户名：`root`
- 密码：`password`
- 连接字符串：`mongodb://root:password@172.17.0.1:27017/lugang_ai?authSource=admin`

**MySQL（后端数据库）**：
- 主机：172.17.0.1:3306
- 数据库名：`lugang_connect`
- 用户名：`lugang_connect`
- 密码：`huijin8304`
- 连接字符串：`lugang_connect:huijin8304@tcp(172.17.0.1:3306)/lugang_connect?charset=utf8&parseTime=True&loc=Local`

**PostgreSQL（向量数据库）**：
- 主机：172.17.0.1:5432
- 数据库名：`postgres`
- 用户名：`postgres`
- 密码：`password`

**Redis（缓存）**：
- 主机：172.17.0.1:6379
- 密码：无

### GitHub 配置

**仓库信息**：
- 仓库地址：https://github.com/taotie8304/lu-gang-connect-project
- 用户名：taotie8304
- 邮箱：robert8304@gmail.com
- GitHub Token：（存储在 GitHub Secrets 中）

**镜像仓库**：
- 前端镜像：`ghcr.io/taotie8304/lugang-ai:latest`
- 后端镜像：`ghcr.io/taotie8304/lugang-enterprise:latest`

---

## 服务器信息

**服务器基本信息**：
- IP 地址：`156.225.30.134`
- 位置：香港
- SSH 登录：`ssh root@156.225.30.134`
- SSH 密码：`Huijin8304*`
- 管理面板：宝塔面板（BT-Panel）

**项目目录**：
- 主目录：`/www/wwwroot/lugang-ai`
- 前端代码：`/www/wwwroot/lugang-ai/lugang-ai`
- 后端代码：`/www/wwwroot/lugang-ai/lugang-connect-enterprise`
- docker-compose 文件：`/www/wwwroot/lugang-ai/docker-compose.yml`

---

## 数据库配置

### 系统内容数据库结构

**system_contents 集合（MongoDB）**：
```javascript
{
  _id: ObjectId("..."),
  key: "terms_of_use",              // 唯一标识
  title: "鲁港通使用条款",           // 标题
  content: "# 鲁港通使用条款...",    // Markdown 内容
  createdAt: ISODate("..."),        // 创建时间
  updatedAt: ISODate("...")         // 更新时间
}
```

**多语言 key 命名规则**：
- 繁体中文（默认）：`terms_of_use`, `privacy_policy`, `data_collection`
- 简体中文：`terms_of_use_zh-CN`, `privacy_policy_zh-CN`, `data_collection_zh-CN`
- 英文：`terms_of_use_en`, `privacy_policy_en`, `data_collection_en`

---

## Docker 容器列表

| 容器名 | 镜像 | 端口 | 说明 |
|--------|------|------|------|
| lugang-ai-app | ghcr.io/taotie8304/lugang-ai:latest | 3210:3000 | 前端（FastGPT 二开） |
| lugang-enterprise | ghcr.io/taotie8304/lugang-enterprise:latest | 8080:8080 | 后端（One API 二开）⚠️ 不在 docker-compose 中 |
| lugang-ai-mongo | mongo:5.0.18 | 27017:27017 | MongoDB 数据库 |
| lugang-ai-pg | pgvector/pgvector:pg15 | 5432:5432 | PostgreSQL 向量数据库 |
| lugang-ai-redis | redis:7.2-alpine | 6379:6379 | Redis 缓存 |
| lugang-ai-minio | minio | 9000:9000 | 对象存储 |
| lugang-ai-sandbox | fastgpt-sandbox:v4.14.4 | - | 代码沙箱 |

**重要提示**：
- 前端容器在 docker-compose.yml 中，使用 `docker-compose` 命令管理
- 后端容器**不在** docker-compose.yml 中，必须用 `docker run` 单独部署
- 后端容器网络：`lugang-connect-enterprise_default`

---

## 部署指南

### 部署方式说明

服务器上**没有 git 仓库**，不需要 `git pull`。部署流程是：
1. 本地推送代码到 GitHub
2. GitHub Actions 自动构建 Docker 镜像并推送到 ghcr.io
3. 服务器上拉取新镜像并重启容器

### 只更新前端

```bash
# 拉取最新镜像
docker pull ghcr.io/taotie8304/lugang-ai:latest

# 进入项目目录
cd /www/wwwroot/lugang-ai

# 重启前端容器
docker-compose up -d --force-recreate lugang-ai

# 查看日志
docker logs lugang-ai-app --tail 30
```

### 只更新后端

**⚠️ 注意：后端不在 docker-compose.yml 中，不能用 docker-compose 命令！**

```bash
# 拉取最新镜像
docker pull ghcr.io/taotie8304/lugang-enterprise:latest

# 停止并删除旧容器
docker stop lugang-enterprise && docker rm lugang-enterprise

# 启动新容器
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

# 查看日志
docker logs lugang-enterprise --tail 30
```

### 前端+后端都更新

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

### 查看日志和状态

```bash
# 前端日志
docker logs -f lugang-ai-app --tail 100

# 后端日志
docker logs -f lugang-enterprise --tail 100

# 所有容器状态
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

---

## 已完成功能

- ✅ CJK 简繁搜索规范化 - 核心转换模块（opencc-js）
- ✅ CJK 简繁搜索规范化 - HTTP 工具集成（http468 + runHTTPTool + runTool）
- ✅ CJK 简繁搜索规范化 - 知识库搜索集成（controller.ts 查询扩展）
- ✅ 联网搜索引用修复 - 前端 Citation Parser 增强（extractBareNumberReferences + cleanOrphanCitations）
- ✅ 联网搜索引用修复 - 后端 search_info 透传（openai.StreamHandler 过滤逻辑修复）
- ⏳ 联网搜索引用修复 - 后端 internet 模型切回原生协议（验证中）
- ✅ 前端使用条款功能 - 数据库内容更新和组件修复（SystemContentModal）
- ✅ 后端 root 密码重置 - 使用标准 bcrypt 哈希
- ✅ 多语言系统内容支持 - 使用条款、隐私政策、个人资料收集声明（简体/繁体/英文）
- ✅ 自动繁简转换功能 - 使用 opencc-js 自动将繁体内容转换为简体
- ✅ 用户设置面板多语言支持 - 菜单项自动根据语言切换

---

## 技术架构

### 前端架构

**技术栈**：
- Next.js 14（React 框架）
- TypeScript（类型安全）
- Chakra UI（UI 组件库）
- MongoDB（主数据库）
- PostgreSQL + pgvector（向量数据库）
- Redis（缓存）
- pnpm workspace（monorepo 管理）

**测试框架**：
- vitest（单元测试）
- fast-check（属性测试，每个属性最少 100 次迭代）

**国际化**：
- next-i18next（i18n 框架）
- 支持语言：简体中文（zh-CN）、繁体中文（zh-Hant）、英文（en）
- 语言存储：Cookie (`NEXT_LOCALE`) + localStorage

### 后端架构

**技术栈**：
- Go 语言
- Gin（Web 框架）
- MySQL（主数据库）
- bcrypt（密码加密）

**AI 模型接入**：
- OpenAI 兼容接口
- 支持 DashScope 原生协议（联网搜索模型）
- 支持兼容模式（推理模型）

---

## 重要决策记录

### 简繁转换
- 使用 opencc-js（纯 JS，无原生依赖）
- 通过 `__enableS2T__` 工作流变量控制
- 知识库搜索简繁兼容通过 `feConfigs.enableCjkNormalization` 系统配置控制
- 转换准确率 >99%

### 联网搜索引用修复
- `-internet` 后缀模型必须走原生 DashScope 协议（不走兼容模式）
- 原因：兼容模式 SSE 流不返回 `search_info`
- 非联网的 Qwen3.5/QwQ/Qwen3 系列继续走兼容模式以支持 `reasoning_content`

### 数据库设计
- 前端连接的是 `lugang_ai` 数据库（不是 `fastgpt`）
- 环境变量 `MONGODB_URI` 中指定
- 多语言内容通过 key 后缀区分（`_zh-CN`, `_en`）

### 密码加密
- 前端：双重 SHA256 哈希（`hashStr(hashStr(password))`）
- 后端：标准 bcrypt（`bcrypt.GenerateFromPassword`）

### 多语言系统内容
- 数据库 key 命名规则：`{base_key}` (繁体)、`{base_key}_zh-CN` (简体)、`{base_key}_en` (英文)
- API 根据 Cookie (`NEXT_LOCALE`) 自动选择对应语言版本
- 简体版本可通过脚本自动从繁体转换生成

### 测试策略
- 属性测试使用 fast-check，每个属性最少 100 次迭代
- 运行测试使用 `pnpm vitest run --config vitest.simple.config.mts`
- fast-check v4 没有 `stringOf` 方法，用 `fc.array(...).map(chars => chars.join(''))` 替代

---

## 常见问题

### 1. 浏览器看不到最新更新？

**原因**：浏览器缓存了旧的 JavaScript 文件

**解决方案**：
- 清除浏览器缓存
- 使用无痕窗口测试
- 强制刷新：Ctrl+F5 或 Ctrl+Shift+R

### 2. 前端容器启动失败？

**检查步骤**：
```bash
# 查看详细日志
docker logs lugang-ai-app --tail 200

# 检查容器配置
docker inspect lugang-ai-app

# 检查端口占用
netstat -tulpn | grep 3210
```

### 3. 数据库连接失败？

**检查步骤**：
```bash
# 检查 MongoDB 容器状态
docker ps | grep mongo

# 测试数据库连接
docker exec -it lugang-ai-mongo mongosh -u root -p password --authenticationDatabase admin

# 检查网络连接
docker network inspect lugang-connect-enterprise_default
```

### 4. 后端容器无法启动？

**常见原因**：
- 端口 8080 被占用
- MySQL 数据库连接失败
- 环境变量配置错误

**解决方案**：
```bash
# 检查端口占用
netstat -tulpn | grep 8080

# 查看后端日志
docker logs lugang-enterprise --tail 100

# 测试 MySQL 连接
docker exec -it lugang-ai-mysql mysql -u lugang_connect -phuijin8304 lugang_connect
```

### 5. GitHub Actions 构建失败？

**检查步骤**：
1. 访问 GitHub 仓库的 Actions 页面
2. 查看失败的工作流日志
3. 检查 GitHub Secrets 是否配置正确
4. 确认 Dockerfile 语法正确

### 6. 多语言切换不生效？

**原因**：
- Cookie 未正确设置
- 翻译文件缺失
- API 未正确读取语言设置

**解决方案**：
```bash
# 测试 API 语言切换
curl -H "Cookie: NEXT_LOCALE=zh-CN" https://www.airscend.com/api/system/content/terms_of_use
curl -H "Cookie: NEXT_LOCALE=en" https://www.airscend.com/api/system/content/terms_of_use

# 检查翻译文件是否存在
ls lugang-ai/packages/web/i18n/zh-CN/
ls lugang-ai/packages/web/i18n/zh-Hant/
ls lugang-ai/packages/web/i18n/en/
```

### 7. 如何备份数据库？

**MongoDB 备份**：
```bash
docker exec lugang-ai-mongo mongodump -u root -p password --authenticationDatabase admin -d lugang_ai -o /tmp/backup
docker cp lugang-ai-mongo:/tmp/backup ./mongodb_backup_$(date +%Y%m%d)
```

**MySQL 备份**：
```bash
docker exec lugang-ai-mysql mysqldump -u lugang_connect -phuijin8304 lugang_connect > mysql_backup_$(date +%Y%m%d).sql
```

### 8. 如何回滚到旧版本？

**方法一：使用旧镜像 tag**：
```bash
docker pull ghcr.io/taotie8304/lugang-ai:旧版本tag
docker-compose up -d --force-recreate lugang-ai
```

**方法二：使用备份镜像**：
```bash
docker stop lugang-ai-app
docker rm lugang-ai-app
docker run -d --name lugang-ai-app [原来的参数] lugang-ai-app:backup-日期
```

---

## 重要文件路径

### 前端关键文件
- 系统内容组件：`lugang-ai/projects/app/src/components/SystemContentModal/index.tsx`
- 用户设置面板：`lugang-ai/projects/app/src/components/UserSettingsPanel/index.tsx`
- 系统内容常量：`lugang-ai/packages/global/support/systemContent/constant.ts`
- 系统内容 API：`lugang-ai/projects/app/src/pages/api/system/content/[key].ts`
- 翻译文件：`lugang-ai/packages/web/i18n/{语言}/`

### 后端关键文件
- 密码加密函数：`lugang-connect-enterprise/common/crypto.go`
- 主配置文件：`lugang-connect-enterprise/config/`

### 部署相关文件
- docker-compose：`/www/wwwroot/lugang-ai/docker-compose.yml`
- 前端环境变量：`/www/wwwroot/lugang-ai/projects/app/.env.local`
- 部署指南：`.kiro/steering/deploy-guide.md`

### 数据库脚本
- 添加使用条款：`add_english_terms.js`
- 添加隐私政策：`add_privacy_policy_*.js`
- 添加个人资料收集声明：`add_data_collection_*.js`
- 繁简转换：`convert_*_to_simplified.js`
- 批量更新：`update_all_system_contents.sh`

---

## 联系方式

**技术支持**：service@airscend.com

**GitHub 仓库**：https://github.com/taotie8304/lu-gang-connect-project

---

**文档维护**：请在每次重大更新后及时更新本文档
**最后更新**：2026-04-14
