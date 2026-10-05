#!/bin/sh
# 鲁港通 - 探查 runtime-sdk 结构与运行时依赖解析（sdk-factory / zod / node_modules 链）
echo "== dist ls =="
docker exec lugang-ai-plugin ls /app/apps/server/dist 2>&1 | head -20
echo "== runtime-sdk ls =="
docker exec lugang-ai-plugin ls /app/apps/server/dist/runtime-sdk 2>&1
echo "== @fastgpt-plugin ls =="
docker exec lugang-ai-plugin ls /app/apps/server/dist/runtime-sdk/@fastgpt-plugin 2>&1
echo "== sdk-factory ls =="
docker exec lugang-ai-plugin ls /app/apps/server/dist/runtime-sdk/@fastgpt-plugin/sdk-factory 2>&1 | head
echo "== sdk-factory package.json (head) =="
docker exec lugang-ai-plugin sh -c 'head -30 /app/apps/server/dist/runtime-sdk/@fastgpt-plugin/sdk-factory/package.json' 2>&1
echo "== apps/server/node_modules head =="
docker exec lugang-ai-plugin sh -c 'ls /app/apps/server/node_modules 2>/dev/null | head -20'
echo "== find node_modules under runtime-sdk =="
docker exec lugang-ai-plugin sh -c 'find /app/apps/server/dist/runtime-sdk -maxdepth 3 -type d -name node_modules 2>/dev/null'
echo "== /runtime/cache =="
docker exec lugang-ai-plugin ls /runtime/cache 2>&1 | head -10
echo "== done =="
