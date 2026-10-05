#!/bin/sh
# 鲁港通 - 探查插件容器深层结构（pnpm 深层 node_modules / runtime / server 目录）
echo "== /app ls =="
docker exec lugang-ai-plugin ls /app 2>&1
echo "== /app/apps/server ls =="
docker exec lugang-ai-plugin ls /app/apps/server 2>&1 | head -30
echo "== /app/node_modules head =="
docker exec lugang-ai-plugin sh -c 'ls /app/node_modules 2>/dev/null | head -15'
echo "== @fastgpt-plugin (shallow) =="
docker exec lugang-ai-plugin sh -c 'ls /app/node_modules/@fastgpt-plugin 2>&1'
echo "== find in /app (maxdepth 8) =="
docker exec lugang-ai-plugin sh -c 'find /app -maxdepth 8 -name "sdk-factory" 2>/dev/null | head -10'
echo "== /runtime =="
docker exec lugang-ai-plugin ls /runtime 2>&1 | head
echo "== done =="
