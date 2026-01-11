#!/bin/bash

# ========================================
# 鲁港通AI - 低内存构建脚本
# 适用于内存有限的服务器（7.6G）
# ========================================

set -e

echo "=========================================="
echo "  鲁港通AI - 低内存构建"
echo "=========================================="
echo ""

# 1. 检查内存
echo "步骤1: 检查系统内存..."
free -h
echo ""

# 2. 创建临时交换空间（如果需要）
SWAP_SIZE="4G"
SWAP_FILE="/swapfile_lugang"

if [ ! -f "$SWAP_FILE" ]; then
    echo "步骤2: 创建临时交换空间（${SWAP_SIZE}）..."
    sudo dd if=/dev/zero of=$SWAP_FILE bs=1M count=4096 status=progress
    sudo chmod 600 $SWAP_FILE
    sudo mkswap $SWAP_FILE
    sudo swapon $SWAP_FILE
    echo "✓ 交换空间已创建"
else
    echo "步骤2: 交换空间已存在，跳过创建"
    sudo swapon $SWAP_FILE 2>/dev/null || echo "  交换空间已激活"
fi
echo ""

# 3. 停止其他服务释放内存
echo "步骤3: 停止现有Docker容器..."
docker-compose down 2>/dev/null || true
echo "✓ 容器已停止"
echo ""

# 4. 清理Docker缓存
echo "步骤4: 清理Docker缓存..."
docker system prune -f
echo "✓ 缓存已清理"
echo ""

# 5. 构建镜像（限制内存使用）
echo "步骤5: 开始构建Docker镜像..."
echo "  这需要20-30分钟，请耐心等待..."
echo "  内存限制: 3GB"
echo ""

docker build \
  --memory=3g \
  --memory-swap=7g \
  --build-arg NODE_OPTIONS="--max-old-space-size=2048" \
  --no-cache \
  -t lugang-ai:v1 \
  -f projects/app/Dockerfile \
  .

echo ""
echo "✓ 镜像构建完成"
echo ""

# 6. 清理交换空间
echo "步骤6: 清理临时交换空间..."
sudo swapoff $SWAP_FILE 2>/dev/null || true
sudo rm -f $SWAP_FILE
echo "✓ 交换空间已清理"
echo ""

# 7. 启动服务
echo "步骤7: 启动服务..."
docker-compose up -d
echo "✓ 服务已启动"
echo ""

# 8. 显示状态
echo "步骤8: 服务状态..."
docker-compose ps
echo ""

echo "=========================================="
echo "  🎉 构建完成！"
echo "=========================================="
echo ""
echo "访问地址: http://156.225.30.134:3210"
echo ""
echo "查看日志: docker-compose logs -f lugang-ai"
echo ""
echo "=========================================="
