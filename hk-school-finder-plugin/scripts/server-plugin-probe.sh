#!/bin/sh
# 鲁港通 - 探查 lugang-ai-plugin 容器运行时结构（定位 sdk-factory 与 node_modules）
echo "== WorkingDir =="
docker inspect lugang-ai-plugin --format '{{.Config.WorkingDir}}'
echo "== cwd =="
docker exec lugang-ai-plugin node -p 'process.cwd()' 2>&1 || true
echo "== root ls =="
docker exec lugang-ai-plugin ls / 2>&1 || true
echo "== find sdk-factory (maxdepth 5) =="
docker exec lugang-ai-plugin find / -maxdepth 5 -type d -name 'sdk-factory' 2>/dev/null || true
echo "== probe done =="
