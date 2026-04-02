#!/bin/bash

echo "=== 检查使用条款内容 ==="
docker exec lugang-ai-mongo mongosh -u root -p LuGang2024Secure --authenticationDatabase admin fastgpt --quiet --eval 'var doc = db.system_contents.findOne({key: "terms_of_use"}); print("内容长度:", doc.content.length); print("标题:", doc.title);'

echo ""
echo "=== 检查后端数据库位置 ==="
docker exec lugang-enterprise ls -la /data/ 2>/dev/null || echo "没有 /data 目录"
docker exec lugang-enterprise ls -la /root/data/ 2>/dev/null || echo "没有 /root/data 目录"
docker exec lugang-enterprise env | grep -i sql

echo ""
echo "=== 检查后端环境变量 ==="
docker exec lugang-enterprise env | grep -E "(SQL_DSN|DATABASE)"
