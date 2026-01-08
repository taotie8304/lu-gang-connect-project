#!/bin/bash

# 快速修复 docker-compose.yml 文件
# 移除 lugang-ai 服务对 minio 的依赖

echo "=========================================="
echo "修复 docker-compose.yml 配置"
echo "=========================================="

cd /www/wwwroot/lugang-ai-fastgpt

# 备份原文件
echo "1. 备份原配置文件..."
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)

# 使用 sed 修改文件
echo "2. 修改 docker-compose.yml..."

# 方法：直接替换整个 depends_on 部分
sed -i '/depends_on:/,/env_file:/{
  /depends_on:/c\    depends_on:\n      - mongo\n      - pg\n      - redis\n      # - minio  # 已禁用可选服务
  /- mongo/d
  /- pg/d
  /- redis/d
  /- minio/d
}' docker-compose.yml

echo "3. 验证修改..."
grep -A 5 "depends_on:" docker-compose.yml

echo ""
echo "=========================================="
echo "修复完成！"
echo "=========================================="
echo ""
echo "下一步操作："
echo "1. 停止所有容器: docker-compose down"
echo "2. 启动核心服务: docker-compose up -d"
echo "3. 查看容器状态: docker-compose ps"
echo "=========================================="
