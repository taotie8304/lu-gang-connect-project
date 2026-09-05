# 鲁港通 FastGPT 4.14.4 → 4.16.2 数据迁移 Runbook

> 本文档用于**生产上线时保留现有工作流与知识库数据**。数据文件层面可平滑沿用（卷路径、镜像大版本、密钥均已对齐），
> 但 FastGPT 跨版本升级官方明确要求「修改镜像 + 手动执行升级脚本」两步，**迁移脚本不会自动运行**。
> 严格按本 Runbook 顺序执行，不会造成旧数据丢失（官方原话）。

占位符：`{{host}}` = `https://www.airscend.com`（服务器本机可用 `http://localhost:3210` 直连）；`{{rootkey}}` = `.env.local` 里的 `ROOT_KEY` 值（**不要把真实值写进任何提交文件**）。

---

## 0. 关键前提（先读）

| 项 | 结论 | 原因 |
|----|------|------|
| 工作流 / 知识库元数据 | 保留 | MongoDB `lugang_ai`，卷 `./data/mongo` 不变 |
| 知识库向量 | 保留 | PG `VECTOR(1536)` 全精度，`VECTOR_VQ_LEVEL=32` 与旧表一致 |
| 知识库源文件 | 保留 | MinIO 卷 `./data/minio` + bucket 名不变 |
| 模型 API 密钥 | 保留 | `AES256_SECRET_KEY` 不变（换了全部无法解密） |
| **系统工具（插件）** | **需重装** | plugin v0.3.4 共享库 → v1.1.1 独立库 `fastgpt-plugin`，旧工具定义不在新库 |
| **部分数据表字段** | **需跑脚本迁移** | 见第 5 节 |
| 系统配置（品牌/系统参数） | 保留 | `config/config.json` 已挂回 `/app/data/config.json`（鲁港通AI助手标题等） |
| Redis 缓存 | 重建（可接受） | 现网实际用的是**宝塔宿主 Redis**（`REDIS_URL=172.17.0.1:6379`，约 1798 keys）；Docker 内 `lugang-ai-redis` 为孤儿（无客户端连接、仅 12 残留 key）可删。升级后切到编排内部 Redis（不发布宿主端口），现有登录会话一次性失效（用户重登）属正常 |
| 部署编排文件 | 切换 | 现网为 `docker-compose.yml`+`override`（密钥内联）；新编排统一 `-f docker-compose.prod.yml` |
| root 登录密码 | 变为 `DEFAULT_ROOT_PSW` | 旧 compose 曾覆盖为 lugang123456；新编排不覆盖，升级后 root 密码为 .env.local 的 `LuGang@2025` |

---

## 1. 上线前：备份（必须，不可跳过）

在服务器 `lugang-ai` 部署目录执行（容器仍在运行时先停前端，保证数据一致）：

```bash
# 停止应用容器（数据库容器可保持运行做热备，或一并停止做冷备）
docker compose -f docker-compose.prod.yml stop lugang-ai

# 冷备：直接打包数据目录（最稳妥，宝塔可另存异地）
tar -czf backup-mongo-$(date +%F).tar.gz  ./data/mongo
tar -czf backup-pg-$(date +%F).tar.gz     ./data/pg
tar -czf backup-minio-$(date +%F).tar.gz  ./data/minio

# 配置备份
cp projects/app/.env.local  backup-env-local-$(date +%F)
cp .env.deploy              backup-env-deploy-$(date +%F) 2>/dev/null || true
```

> 服务器已存在旧备份 `./data/mongo_backup_20260319`、`./data/pg_backup_20260319`，可作参照，但**上线前仍必须做新备份**（数据已变化）。当前数据量约：mongo 2.0G / pg 1.6G / minio 401M，需预留打包耗时与磁盘。
> 也可用 `mongodump` / `pg_dump` 做逻辑备份，二选一或都做。备份未确认成功前，**不要**进入第 3 节。

---

## 2. 上线前：核查 MongoDB 副本集现状（必须）

4.16.2 起知识库写入强制事务，MongoDB 必须是副本集。新 `docker-compose.prod.yml` 的 entrypoint 会自动 `rs.initiate`（幂等、不丢数据）。

**2026-09-05 服务器扫描已确认：现网已是单节点副本集 `_id=rs0`，成员 host 为 `lugang-ai-mongo:27017`（=容器名），keyFile 鉴权。** 新编排 replSet 名同为 `rs0`、container_name 同为 `lugang-ai-mongo`，且 entrypoint 带 `rs.status().ok===1` 幂等判断（已初始化则跳过 initiate），**不会**破坏现有副本集配置。

复核命令（真实 root 密码为 `LuGang2024Secure`；运维手册所记 `password` 已过期）：

```bash
docker exec -it lugang-ai-mongo mongo -u root -p 'LuGang2024Secure' --authenticationDatabase admin --eval "rs.status().ok"
```

- 返回 `1` → 已是副本集（预期路径）。新编排 `MONGODB_URI` 带 `directConnection=true`，不依赖成员 host 发现，服务名/容器名均可连。
- 返回错误或 `no replset config` → 单机模式：新编排 entrypoint 首次启动自动转 `rs0`，数据保留。

---

## 3. 部署新编排

```bash
# 拉取新镜像并滚动更新（deploy-prod.sh 会 source .env.deploy 导出强随机令牌）
bash deploy-prod.sh
# 或手动：
# docker compose -f docker-compose.prod.yml pull
# docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

> 现网当前由 `docker-compose.yml` + `docker-compose.override.yml` 运行（密钥内联在 environment）。新编排统一改用 `docker-compose.prod.yml`（密钥改由 `.env.local` + `.env.deploy` 提供）；`up -d` 会以新编排重建同名容器（container_name 不变），旧 yml/override 不再使用。

等待全部容器 healthy：`docker compose -f docker-compose.prod.yml ps`。前端健康检查：`curl -f http://localhost:3210/api/health`。

---

## 4. 部署后：重装系统工具（必须）

plugin 换到独立库后，旧系统工具需重装，否则调用它们的工作流会报「工具不存在」：

1. 下载官方系统工具 zip 包：<https://github.com/labring/fastgpt-img/raw/refs/heads/main/fastgpt-official-plugins(1).zip>
2. 打开 `{{host}}` → `管理员` → `添加插件` → `导入/更新插件` → 上传 zip → 确认。
3. 或在插件市场逐个安装：<https://v2.marketplace.fastgpt.cn>
4. 鲁港通自研插件（如 `hk_transport_assistant`）需重新上传对应 `.pkg`/zip 包。

> 工作流本身（apps）在主库不会丢；此步只恢复工作流**引用的工具定义**。

---

## 5. 部署后：逐个执行迁移脚本（必须，按序）

从 4.14.4 直升 4.16.2，按版本顺序执行以下接口。`initv*` 系列**无 dry-run、直接写入**，务必在第 1 节备份完成后再跑；`dataClean`/`4160`/`4161` **先 dry-run 看统计再正式执行**。

```bash
# —— 5.0（可选核查）4.14.4 GridFS→S3 知识库源文件迁移，幂等；若 4.14.4 时期已跑过可跳过 ——
curl -X POST '{{host}}/api/admin/initv4144' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{}'

# —— 5.1 (4.14.5) OutLink 字段重命名 showNodeStatus→showRunningStatus 等 ——
curl -X POST '{{host}}/api/admin/initv4145' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{}'

# —— 5.2 (4.14.5.1) 系统工具子工具 InputListVal 回填 ——
curl -X POST '{{host}}/api/admin/initv41451' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{}'

# —— 5.3 (4.14.7) 聊天记录错误计数初始化 ——
curl -X POST '{{host}}/api/admin/initv4147' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{}'

# —— 5.4 (4.15.1) 历史 API Key 回填 appName 快照 ——
curl -X POST '{{host}}/api/admin/initv4151' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{}'

# —— 5.5 (4.15.0) 清理重复 appId+chatId（唯一索引同步前，先 dry-run）——
curl -X POST '{{host}}/api/admin/dataClean/cleanupDuplicateChats' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{"dryRun":true,"sampleLimit":20}'
# 确认 duplicateDocumentCount 与 samples 无误后正式执行：
curl -X POST '{{host}}/api/admin/dataClean/cleanupDuplicateChats' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{"dryRun":false,"sampleLimit":20}'

# —— 5.6 (4.16.0) 工作流 HTTP 节点数组→标准 JSON Schema（先 dry-run）——
curl -X POST '{{host}}/api/admin/4160/initHttpToolSchema' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{"dryRun":true,"batchSize":500}'
curl -X POST '{{host}}/api/admin/4160/initHttpToolSchema' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{"dryRun":false,"batchSize":500}'

# —— 5.7 (4.16.1) 工具 JSON Schema 存储迁移（先 dry-run）——
curl -X POST '{{host}}/api/admin/4161/initToolJsonSchemaStorage' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{"dryRun":true,"batchSize":500}'
curl -X POST '{{host}}/api/admin/4161/initToolJsonSchemaStorage' -H 'Content-Type: application/json' -H 'rootkey: {{rootkey}}' -d '{"dryRun":false,"batchSize":500}'
```

**跳过（不适用鲁港通）**：
- `4160/initUserSandbox`：未部署智能体沙箱
- `4162/initPermission`：商业版专用，鲁港通为开源版
- `4162/milvus`：向量库用 PG，非 Milvus
- `initWorkflowData` / `v1WorkflowToV2`：4.16.2 已移除，工作流旧数据改为读取时自动兼容

---

## 6. 验证清单

- [ ] 前端可登录，首页默认助手（`DEFAULT_APP_ID`）正常打开
- [ ] 随机抽 2~3 个**工作流**：编辑页节点/连线完整，试运行通过（尤其含 HTTP 节点、工具节点、代码运行节点的）
- [ ] 随机抽 2~3 个**知识库**：源文件可预览/下载，检索测试能召回分块
- [ ] `管理员 → 模型配置`：工作流引用的模型名均存在（N3 直连百炼后需核对模型清单，缺失的重新配置）
- [ ] 系统工具列表齐全，调用系统工具的工作流不再报「工具不存在」
- [ ] MongoDB `rs.status().ok === 1`

---

## 7. 回滚

迁移中出现不可恢复问题时：

```bash
bash rollback.sh   # 回退到 deploy-prod.sh 记录的上一版本镜像
# 数据回退：停容器后用第 1 节备份覆盖 ./data/mongo、./data/pg、./data/minio，再启动旧版本
```

> 逻辑备份（mongodump/pg_dump）可只回退单个集合/表；冷备 tar 包用于整目录还原。
