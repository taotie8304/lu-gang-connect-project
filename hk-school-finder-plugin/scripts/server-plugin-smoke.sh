#!/bin/sh
# 鲁港通 - 模拟插件平台运行环境执行 .pkg 产物冒烟（放到与已装插件同级的解析链下）
docker exec lugang-ai-plugin sh -c 'mkdir -p /runtime/cache/fastgpt-plugin/hksf-test && cp /tmp/hksf-test/index.js /tmp/hksf-test/pkg-smoke.mjs /runtime/cache/fastgpt-plugin/hksf-test/ && ls -la /runtime/cache/fastgpt-plugin/hksf-test/'
echo "== run smoke =="
docker exec lugang-ai-plugin node /runtime/cache/fastgpt-plugin/hksf-test/pkg-smoke.mjs
echo "SMOKE_EXIT=$?"
