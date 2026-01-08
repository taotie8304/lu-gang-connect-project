#!/bin/bash

# 鲁港通AI - FastGPT定制版构建脚本
# 使用方法: ./build.sh

set -e

echo "========================================="
echo "  鲁港通AI - FastGPT定制版构建工具"
echo "========================================="
echo ""

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker未安装，请先安装Docker"
    exit 1
fi

echo "✅ Docker已安装"
echo ""

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 错误: Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

echo "✅ Docker Compose已安装"
echo ""

# 构建镜像
echo "📦 开始构建鲁港通AI镜像..."
echo ""

cd projects/app

docker build \
  --build-arg proxy=taobao \
  -t lugang-ai:v1 \
  -f Dockerfile \
  ../..

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "  ✅ 镜像构建成功！"
    echo "========================================="
    echo ""
    echo "镜像名称: lugang-ai:v1"
    echo "镜像大小: $(docker images lugang-ai:v1 --format '{{.Size}}')"
    echo ""
    echo "下一步操作："
    echo "1. 修改 .env.local 配置文件（特别是One API地址和Token）"
    echo "2. 运行 docker-compose up -d 启动服务"
    echo "3. 访问 http://156.225.30.134:3210"
    echo "4. 使用 root 账户登录（密码：LuGang@2025）"
    echo ""
else
    echo ""
    echo "========================================="
    echo "  ❌ 镜像构建失败"
    echo "========================================="
    echo ""
    echo "请检查错误信息并重试"
    exit 1
fi
