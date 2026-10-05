#!/bin/sh
# 鲁港通 - 确认插件容器内 sdk-factory / zod 解析链（正式冒烟前的最后一项侦查）
echo "== node_modules/@fastgpt-plugin =="
docker exec lugang-ai-plugin sh -c 'ls -la /app/apps/server/node_modules/@fastgpt-plugin/'
echo "== node_modules/@fastgpt-sdk =="
docker exec lugang-ai-plugin sh -c 'ls -la /app/apps/server/node_modules/@fastgpt-sdk/ 2>&1 | head -10'
echo "== /runtime/cache/fastgpt-plugin =="
docker exec lugang-ai-plugin sh -c 'ls -la /runtime/cache/fastgpt-plugin/ 2>&1 | head -15'
echo "== sdk-factory resolve test (from /app/apps/server) =="
docker exec -w /app/apps/server lugang-ai-plugin node -e 'import("@fastgpt-plugin/sdk-factory").then(m => console.log("resolve OK:", Object.keys(m).slice(0,6).join(","))).catch(e => console.log("resolve FAIL:", e.message))'
echo "== done =="
