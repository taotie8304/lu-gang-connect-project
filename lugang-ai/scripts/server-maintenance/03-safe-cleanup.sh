#!/bin/bash

# ===== 鲁港通 - 安全清理脚本 =====
# 此脚本会逐项确认后再删除
# 
# 使用方法: 
#   chmod +x 03-safe-cleanup.sh
#   ./03-safe-cleanup.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ===== 定义鲁港通核心资源（绝对不能删除）=====
PROTECTED_CONTAINERS=(
    "lugang-ai-app"
    "lugang-ai-mongo"
    "lugang-ai-pg"
    "lugang-ai-redis"
    "lugang-enterprise"
)

PROTECTED_IMAGES=(
    "lugang-ai"
    "lugang-enterprise"
    "mongo"
    "pgvector"
    "redis"
    "postgres"
    "ghcr.io/taotie8304"
)

PROTECTED_VOLUMES=(
    "lugang"
    "mongo"
    "pg"
    "redis"
    "oneapi"
)

PROTECTED_NETWORKS=(
    "lugang"
    "bridge"
    "host"
    "none"
)

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        鲁港通 - 安全清理脚本 v1.0                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${RED}⚠️  警告: 此脚本会删除 Docker 资源${NC}"
echo -e "${RED}⚠️  请确保已运行 01-full-backup.sh 完成备份${NC}"
echo ""
read -p "是否已完成备份? (输入 'yes' 继续): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    echo -e "${RED}请先运行备份脚本${NC}"
    exit 1
fi
echo ""

# 检查资源是否受保护
is_protected() {
    local resource="$1"
    local -n protected_list="$2"
    
    for protected in "${protected_list[@]}"; do
        if [[ "$resource" == *"$protected"* ]]; then
            return 0  # 受保护
        fi
    done
    return 1  # 不受保护
}

# ===== 清理停止的容器 =====
echo -e "${YELLOW}[1/4] 检查停止的容器...${NC}"
STOPPED_CONTAINERS=$(docker ps -a --filter "status=exited" --filter "status=created" --format "{{.Names}}")

if [ -n "$STOPPED_CONTAINERS" ]; then
    echo "发现以下停止的容器:"
    echo "$STOPPED_CONTAINERS" | while read container; do
        if is_protected "$container" PROTECTED_CONTAINERS; then
            echo -e "  - ${container} ${GREEN}[受保护-跳过]${NC}"
        else
            echo -e "  - ${container} ${RED}[可删除]${NC}"
        fi
    done
    echo ""
    
    read -p "是否删除未受保护的停止容器? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$STOPPED_CONTAINERS" | while read container; do
            if ! is_protected "$container" PROTECTED_CONTAINERS; then
                echo -e "删除容器: ${RED}${container}${NC}"
                docker rm "$container" 2>/dev/null || true
            fi
        done
        echo -e "${GREEN}✓ 停止的容器清理完成${NC}"
    else
        echo -e "${YELLOW}跳过容器清理${NC}"
    fi
else
    echo -e "${GREEN}✓ 没有停止的容器需要清理${NC}"
fi
echo ""

# ===== 清理悬空镜像 =====
echo -e "${YELLOW}[2/4] 检查悬空镜像 (dangling)...${NC}"
DANGLING_IMAGES=$(docker images -f "dangling=true" -q)

if [ -n "$DANGLING_IMAGES" ]; then
    echo "发现 $(echo "$DANGLING_IMAGES" | wc -l) 个悬空镜像:"
    docker images -f "dangling=true" --format "  - {{.ID}} ({{.Size}}, {{.CreatedSince}})"
    echo ""
    
    read -p "是否删除所有悬空镜像? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker image prune -f
        echo -e "${GREEN}✓ 悬空镜像清理完成${NC}"
    else
        echo -e "${YELLOW}跳过悬空镜像清理${NC}"
    fi
else
    echo -e "${GREEN}✓ 没有悬空镜像需要清理${NC}"
fi
echo ""

# ===== 清理未使用的镜像 =====
echo -e "${YELLOW}[3/4] 检查未使用的镜像...${NC}"
echo ""
echo "以下镜像可能未被使用（请仔细确认）:"

docker images --format "{{.Repository}}:{{.Tag}}" | while read image; do
    if is_protected "$image" PROTECTED_IMAGES; then
        echo -e "  - ${image} ${GREEN}[受保护]${NC}"
    else
        # 检查是否有容器使用此镜像
        USED=$(docker ps -a --filter "ancestor=$image" -q | wc -l)
        if [ "$USED" -eq 0 ]; then
            echo -e "  - ${image} ${YELLOW}[未使用]${NC}"
        else
            echo -e "  - ${image} ${BLUE}[使用中]${NC}"
        fi
    fi
done

echo ""
echo -e "${YELLOW}注意: 不建议自动删除镜像，请手动确认后删除${NC}"
echo "手动删除命令: docker rmi <image_name>"
echo ""

# ===== 清理未使用的卷 =====
echo -e "${YELLOW}[4/4] 检查未使用的卷...${NC}"
DANGLING_VOLUMES=$(docker volume ls -f "dangling=true" -q)

if [ -n "$DANGLING_VOLUMES" ]; then
    echo "发现以下未使用的卷:"
    echo "$DANGLING_VOLUMES" | while read volume; do
        if is_protected "$volume" PROTECTED_VOLUMES; then
            echo -e "  - ${volume} ${GREEN}[受保护-跳过]${NC}"
        else
            echo -e "  - ${volume} ${RED}[可删除]${NC}"
        fi
    done
    echo ""
    
    echo -e "${RED}⚠️  警告: 删除卷会永久丢失数据！${NC}"
    read -p "是否删除未受保护的未使用卷? (输入 'DELETE' 确认): " CONFIRM
    if [[ "$CONFIRM" == "DELETE" ]]; then
        echo "$DANGLING_VOLUMES" | while read volume; do
            if ! is_protected "$volume" PROTECTED_VOLUMES; then
                echo -e "删除卷: ${RED}${volume}${NC}"
                docker volume rm "$volume" 2>/dev/null || true
            fi
        done
        echo -e "${GREEN}✓ 未使用卷清理完成${NC}"
    else
        echo -e "${YELLOW}跳过卷清理${NC}"
    fi
else
    echo -e "${GREEN}✓ 没有未使用的卷需要清理${NC}"
fi
echo ""

# ===== 清理未使用的网络 =====
echo -e "${YELLOW}[5/4] 检查未使用的网络...${NC}"
echo ""
echo "以下网络可能未被使用:"

docker network ls --format "{{.Name}}" | while read network; do
    if is_protected "$network" PROTECTED_NETWORKS; then
        echo -e "  - ${network} ${GREEN}[受保护]${NC}"
    else
        # 检查是否有容器使用此网络
        USED=$(docker network inspect "$network" --format '{{len .Containers}}' 2>/dev/null || echo "0")
        if [ "$USED" -eq 0 ]; then
            echo -e "  - ${network} ${YELLOW}[未使用]${NC}"
        else
            echo -e "  - ${network} ${BLUE}[使用中: ${USED}个容器]${NC}"
        fi
    fi
done

echo ""
read -p "是否清理未使用的网络? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker network prune -f
    echo -e "${GREEN}✓ 未使用网络清理完成${NC}"
else
    echo -e "${YELLOW}跳过网络清理${NC}"
fi
echo ""

# ===== 显示清理后的状态 =====
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  清理完成                             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}=== 当前 Docker 资源状态 ===${NC}"
echo ""
echo "容器:"
docker ps -a --format "  {{.Names}}: {{.Status}}"
echo ""
echo "磁盘使用:"
docker system df
echo ""
echo -e "${YELLOW}下一步: 运行 04-verify-services.sh 验证服务功能${NC}"
