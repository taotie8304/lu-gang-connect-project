# LuGang OSG - 官方来源网关（Official Source Gateway）

鲁港通的定向采集与实时核验服务：零商业搜索 API，只从白名单官方来源（香港/山东/济南政府及高校）采集数据。Phase 1 = 安全底座 + 数据库 + `/health` + `/v1/verify`；Phase 2 = 采集 Worker（发现/提取/版本化入库）+ 管理接口 + 定时调度。

对应需求书：`.qoder/specs/official-source-gateway/`（lugangtong_official_source_gateway_development_spec.md）。

## 目录结构

```
lugang-osg/
├── app/
│   ├── main.py              # FastAPI 入口（/health + 路由挂载）
│   ├── config.py            # pydantic-settings 配置（OSG_ 前缀环境变量）
│   ├── database.py          # SQLAlchemy 引擎/会话
│   ├── models.py            # 7 张表：source/source_domain_rule/document/
│   │                        #   document_version/crawl_run/crawl_task/audit_log
│   ├── rules.py             # 白名单规则加载器（60s TTL 缓存）
│   ├── scheduler.py         # APScheduler 定时调度（cron 周期同步）
│   ├── ingest/              # 采集层（Phase 2）
│   │   ├── yaml_import.py   #   sources.yaml → source + 域名规则（幂等）
│   │   ├── discover.py      #   RSS / sitemap(index) / listing / fixed_url 解析
│   │   ├── extract.py       #   HTML 标题/正文提取（去噪声标签 + 简繁判定）
│   │   └── pipeline.py      #   采集编排：发现→校验→去重→抓取→版本化入库
│   ├── api/
│   │   ├── deps.py          # 双 API Key 鉴权（fastgpt / admin 分离）
│   │   ├── rate_limit.py    # Redis 滑动窗口限流（故障降级放行）
│   │   └── verify.py        # POST /v1/verify 实时核验
│   │   └── admin.py         # POST /admin/sources/import、触发同步、run 查询
│   └── security/
│       ├── url_validator.py # 统一 URL 校验（白名单+SSRF+端口+userinfo）
│       └── fetcher.py       # 安全抓取（逐跳重定向校验+内容类型/大小限制）
├── migrations/              # Alembic（0001_initial = Phase 1 schema）
├── tests/                   # 36 个测试（spec 16.1 十项验收 + Phase 2 全流程）
├── Dockerfile               # 生产镜像（非 root + healthcheck）
└── docker-compose.yml       # 仅绑定 127.0.0.1:8600，复用宿主 PG/Redis
```

## 安全规则（默认拒绝）

所有抓取/核验 URL 必须通过 `validate_target_url`：

1. 协议：默认仅 https；`allow_http=True` 的来源放行 http（Phase 0 实测：山东政务云对境外数据中心仅 80 端口放行）
2. 域名+路径前缀必须命中 `source_domain_rule` 白名单（后缀伪造如 `gov.hk.evil.example` 不会命中）
3. URL 内嵌 userinfo 拒绝；显式端口必须在 `allowed_ports`
4. DNS 全量解析（A+AAAA），任一结果为私网/回环/链路本地/组播/保留/CGNAT/metadata IP 即拒绝
5. 重定向逐跳重新校验（跳白名单外或内网 IP 直接中止），最多 3 跳
6. 内容类型白名单（html/pdf/json/xml/csv/rss/atom）；HTML ≤10MB、PDF ≤30MB（流式截断，防谎报 content-length）
7. 401/403/429 上抛 FetchBlocked，调用方退避 ≥24h，绝不重试轰炸

## 采集流程（Phase 2）

每个来源按 `discovery_method` 发现新 URL → 白名单校验 → 已入库跳过 → 安全抓取 →
内容提取 → **SHA-256 版本化入库**（正文不变不建新版本；变更新建 version 并更新
latest_version_id）→ crawl_run/crawl_task 全程记录。

- 发现方式：RSS（news.gov.hk/data.gov.hk）、sitemap（含 sitemapindex 递归，限深 2）、
  listing（HTML 链接提取，GBK/UTF-8/BIG5 自动解码）、fixed_url、api（data.gov.hk 更新 RSS）
- 抓取节奏：同源两次请求 ≥ 10s；单轮上限 max_pages_per_run
- 网络异常退避重试 2 次（5s/15s）；403/429 绝不重试
- 管理接口（admin 密钥）：`POST /admin/sources/import`（上传 sources.yaml）、
  `POST /admin/sources/{code}/sync?force=`（触发同步）、`GET /admin/runs`（同步记录）、
  `POST /admin/rules/reload`（刷新白名单缓存）
- 调度：APScheduler 按 source.schedule_cron 自动同步（与手动触发互斥，串行防打满 2C4G）

## 本地开发

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt -r requirements-dev.txt
.\.venv\Scripts\python -m pytest tests\
```

## 服务器部署（156.225.30.134）

```bash
# 1. 建库（一次性，进 PG 容器执行）
docker exec -it <pg容器> psql -U postgres -c "CREATE DATABASE lugang_osg OWNER postgres;"

# 2. 生成两把密钥并写入 .env（参考 .env.example；OSG_DATABASE_URL 用 172.17.0.1）
openssl rand -hex 32

# 3. 迁移
docker run --rm -v $(pwd):/app -w /app --env-file .env python:3.12-slim \
  sh -c "pip install -q alembic psycopg2-binary sqlalchemy && alembic upgrade head"

# 4. 启动（仅绑定 127.0.0.1:8600）
docker compose up -d --build

# 5. 导入来源白名单（首次部署后一次性；后续改 sources.yaml 重复上传即幂等更新）
curl -X POST http://127.0.0.1:8600/admin/sources/import \
  -H "X-API-Key: <OSG_API_KEY_ADMIN>" -F "file=@sources.yaml"

# 6. 触发首个来源同步验证（如香港政府新闻网）
curl -X POST http://127.0.0.1:8600/admin/sources/hk_news_gov/sync \
  -H "X-API-Key: <OSG_API_KEY_ADMIN>"
curl "http://127.0.0.1:8600/admin/runs" -H "X-API-Key: <OSG_API_KEY_ADMIN>"

# 7. 验证
curl http://127.0.0.1:8600/health
curl -X POST http://127.0.0.1:8600/v1/verify \
  -H "X-API-Key: <OSG_API_KEY_FASTGPT>" -H "Content-Type: application/json" \
  -d '{"url": "https://www.news.gov.hk/"}'
```

公网访问必须经 Nginx 反代（`/osg/` 路径 + HTTPS），服务本身不直接暴露。

## Phase 2 之后

- Phase 3：FastGPT 数据集联动（RAG 知识库推送）
- data.gov.hk 数据集采集（用户重点要求）：更新 RSS 通道已在 Phase 2 生效；
  全量 35,599 数据集枚举（list-files API）在 RAG 阶段按 18 主题分类筛选入库
- 管理后台 UI（来源启停/白名单编辑/人工审核队列）
