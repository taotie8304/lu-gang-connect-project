# 鲁港通 - OSG 生产镜像（多阶段构建：builder 装依赖 → 运行时只拷贝产物）
FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

# 鲁港通 - 非 root 运行
RUN useradd --system --create-home --uid 10001 osg
WORKDIR /app

COPY --from=builder /install /usr/local
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini ./
# 鲁港通 - 运维/探测工具（如 tools/probe_selectors.py）随镜像交付，排障时可直接 exec 调用
COPY tools/ ./tools/

USER osg
EXPOSE 8000

# 鲁港通 - 健康检查走 /health（DB+Redis 任一故障返回 503）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status==200 else 1)"

# 鲁港通 - 单 worker：OSG 采集调度器（scheduler.start_scheduler）在进程内启动，多 worker 会各起一套
# 调度器导致每个 cron 重复触发两遍；且 _sync_lock 是进程内 threading.Lock，跨 worker 失效使串行采集
# 变成并发抓取（2C4G 双倍占用、政府站双倍请求、偶发 failed）。OSG 仅低流量 admin API + 后台采集，
# 单 worker 足够，改 1 让调度器单例、串行锁真正生效。
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
