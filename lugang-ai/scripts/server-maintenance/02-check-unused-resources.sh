#!/bin/bash

# ===== 鲁港通 - 检查无用资源脚本 =====
# 此脚本只检查，不删除任何内容
# 
# 使用方法: 
#   chmod +x 02-check-unused-resources.sh
#   ./02-check-unused-resources.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      鲁港通 - 检查无用资源脚本 v1.0                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# ===== 定义鲁港通核心资源（不能删除）=====
CORE_CONTAINERS=(
    "lugang-ai-app"
    "lugang-ai-mongo"
    "lugang-ai-pg"
    "lugang-ai-redis"
    "lugang-enterprise"
)

CORE_IMAGES=(
    "lugang-ai"
    "lugang-enterprise"
    "mongo"
    "pgvector/pgvector"
    "redis"
    "postgres"
)

CORE_VOLUMES=(
    "lugang-ai_mongo-data"
    "lugang-ai_pg-data"
    "lugang-ai_redis-data"
    "lugang-ai_oneapi-data"
)

CORE_NETWORKS=(
    "lugang-ai-network"
    "lugang-ai_lugang-ai-network"
    "bridge"
    "host"
    "none"
)

# ===== 检查容器 =====
echo -e "${YELLOW}[1/4] 检查 Docker 容器...${NC}"
echo ""
echo -e "${CYAN}=== 所有容器 ===${NC}"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo ""

echo -e "${GREEN}✓ 核心容器（必须保留）:${NC}"
for container in "${CORE_CONTAINERS[@]}"; do
    if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
        STATUS=$(docker ps -a --filter "name=^${container}$" --format "{{.Status}}")
        echo -e "  - ${container}: ${STATUS}"
    else
        echo -e "  - ${container}: ${RED}未找到${NC}"
    fi
done
echo ""

echo -e "${YELLOW}⚠ 可能无用的容器:${NC}"
UNUSED_CONTAINERS=()
while IFS= read -r container; do
    IS_CORE=false
    for core in "${CORE_CONTAINERS[@]}"; do
        if [[ "$container" == "$core" ]]; then
            IS_CORE=true
            break
        fi
    done
    if [[ "$IS_CORE" == false && -n "$container" ]]; then
        UNUSED_CONTAINERS+=("$container")
        STATUS=$(docker ps -a --filter "name=^${container}$" --format "{{.Status}}")
        echo -e "  - ${RED}${container}${NC}: ${STATUS}"
    fi
done < <(docker ps -a --format "{{.Names}}")

if [ ${#UNUSED_CONTAINERS[@]} -eq 0 ]; then
    echo -e "  ${GREEN}无${NC}"
fi
echo ""

# ===== 检查镜像 =====
echo -e "${YELLOW}[2/4] 检查 Docker 镜像...${NC}"
echo ""
echo -e "${CYAN}=== 所有镜像 ===${NC}"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"
echo ""

echo -e "${GREEN}✓ 核心镜像（必须保留）:${NC}"
for image in "${CORE_IMAGES[@]}"; do
    if docker images --format "{{.Repository}}" | grep -q "${image}"; then
        SIZE=$(docker images --filter "reference=${image}*" --format "{{.Size}}" | head -1)
        echo -e "  - ${image}: ${SIZE}"
    fi
done
echo ""

echo -e "${YELLOW}⚠ 可能无用的镜像:${NC}"
UNUSED_IMAGES=()
while IFS= read -r image; do
    IS_CORE=false
    for core in "${CORE_IMAGES[@]}"; do
        if [[ "$image" == *"$core"* ]]; then
            IS_CORE=true
            break
        fi
    done
    # 排除 <none> 镜像（悬空镜像单独处理）
    if [[ "$IS_CORE" == false && -n "$image" && "$image" != "<none>" ]]; then
        UNUSED_IMAGES+=("$image")
        echo -e "  - ${RED}${image}${NC}"
    fi
done < <(docker images --format "{{.Repository}}" | sort -u)

if [ ${#UNUSED_IMAGES[@]} -eq 0 ]; then
    echo -e "  ${GREEN}无${NC}"
fi
echo ""

# 检查悬空镜像
DANGLING=$(docker images -f "dangling=true" -q | wc -l)
if [ "$DANGLING" -gt 0 ]; then
    echo -e "${YELLOW}⚠ 悬空镜像 (dangling): ${DANGLING} 个${NC}"
    docker images -f "dangling=true" --format "  - {{.ID}} ({{.Size}})"
fi
echo ""

# ===== 检查卷 =====
echo -e "${YELLOW}[3/4] 检查 Docker 卷...${NC}"
echo ""
echo -e "${CYAN}=== 所有卷 ===${NC}"
docker volume ls --format "table {{.Name}}\t{{.Driver}}"
echo ""

echo -e "${GREEN}✓ 核心卷（必须保留）:${NC}"
for volume in "${CORE_VOLUMES[@]}"; do
    if docker volume ls --format "{{.Name}}" | grep -q "^${volume}$"; then
        echo -e "  - ${volume}"
    fi
done
echo ""

echo -e "${YELLOW}⚠ 可能无用的卷:${NC}"
UNUSED_VOLUMES=()
while IFS= read -r volume; do
    IS_CORE=false
    for core in "${CORE_VOLUMES[@]}"; do
        if [[ "$volume" == "$core" ]]; then
            IS_CORE=true
            break
        fi
    done
    if [[ "$IS_CORE" == false && -n "$volume" ]]; then
        UNUSED_VOLUMES+=("$volume")
        echo -e "  - ${RED}${volume}${NC}"
    fi
done < <(docker volume ls --format "{{.Name}}")

if [ ${#UNUSED_VOLUMES[@]} -eq 0 ]; then
    echo -e "  ${GREEN}无${NC}"
fi

# 检查未使用的卷
UNUSED_VOL_COUNT=$(docker volume ls -f "dangling=true" -q | wc -l)
if [ "$UNUSED_VOL_COUNT" -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠ 未被任何容器使用的卷: ${UNUSED_VOL_COUNT} 个${NC}"
    docker volume ls -f "dangling=true" --format "  - {{.Name}}"
fi
echo ""

# ===== 检查网络 =====
echo -e "${YELLOW}[4/4] 检查 Docker 网络...${NC}"
echo ""
echo -e "${CYAN}=== 所有网络 ===${NC}"
docker network ls --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}"
echo ""

echo -e "${GREEN}✓ 核心网络（必须保留）:${NC}"
for network in "${CORE_NETWORKS[@]}"; do
    if docker network ls --format "{{.Name}}" | grep -q "^${network}$"; then
        echo -e "  - ${network}"
    fi
done
echo ""

echo -e "${YELLOW}⚠ 可能无用的网络:${NC}"
UNUSED_NETWORKS=()
while IFS= read -r network; do
    IS_CORE=false
    for core in "${CORE_NETWORKS[@]}"; do
        if [[ "$network" == "$core" ]]; then
            IS_CORE=true
            break
        fi
    done
    if [[ "$IS_CORE" == false && -n "$network" ]]; then
        UNUSED_NETWORKS+=("$network")
        echo -e "  - ${RED}${network}${NC}"
    fi
done < <(docker network ls --format "{{.Name}}")

if [ ${#UNUSED_NETWORKS[@]} -eq 0 ]; then
    echo -e "  ${GREEN}无${NC}"
fi
echo ""

# ===== 生成清理建议 =====
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  检查完成                             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}=== 清理建议 ===${NC}"
echo ""

# 保存检查结果到文件
REPORT_FILE="/tmp/docker-cleanup-report-$(date +%Y%m%d_%H%M%S).txt"
cat > "$REPORT_FILE" << EOF
===== 鲁港通 Docker 资源检查报告 =====
检查时间: $(date)

=== 可能无用的容器 ===
${UNUSED_CONTAINERS[*]:-无}

=== 可能无用的镜像 ===
${UNUSED_IMAGES[*]:-无}

=== 可能无用的卷 ===
${UNUSED_VOLUMES[*]:-无}

=== 可能无用的网络 ===
${UNUSED_NETWORKS[*]:-无}

=== 悬空镜像数量 ===
${DANGLING}

=== 未使用卷数量 ===
${UNUSED_VOL_COUNT}
EOF

echo -e "检查报告已保存到: ${CYAN}${REPORT_FILE}${NC}"
echo ""

if [ ${#UNUSED_CONTAINERS[@]} -gt 0 ] || [ ${#UNUSED_IMAGES[@]} -gt 0 ] || [ "$DANGLING" -gt 0 ]; then
    echo -e "${YELLOW}发现可清理的资源，请运行 03-safe-cleanup.sh 进行安全清理${NC}"
else
    echo -e "${GREEN}未发现明显的无用资源${NC}"
fi
echo ""
echo -e "${YELLOW}下一步: 运行 03-safe-cleanup.sh 进行安全清理（需要确认）${NC}"
