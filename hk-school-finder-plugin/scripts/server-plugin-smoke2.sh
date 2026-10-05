#!/bin/sh
# 鲁港通 - 新版 .pkg 上传后：解压 → 替换容器内测试产物 → 跑「仅 query」四场景冒烟
set -e
cd /tmp/hksf-update
rm -rf extract
mkdir -p extract
unzip -o -q hk-school-finder-plugin.pkg -d extract
echo "== 解压产物 =="
ls -la extract
docker exec lugang-ai-plugin mkdir -p /runtime/cache/fastgpt-plugin/hksf-test
docker cp extract/index.js lugang-ai-plugin:/runtime/cache/fastgpt-plugin/hksf-test/index.js
docker cp pkg-smoke2.mjs lugang-ai-plugin:/runtime/cache/fastgpt-plugin/hksf-test/pkg-smoke2.mjs
echo "== run smoke2（仅 query 四场景）=="
docker exec lugang-ai-plugin node /runtime/cache/fastgpt-plugin/hksf-test/pkg-smoke2.mjs
echo "SMOKE2_EXIT=$?"
