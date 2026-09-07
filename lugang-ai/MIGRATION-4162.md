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
| 模型 API 密钥 | 保留 | `AES256_SECRET_KEY` **必须显式配为 `fastgptkey`**（生产 4.14.4 未设该变量、运行时回落代码默认值加密；详见 §0.5，`.env.local` 现值错误） |
| **系统工具（插件）** | **需重装** | plugin v0.3.4 共享库 → v1.1.1 独立库 `fastgpt-plugin`，旧工具定义不在新库 |
| **部分数据表字段** | **需跑脚本迁移** | 见第 5 节 |
| 系统配置（品牌/系统参数） | 保留 | `config/config.json` 已挂回 `/app/data/config.json`（鲁港通AI助手标题等） |
| Redis 缓存 | 重建（可接受） | 现网实际用的是**宝塔宿主 Redis**（`REDIS_URL=172.17.0.1:6379`，约 1798 keys）；Docker 内 `lugang-ai-redis` 为孤儿（无客户端连接、仅 12 残留 key）可删。升级后切到编排内部 Redis（不发布宿主端口），现有登录会话一次性失效（用户重登）属正常 |
| 部署编排文件 | 切换 | 现网为 `docker-compose.yml`+`override`（密钥内联）；新编排统一 `-f docker-compose.prod.yml` |
| root 登录密码 | **升级时主动轮换为新强密码**（见 §0.6） | 已重新移植 4.14.4 定制：`initRootUser` 在 root 已存在时**跳过密码重置**（官方 4.16.2 每次启动会把 root 密码强制改回 `DEFAULT_ROOT_PSW`，导致密码失效且改不掉）。`DEFAULT_ROOT_PSW` 仅在全新部署、root 不存在时生效 |

---

## 0.5 ⚠️ 密钥对齐（升级命门 · 2026-09-07 服务器实证核实）

> **本节是整个升级成败的关键，务必最先确认。** 2026-09-07 通过只读核实生产容器与 4.14.4 基准代码（`_diff_base/lugang-414-staging`），发现现有 `projects/app/.env.local` 的密钥值与生产实际加密所用值**不一致**；若直接沿用，所有大模型 API 密钥将解密失败、AI 全面瘫痪。

### 核实结论（指纹比对，未读取明文）

| 变量 | 生产实际来源 | 升级必须配置 | `.env.local` 现状 | 处置 |
|------|------------|------------|-----------------|------|
| `AES256_SECRET_KEY` | 容器未设 → 回落代码默认 `fastgptkey` | **`fastgptkey`** | 18 字符错误值 | 必须改 |
| `FILE_TOKEN_KEY` | 旧 `docker-compose.yml` 内联（22 字符） | **生产现网内联值**（服务器上 `grep FILE_TOKEN_KEY docker-compose.yml` 读取，勿写死入 git） | 14 字符错误值 | 必须改 |
| `INVOKE_TOKEN_SECRET` | 4.14.4 无此变量 | 新生成 ≥32 位强随机 | 缺失 | 必须补 |
| `REDIS_URL` | 旧连宝塔宿主 Redis | 内部 `redis://redis:6379` | 缺失 | 必须补 |
| `FE_DOMAIN` | 容器未设 | `https://www.airscend.com` | 已有 | 核对 |

### AES256 = `fastgptkey` 的证据链

1. `_diff_base/lugang-414-staging/packages/service/common/secret/constants.ts` 第 1 行：`export const AES256_SECRET_KEY = process.env.AES256_SECRET_KEY || 'fastgptkey';`（官方 4.14.4 同款）
2. 生产容器 `printenv AES256_SECRET_KEY` 为空、旧 `docker-compose.yml` 无该行 → 运行时回落默认值 `fastgptkey`
3. 4.14.4 与 4.16.2 加密实现逐字节相同（`scryptSync(KEY,'salt',32)` + `aes-256-gcm` + 密文 `iv:enc:tag`）→ 密钥一致即可无缝解密

### 落地方式（推荐 A）

- **A（密钥集中、不入 git）**：`.env.deploy` 增设上述 4 个密钥；`docker-compose.prod.yml` 前端 `environment` 显式引用（优先级高于 `env_file`）；`deploy-prod.sh` 导出。
- **B（最简、直接改服务器文件）**：把服务器 `projects/app/.env.local` 的 `AES256_SECRET_KEY` 改为 `fastgptkey`、`FILE_TOKEN_KEY` 改为生产旧 `docker-compose.yml` 的内联值（服务器上 grep 可得），并补 `INVOKE_TOKEN_SECRET`、`REDIS_URL` 两行。

> **安全垫**：升级不改动库中密文；若密钥配错，升级后首次 AI 对话即暴露，改对密钥重启即恢复，数据零损失、可无限回滚。

### 动手前预检（必跑，只打印长度+md5 指纹、不泄露明文）

在服务器部署目录执行，确认生产 AES256 回落默认值、据此定 `.env.deploy`：

```bash
cd /www/wwwroot/lugang-ai
P=$(docker exec lugang-ai-app printenv AES256_SECRET_KEY); L=$(grep -E '^AES256_SECRET_KEY=' projects/app/.env.local | cut -d= -f2-)
echo "PROD  len=${#P} md5=$(printf '%s' "$P" | md5sum | cut -d' ' -f1)"
echo "LOCAL len=${#L} md5=$(printf '%s' "$L" | md5sum | cut -d' ' -f1)"
# 期望 PROD len=0（空→回落默认 fastgptkey）→ .env.deploy 定 AES256_SECRET_KEY=fastgptkey
# FILE_TOKEN 同理比对，取生产旧 docker-compose.yml 内联值写入 .env.deploy
```

> 完整就绪核查（含 4.16.2 必需变量齐备性 + 迁移文件就位）用本地工具 `.qoder/pre-upgrade-verify.sh`，经 `.qoder/run_remote.ps1` 管道到服务器 `bash -s` 执行（脚本不落服务器）。

---

## 0.6 🔐 生产密码轮换（升级必做 · 消除历史泄露）

> **背景**：历史上生产密码（MongoDB root、PostgreSQL、MinIO、应用 root 登录）曾被硬编码进仓库文件并推送到 GitHub 私有库。现已全部清除明文（改为运行时从服务器配置读取），但旧密码仍留在 Git 提交历史里。**唯一能让历史泄露彻底失效的办法，是趁本次升级把密码全部换成新的强值。**

### 轮换清单（升级改配置时一并完成）

| 凭据 | 现网旧值状态 | 轮换要求 |
|------|------------|---------|
| MongoDB root 密码 | 曾泄露 | 换全新强随机值 |
| PostgreSQL 密码 | 曾泄露、且历史上与 Mongo **共用同一密码** | 换全新强随机值，**与 Mongo 不同** |
| MinIO root 密码 | 曾泄露 | 换全新强随机值 |
| 应用 root 登录密码 | 曾泄露 | 升级后在 Web「账号设置」改密（已移植「root 存在不重置」定制，改后不会被启动覆盖） |

### 铁律

- **四个密码互不相同**，各自独立强随机（≥16 位，含大小写/数字/符号），杜绝一泄俱泄。
- 新值**只写**服务器 `.env.deploy` / `projects/app/.env.local` / `docker-compose` 与本地运维手册 `.qoder/ops-deploy.md`（均 gitignore 或服务器本地），**绝不写进任何入 git 的文件**。
- 数据库/MinIO 密码轮换需同步更新对应容器的环境变量并重建容器；在停机窗口内按本 Runbook 第 3 节部署时一并执行。
- ⚠ **不可轮换**：`AES256_SECRET_KEY`（`fastgptkey`）与 `FILE_TOKEN_KEY` 是加密/签名历史数据的密钥，换了老数据全废（见 §0.5 踩坑）；本节轮换**仅限**数据库/对象存储/应用登录密码。

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

复核命令（真实 root 密码见服务器运维配置 `.qoder/ops-deploy.md` 或 `.env.local`，本文件入 git 严禁写明文；先 `export MONGO_PASSWORD='<真实值>'` 再执行）：

```bash
docker exec -it lugang-ai-mongo mongo -u root -p "$MONGO_PASSWORD" --authenticationDatabase admin --eval "rs.status().ok"
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

> **过渡安全（动手前必核，已并入 `.qoder/pre-upgrade-verify.sh` 第 7 节）**：
> - 新旧栈 6 个同名容器（mongo/pg/redis/minio/plugin/app）**原地重建、不并存**，不会内存翻倍；新栈**净增 2 容器** `lugang-ai-sandbox`（旧栈曾注释）+ `lugang-ai-mcp-server`（全新）。
> - **compose 项目名必须一致**：旧栈容器 `com.docker.compose.project` 标签应为 `lugang-ai`（目录名）；若不同，同名容器会跨项目冲突导致 `up` 报 `name already in use`——需先 `docker compose -f docker-compose.yml down` 停旧栈再部。
> - **内存余量**：`free -m` 确认 available 能吃下 2 新容器（现网清理后约 2.7G 空闲）；不足先加 swap 再升级。
> - **mcp-server 镜像来自阿里云 registry**（`registry.cn-hangzhou.aliyuncs.com/fastgpt/fastgpt-mcp_server:v4.14.23`，非 ghcr，GHCR_TOKEN 不覆盖），需服务器能出网拉取；它发布宿主端口 **3003**，需空闲。

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
