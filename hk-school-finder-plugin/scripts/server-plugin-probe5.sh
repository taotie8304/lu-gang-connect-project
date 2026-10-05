#!/bin/sh
# 鲁港通 - 确认插件运行缓存目录结构（/runtime/cache/fastgpt-plugin 的 node_modules 与已装插件布局）
echo "== plugin dir =="
docker exec lugang-ai-plugin ls -la /runtime/cache/fastgpt-plugin/plugin/ 2>&1
echo "== cache node_modules =="
docker exec lugang-ai-plugin sh -c 'ls /runtime/cache/fastgpt-plugin/node_modules/ 2>&1 | head -20'
echo "== cache node_modules/@fastgpt-plugin =="
docker exec lugang-ai-plugin sh -c 'ls /runtime/cache/fastgpt-plugin/node_modules/@fastgpt-plugin/ 2>&1'
echo "== first plugin subdir =="
docker exec lugang-ai-plugin sh -c 'P=$(ls /runtime/cache/fastgpt-plugin/plugin/ | head -1); echo "plugin: $P"; ls -la /runtime/cache/fastgpt-plugin/plugin/$P/ 2>&1 | head -15'
echo "== done =="
