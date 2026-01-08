#!/bin/bash

# ========================================
# 鲁港通AI - 回滚脚本
# 用于恢复到之前的备份
# ========================================

set -e

if [ -z "$1" ]; then
    echo "用法: bash rollback.sh <备份目录>"
    echo "示例: bash rollback.sh ../backup-20250102_123456"
    exit 1
fi

BACKUP_DIR=$1

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ 错误: 备份目录不存在: $BACKUP_DIR"
    exit 1
fi

echo "=========================================="
echo "  鲁港通AI - 回滚部署"
echo "=========================================="
echo ""
echo "备份目录: $BACKUP_DIR"
echo ""
read -p "确认回滚？(y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "已取消"
    exit 0
fi

# 1. 停止服务
echo "步骤1: 停止服务..."
docker-compose down
echo "✓ 服务已停止"
echo ""

# 2. 恢复数据
if [ -d "$BACKUP_DIR/data" ]; then
    echo "步骤2: 恢复数据..."
    rm -rf data
    cp -r $BACKUP_DIR/data ./
    echo "✓ 数据已恢复"
else
    echo "步骤2: 跳过（无数据备份）"
fi
echo ""

# 3. 恢复环境变量
if [ -f "$BACKUP_DIR/.env.local" ]; then
    echo "步骤3: 恢复环境变量..."
    cp $BACKUP_DIR/.env.local projects/app/.env.local
    echo "✓ 环境变量已恢复"
else
    echo "步骤3: 跳过（无环境变量备份）"
fi
echo ""

# 4. 启动服务
echo "步骤4: 启动服务..."
docker-compose up -d
echo "✓ 服务已启动"
echo ""

# 5. 健康检查
echo "步骤5: 健康检查..."
sleep 10
for i in {1..30}; do
    if curl -s -f http://localhost:3210/api/health > /dev/null 2>&1; then
        echo "✓ 服务健康检查通过"
        break
    fi
    echo -n "."
    sleep 2
done

echo ""
echo ""
echo "=========================================="
echo "  🎉 回滚完成！"
echo "=========================================="
echo ""
echo "访问地址: http://156.225.30.134:3210"
echo ""
