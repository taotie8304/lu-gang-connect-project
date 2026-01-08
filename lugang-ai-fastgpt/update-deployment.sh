#!/bin/bash

# ========================================
# 鲁港通AI - 智能更新部署脚本
# 适用于已有部署的更新场景
# ========================================

set -e

echo "=========================================="
echo "  鲁港通AI - 智能更新部署"
echo "=========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 错误: 请在 lugang-ai-fastgpt 目录下运行此脚本"
    exit 1
fi

# 1. 备份当前部署
echo "步骤1: 备份当前部署..."
BACKUP_DIR="../backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# 备份数据
if [ -d "data" ]; then
    echo "  备份数据库数据..."
    cp -r data $BACKUP_DIR/
fi

# 备份环境变量
if [ -f "projects/app/.env.local" ]; then
    echo "  备份环境变量..."
    cp projects/app/.env.local $BACKUP_DIR/.env.local
fi

echo "✓ 备份完成: $BACKUP_DIR"
echo ""

# 2. 停止服务
echo "步骤2: 停止当前服务..."
docker-compose down
echo "✓ 服务已停止"
echo ""

# 3. 检查是否是Git仓库
if [ -d ".git" ]; then
    echo "步骤3: 更新代码（Git拉取）..."
    
    # 保存本地修改
    git stash
    
    # 拉取最新代码
    git pull origin main
    
    # 恢复本地修改
    git stash pop || true
    
    echo "✓ 代码已更新"
else
    echo "步骤3: 跳过（不是Git仓库）"
fi
echo ""

# 4. 恢复环境变量
echo "步骤4: 恢复环境变量..."
if [ -f "$BACKUP_DIR/.env.local" ]; then
    cp $BACKUP_DIR/.env.local projects/app/.env.local
    echo "✓ 环境变量已恢复"
else
    echo "⚠️  警告: 未找到备份的环境变量"
    echo "请手动配置 projects/app/.env.local"
    read -p "按Enter继续..."
fi
echo ""

# 5. 检查环境变量
echo "步骤5: 检查环境变量..."
if [ ! -f "projects/app/.env.local" ]; then
    echo "❌ 错误: 环境变量文件不存在"
    echo "请先配置 projects/app/.env.local"
    exit 1
fi

# 检查关键配置
if grep -q "sk-your-oneapi-token" projects/app/.env.local; then
    echo "⚠️  警告: One API Token未配置"
    read -p "是否继续？(y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 1
    fi
fi

echo "✓ 环境变量检查完成"
echo ""

# 6. 重新构建镜像
echo "步骤6: 重新构建Docker镜像..."
read -p "是否重新构建镜像？(y/n，默认y): " REBUILD
REBUILD=${REBUILD:-y}

if [ "$REBUILD" = "y" ]; then
    echo "  开始构建（需要15-30分钟）..."
    docker build --no-cache -t lugang-ai:v1 -f projects/app/Dockerfile .
    echo "✓ 镜像构建完成"
else
    echo "  跳过镜像构建"
fi
echo ""

# 7. 启动服务
echo "步骤7: 启动服务..."
docker-compose up -d
echo "✓ 服务已启动"
echo ""

# 8. 等待服务就绪
echo "步骤8: 等待服务就绪..."
sleep 15

# 9. 健康检查
echo "步骤9: 健康检查..."
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

# 10. 显示服务状态
echo "步骤10: 服务状态..."
docker-compose ps

echo ""
echo "=========================================="
echo "  🎉 更新部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://156.225.30.134:3210"
echo "备份位置: $BACKUP_DIR"
echo ""
echo "常用命令:"
echo "  查看日志: docker-compose logs -f lugang-ai"
echo "  重启服务: docker-compose restart"
echo "  回滚部署: bash rollback.sh $BACKUP_DIR"
echo ""
echo "=========================================="
