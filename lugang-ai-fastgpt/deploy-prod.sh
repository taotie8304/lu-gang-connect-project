#!/bin/bash

# ===== 鲁港通AI生产环境部署脚本 =====
# 用于在堡塔服务器上拉取GitHub Container Registry镜像并部署

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
DEFAULT_REGISTRY="ghcr.io"
DEFAULT_IMAGE_TAG="latest"

echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     鲁港通AI 生产环境部署脚本 v1.0       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""

# 检查配置文件
if [ ! -f ".env.deploy" ]; then
    echo -e "${YELLOW}未找到 .env.deploy 配置文件，创建模板...${NC}"
    cat > .env.deploy << 'EOF'
# 鲁港通AI 部署配置
# 请修改以下配置后重新运行部署脚本

# GitHub 用户名（必填）
GITHUB_USERNAME=your-github-username

# 镜像标签（可选，默认 latest）
IMAGE_TAG=latest

# GitHub Container Registry Token（私有仓库需要）
# 生成方法: GitHub Settings -> Developer settings -> Personal access tokens
# 权限: read:packages
GHCR_TOKEN=

# 数据库密码（建议修改）
MONGO_PASSWORD=password
PG_PASSWORD=password
EOF
    echo -e "${YELLOW}请编辑 .env.deploy 文件后重新运行此脚本${NC}"
    echo -e "${BLUE}nano .env.deploy${NC}"
    exit 1
fi

# 加载配置
source .env.deploy

# 验证必填配置
if [ -z "$GITHUB_USERNAME" ] || [ "$GITHUB_USERNAME" = "your-github-username" ]; then
    echo -e "${RED}错误: 请在 .env.deploy 中设置 GITHUB_USERNAME${NC}"
    exit 1
fi

# 设置镜像名称
IMAGE_TAG=${IMAGE_TAG:-$DEFAULT_IMAGE_TAG}
LUGANG_AI_IMAGE="${DEFAULT_REGISTRY}/${GITHUB_USERNAME}/lugang-ai:${IMAGE_TAG}"

echo -e "${BLUE}配置信息:${NC}"
echo "  GitHub 用户名: $GITHUB_USERNAME"
echo "  镜像地址: $LUGANG_AI_IMAGE"
echo ""

# 步骤 1: 登录到 GitHub Container Registry
echo -e "${YELLOW}[1/5] 登录到 GitHub Container Registry${NC}"
if [ -n "$GHCR_TOKEN" ]; then
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
    echo -e "${GREEN}✓ 登录成功${NC}"
else
    echo -e "${YELLOW}提示: 未设置 GHCR_TOKEN，如果镜像是公开的可以继续${NC}"
fi

# 步骤 2: 拉取最新镜像
echo ""
echo -e "${YELLOW}[2/5] 拉取最新镜像${NC}"
docker pull $LUGANG_AI_IMAGE
echo -e "${GREEN}✓ 镜像拉取成功${NC}"

# 步骤 3: 停止旧容器
echo ""
echo -e "${YELLOW}[3/5] 停止旧容器${NC}"
export LUGANG_AI_IMAGE
export MONGO_PASSWORD
export PG_PASSWORD
docker-compose -f docker-compose.prod.yml stop lugang-ai 2>/dev/null || true
docker-compose -f docker-compose.prod.yml rm -f lugang-ai 2>/dev/null || true
echo -e "${GREEN}✓ 旧容器已停止${NC}"

# 步骤 4: 启动新容器
echo ""
echo -e "${YELLOW}[4/5] 启动服务${NC}"
docker-compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓ 服务已启动${NC}"

# 步骤 5: 检查服务状态
echo ""
echo -e "${YELLOW}[5/5] 检查服务状态${NC}"
sleep 5

# 显示容器状态
docker-compose -f docker-compose.prod.yml ps

# 等待服务启动
echo ""
echo -e "${YELLOW}等待服务启动...${NC}"
for i in {1..30}; do
    if curl -s -f http://localhost:3210/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 服务启动成功!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ 服务启动超时，请检查日志${NC}"
        docker logs lugang-ai-app --tail 50
        exit 1
    fi
    echo "  等待中... ($i/30)"
    sleep 2
done

# 显示最近日志
echo ""
echo -e "${BLUE}最近日志:${NC}"
docker logs lugang-ai-app --tail 10

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           部署完成!                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "访问地址: ${BLUE}http://YOUR_SERVER_IP:3210${NC}"
echo -e "查看日志: ${BLUE}docker logs -f lugang-ai-app${NC}"
