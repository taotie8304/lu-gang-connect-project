#!/bin/bash

# ===== 鲁港通 - 拉取新镜像脚本 =====
# 安全地拉取和部署新镜像
# 
# 使用方法: 
#   chmod +x 06-pull-new-image.sh
#   ./06-pull-new-image.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
GITHUB_USERNAME="taotie8304"
REGISTRY="ghcr.io"
IMAGE_NAME="lugang-ai"
NEW_IMAGE="${REGISTRY}/${GITHUB_USERNAME}/${IMAGE_NAME}:latest"
PROJECT_DIR="/www/wwwroot/lugang-ai"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      鲁港通 - 拉取新镜像脚本 v1.0                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}新镜像: ${NEW_IMAGE}${NC}"
echo ""

# 确认备份
echo -e "${RED}⚠️  重要确认${NC}"
read -p "是否已完成最终备份 (05-final-backup.sh)? (输入 'yes' 继续): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    echo -e "${RED}请先完成备份！${NC}"
    exit 1
fi

# 保存当前镜像信息
echo -e "${YELLOW}[1/6] 保存当前镜像信息...${NC}"
CURRENT_IMAGE=$(docker inspect lugang-ai-app --format='{{.Config.Image}}' 2>/dev/null || echo "unknown")
CURRENT_IMAGE_ID=$(docker inspect lugang-ai-app --format='{{.Image}}' 2>/dev/null || echo "unknown")
echo "当前镜像: ${CURRENT_IMAGE}"
echo "当前镜像ID: ${CURRENT_IMAGE_ID}"

# 保存到文件
echo "${CURRENT_IMAGE}" > /tmp/lugang-rollback-image.txt
echo "${CURRENT_IMAGE_ID}" >> /tmp/lugang-rollback-image.txt
echo -e "${GREEN}✓ 回滚信息已保存到 /tmp/lugang-rollback-image.txt${NC}"
echo ""

# 登录 GitHub Container Registry
echo -e "${YELLOW}[2/6] 登录 GitHub Container Registry...${NC}"
echo ""
echo "请输入 GitHub Personal Access Token (需要 read:packages 权限)"
echo "生成方法: GitHub Settings -> Developer settings -> Personal access tokens"
echo ""
read -sp "GHCR Token: " GHCR_TOKEN
echo ""

if [ -n "$GHCR_TOKEN" ]; then
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
    echo -e "${GREEN}✓ 登录成功${NC}"
else
    echo -e "${YELLOW}未输入 Token，尝试匿名拉取（仅公开镜像）${NC}"
fi
echo ""

# 拉取新镜像
echo -e "${YELLOW}[3/6] 拉取新镜像...${NC}"
echo "拉取: ${NEW_IMAGE}"
docker pull "${NEW_IMAGE}"
echo -e "${GREEN}✓ 新镜像拉取成功${NC}"
echo ""

# 显示镜像信息
echo -e "${YELLOW}[4/6] 镜像信息...${NC}"
docker images "${NEW_IMAGE}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"
echo ""

# 确认部署
echo -e "${RED}⚠️  即将部署新镜像${NC}"
echo ""
echo "当前镜像: ${CURRENT_IMAGE}"
echo "新镜像:   ${NEW_IMAGE}"
echo ""
read -p "是否继续部署? (输入 'deploy' 确认): " DEPLOY_CONFIRM
if [[ "$DEPLOY_CONFIRM" != "deploy" ]]; then
    echo -e "${YELLOW}取消部署${NC}"
    echo ""
    echo "新镜像已拉取，可以稍后手动部署:"
    echo "  docker stop lugang-ai-app"
    echo "  docker rm lugang-ai-app"
    echo "  docker run -d --name lugang-ai-app ... ${NEW_IMAGE}"
    exit 0
fi

# 停止旧容器
echo ""
echo -e "${YELLOW}[5/6] 停止旧容器...${NC}"
docker stop lugang-ai-app
docker rm lugang-ai-app
echo -e "${GREEN}✓ 旧容器已停止${NC}"
echo ""

# 启动新容器
echo -e "${YELLOW}[6/6] 启动新容器...${NC}"

# 检查是否使用 docker-compose
if [ -f "${PROJECT_DIR}/docker-compose.yml" ]; then
    echo "使用 docker-compose 启动..."
    cd "${PROJECT_DIR}"
    export LUGANG_AI_IMAGE="${NEW_IMAGE}"
    docker-compose up -d lugang-ai
else
    echo "使用 docker run 启动..."
    docker run -d \
        --name lugang-ai-app \
        --restart always \
        -p 3210:3000 \
        --env-file "${PROJECT_DIR}/projects/app/.env.local" \
        --network lugang-ai-network \
        "${NEW_IMAGE}"
fi

echo -e "${GREEN}✓ 新容器已启动${NC}"
echo ""

# 等待启动
echo "等待服务启动..."
for i in {1..30}; do
    if curl -s -f http://localhost:3210/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 服务启动成功!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ 服务启动超时${NC}"
        echo ""
        echo "查看日志: docker logs lugang-ai-app --tail 100"
        echo ""
        echo -e "${YELLOW}如需回滚，运行: ./07-rollback.sh${NC}"
        exit 1
    fi
    echo "  等待中... ($i/30)"
    sleep 2
done

# 显示结果
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              部署完成!                                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "新镜像: ${NEW_IMAGE}"
echo ""
echo "验证步骤:"
echo "  1. 访问 https://www.airscend.com"
echo "  2. 使用 root / LuGang@2025 登录"
echo "  3. 测试知识库、应用等功能"
echo ""
echo -e "${YELLOW}如果发现问题，运行回滚脚本: ./07-rollback.sh${NC}"
echo ""

# 创建回滚脚本
cat > "${PROJECT_DIR}/scripts/server-maintenance/07-rollback.sh" << ROLLBACK_SCRIPT
#!/bin/bash

# ===== 鲁港通 - 回滚脚本 =====
# 回滚到上一个版本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\${GREEN}╔═══════════════════════════════════════════════════════╗\${NC}"
echo -e "\${GREEN}║        鲁港通 - 回滚脚本                              ║\${NC}"
echo -e "\${GREEN}╚═══════════════════════════════════════════════════════╝\${NC}"
echo ""

# 读取回滚信息
if [ -f /tmp/lugang-rollback-image.txt ]; then
    ROLLBACK_IMAGE=\$(head -1 /tmp/lugang-rollback-image.txt)
    echo "回滚到镜像: \${ROLLBACK_IMAGE}"
else
    echo -e "\${RED}未找到回滚信息${NC}"
    echo "请手动指定镜像:"
    read -p "镜像名称: " ROLLBACK_IMAGE
fi

if [ -z "\$ROLLBACK_IMAGE" ]; then
    echo -e "\${RED}未指定镜像，退出${NC}"
    exit 1
fi

read -p "确认回滚到 \${ROLLBACK_IMAGE}? (y/n): " -n 1 -r
echo
if [[ ! \$REPLY =~ ^[Yy]\$ ]]; then
    exit 0
fi

echo "停止当前容器..."
docker stop lugang-ai-app
docker rm lugang-ai-app

echo "启动回滚容器..."
docker run -d \\
    --name lugang-ai-app \\
    --restart always \\
    -p 3210:3000 \\
    --env-file ${PROJECT_DIR}/projects/app/.env.local \\
    --network lugang-ai-network \\
    "\${ROLLBACK_IMAGE}"

echo ""
echo -e "\${GREEN}✓ 回滚完成${NC}"
echo ""
echo "验证: curl http://localhost:3210/api/health"
ROLLBACK_SCRIPT

chmod +x "${PROJECT_DIR}/scripts/server-maintenance/07-rollback.sh"
echo -e "${GREEN}✓ 回滚脚本已创建: 07-rollback.sh${NC}"
