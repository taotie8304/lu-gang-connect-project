#!/bin/bash

# ===== 鲁港通跨境AI智能平台 - 一键回滚脚本 =====
#
# 用法:
#   ./rollback.sh                    # 回滚到上一个版本
#   ./rollback.sh <image_tag>        # 回滚到指定版本
#   ./rollback.sh --list             # 列出可用的历史镜像
#   ./rollback.sh --current          # 查看当前运行的版本
#
# 示例:
#   ./rollback.sh abc1234            # 回滚到 commit sha abc1234 对应的镜像
#   ./rollback.sh latest             # 回滚到 latest 标签

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 加载配置（set -a 自动导出，供 compose 插值 ${PLUGIN_AUTH_TOKEN} 等使用）
if [ -f ".env.deploy" ]; then
    set -a
    source .env.deploy
    set +a
fi

GITHUB_USERNAME=${GITHUB_USERNAME:-""}
REGISTRY="ghcr.io"
AI_IMAGE_BASE="${REGISTRY}/${GITHUB_USERNAME}/lugang-ai"
COMPOSE_FILE="docker-compose.prod.yml"
CONTAINER_NAME="lugang-ai-app"
BACKUP_TAG_FILE="/tmp/lugang-ai-rollback-previous-tag"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     鲁港通跨境AI智能平台 - 一键回滚工具 v1.0         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# 获取当前运行的镜像信息
get_current_image() {
    docker inspect --format='{{.Config.Image}}' ${CONTAINER_NAME} 2>/dev/null || echo "未运行"
}

get_current_image_id() {
    docker inspect --format='{{.Image}}' ${CONTAINER_NAME} 2>/dev/null | cut -c8-19
}

# 查看当前版本
if [ "$1" = "--current" ]; then
    CURRENT=$(get_current_image)
    CURRENT_ID=$(get_current_image_id)
    echo -e "${BLUE}当前运行版本:${NC}"
    echo "  镜像: ${CURRENT}"
    echo "  镜像ID: ${CURRENT_ID}"
    echo ""
    echo -e "${BLUE}容器状态:${NC}"
    docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Status}}\t{{.CreatedAt}}"
    exit 0
fi

# 列出可用的历史镜像
if [ "$1" = "--list" ]; then
    echo -e "${BLUE}本地可用的鲁港通前端镜像:${NC}"
    echo ""
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" | grep "lugang-ai" | head -20
    echo ""
    echo -e "${YELLOW}提示: 使用 commit SHA 标签来回滚到特定版本${NC}"
    echo -e "${YELLOW}例如: ./rollback.sh abc1234${NC}"
    exit 0
fi

# 确定回滚目标
TARGET_TAG="$1"

if [ -z "${TARGET_TAG}" ]; then
    # 没有指定标签，尝试回滚到上一个版本
    if [ -f "${BACKUP_TAG_FILE}" ]; then
        TARGET_TAG=$(cat "${BACKUP_TAG_FILE}")
        echo -e "${YELLOW}未指定版本，将回滚到上一个版本: ${TARGET_TAG}${NC}"
    else
        echo -e "${RED}错误: 没有找到上一个版本记录${NC}"
        echo ""
        echo "用法:"
        echo "  ./rollback.sh <image_tag>    回滚到指定版本"
        echo "  ./rollback.sh --list         列出可用镜像"
        echo "  ./rollback.sh --current      查看当前版本"
        echo ""
        echo "示例:"
        echo "  ./rollback.sh abc1234        回滚到 commit abc1234"
        exit 1
    fi
fi

TARGET_IMAGE="${AI_IMAGE_BASE}:${TARGET_TAG}"

# 如果是本地镜像名（不含 registry），直接使用
if [[ "${TARGET_TAG}" == *"/"* ]] || [[ "${TARGET_TAG}" == *":"* ]]; then
    TARGET_IMAGE="${TARGET_TAG}"
fi

echo -e "${BLUE}回滚信息:${NC}"
CURRENT_IMAGE=$(get_current_image)
echo "  当前版本: ${CURRENT_IMAGE}"
echo "  目标版本: ${TARGET_IMAGE}"
echo ""

# 确认操作
read -p "确认回滚? (y/N): " CONFIRM
if [ "${CONFIRM}" != "y" ] && [ "${CONFIRM}" != "Y" ]; then
    echo -e "${YELLOW}已取消回滚${NC}"
    exit 0
fi

# 步骤1: 记录当前版本（用于再次回滚）
echo ""
echo -e "${YELLOW}[1/4] 记录当前版本...${NC}"
echo "${CURRENT_IMAGE}" > "${BACKUP_TAG_FILE}"
echo -e "${GREEN}✓ 当前版本已记录: ${CURRENT_IMAGE}${NC}"

# 步骤2: 尝试拉取目标镜像（如果是远程镜像）
echo ""
echo -e "${YELLOW}[2/4] 检查目标镜像...${NC}"
if docker image inspect "${TARGET_IMAGE}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 目标镜像已存在于本地${NC}"
else
    echo "本地未找到，尝试从远程拉取..."
    if docker pull "${TARGET_IMAGE}"; then
        echo -e "${GREEN}✓ 目标镜像拉取成功${NC}"
    else
        echo -e "${RED}✗ 无法获取目标镜像: ${TARGET_IMAGE}${NC}"
        echo -e "${YELLOW}请检查镜像标签是否正确，使用 --list 查看可用镜像${NC}"
        exit 1
    fi
fi

# 步骤3: 停止当前容器并启动新版本
echo ""
echo -e "${YELLOW}[3/4] 切换到目标版本...${NC}"

# 停止当前容器
docker stop ${CONTAINER_NAME} 2>/dev/null || true
docker rm ${CONTAINER_NAME} 2>/dev/null || true

# 鲁港通 - 改用 compose 覆盖 LUGANG_AI_IMAGE 回滚：raw docker run 会丢失 compose 的 environment
# 覆盖（PLUGIN_TOKEN/CODE_SANDBOX_TOKEN 等），导致前端与 plugin/sandbox 令牌不一致而鉴权失败
export LUGANG_AI_IMAGE="${TARGET_IMAGE}"
docker compose -f ${COMPOSE_FILE} up -d --no-deps lugang-ai

echo -e "${GREEN}✓ 容器已启动${NC}"

# 步骤4: 验证服务
echo ""
echo -e "${YELLOW}[4/4] 验证服务状态...${NC}"
sleep 5

for i in {1..20}; do
    if curl -s -f http://localhost:3210/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 鲁港通前端回滚成功并已正常运行!${NC}"
        echo ""
        echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                    回滚完成!                          ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "当前运行版本: ${BLUE}${TARGET_IMAGE}${NC}"
        echo -e "上一个版本:   ${BLUE}${CURRENT_IMAGE}${NC}"
        echo ""
        echo -e "如需再次回滚: ${BLUE}./rollback.sh${NC} (回到上一个版本)"
        echo -e "查看日志:     ${BLUE}docker logs -f ${CONTAINER_NAME}${NC}"
        echo -e "数据回退:     按 ${BLUE}MIGRATION-4162.md 第 7 节${NC} 用备份覆盖 ./data/* 后再回滚"
        exit 0
    fi
    echo "  等待服务启动... ($i/20)"
    sleep 3
done

# 启动失败，自动回滚
echo -e "${RED}✗ 新版本启动失败!${NC}"
echo -e "${YELLOW}正在自动恢复到之前的版本...${NC}"

export LUGANG_AI_IMAGE="${CURRENT_IMAGE}"
docker compose -f ${COMPOSE_FILE} up -d --no-deps lugang-ai

echo -e "${GREEN}✓ 已恢复到之前的版本: ${CURRENT_IMAGE}${NC}"
echo -e "${RED}请检查目标镜像是否有问题${NC}"
exit 1
