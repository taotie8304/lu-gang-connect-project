#!/bin/bash

# ===== 鲁港通 - 最终备份脚本 =====
# 在确认所有功能正常后，创建最终的干净备份
# 
# 使用方法: 
#   chmod +x 05-final-backup.sh
#   ./05-final-backup.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
BACKUP_ROOT="/www/wwwroot/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FINAL_BACKUP_DIR="${BACKUP_ROOT}/lugang-final-${TIMESTAMP}"
PROJECT_DIR="/www/wwwroot/lugang-ai"

# 数据库配置 - 与 docker-compose.yml 保持一致
# 默认密码来自 docker-compose.yml: MONGO_INITDB_ROOT_PASSWORD=password, POSTGRES_PASSWORD=password
MONGO_USER="${MONGO_USER:-root}"
MONGO_PASSWORD="${MONGO_PASSWORD:-password}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-password}"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        鲁港通 - 最终备份脚本 v1.1                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}此脚本将创建一个干净的、可用于回滚的最终备份${NC}"
echo ""

# ===== 前置检查 =====
echo -e "${YELLOW}[0/5] 前置检查...${NC}"

# 检查项目目录
if [ ! -d "${PROJECT_DIR}" ]; then
    echo -e "${RED}错误: 项目目录不存在: ${PROJECT_DIR}${NC}"
    exit 1
fi

# 检查 .env.local 文件
if [ ! -f "${PROJECT_DIR}/projects/app/.env.local" ]; then
    echo -e "${RED}错误: 配置文件不存在: ${PROJECT_DIR}/projects/app/.env.local${NC}"
    exit 1
fi

# 检查必要的容器是否运行
echo "检查容器状态..."
CONTAINERS_OK=true
for container in lugang-ai-app lugang-ai-mongo lugang-ai-pg; do
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        echo -e "  ${GREEN}✓${NC} ${container} 运行中"
    else
        echo -e "  ${RED}✗${NC} ${container} 未运行"
        CONTAINERS_OK=false
    fi
done

if [ "$CONTAINERS_OK" = false ]; then
    echo -e "${RED}错误: 部分容器未运行，无法完成备份${NC}"
    exit 1
fi

# 验证数据库连接
echo ""
echo "验证数据库连接..."
if ! docker exec lugang-ai-mongo mongosh --username="${MONGO_USER}" --password="${MONGO_PASSWORD}" --authenticationDatabase=admin --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
    if ! docker exec lugang-ai-mongo mongo --username="${MONGO_USER}" --password="${MONGO_PASSWORD}" --authenticationDatabase=admin --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
        echo -e "${RED}警告: MongoDB 连接验证失败，密码可能不正确${NC}"
        echo "当前使用的密码: ${MONGO_PASSWORD}"
        read -p "是否继续? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi
echo -e "${GREEN}✓ 前置检查完成${NC}"
echo ""

# 确认
read -p "是否已验证所有服务功能正常? (输入 'yes' 继续): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    echo -e "${RED}请先运行 04-verify-services.sh 验证服务${NC}"
    exit 1
fi

# 创建备份目录
echo -e "${YELLOW}[1/5] 创建备份目录...${NC}"
mkdir -p "${FINAL_BACKUP_DIR}"/{mongodb,postgresql,redis,configs,docker-images}
echo -e "${GREEN}✓ 备份目录: ${FINAL_BACKUP_DIR}${NC}"

# 备份 MongoDB
echo ""
echo -e "${YELLOW}[2/5] 备份 MongoDB...${NC}"
docker exec lugang-ai-mongo mongodump \
    --username="${MONGO_USER}" \
    --password="${MONGO_PASSWORD}" \
    --authenticationDatabase=admin \
    --out=/dump

docker cp lugang-ai-mongo:/dump "${FINAL_BACKUP_DIR}/mongodb/"
docker exec lugang-ai-mongo rm -rf /dump

# 验证备份
if [ -d "${FINAL_BACKUP_DIR}/mongodb/dump" ] && [ "$(ls -A ${FINAL_BACKUP_DIR}/mongodb/dump 2>/dev/null)" ]; then
    MONGO_SIZE=$(du -sh "${FINAL_BACKUP_DIR}/mongodb" | cut -f1)
    echo -e "${GREEN}✓ MongoDB 备份完成 (${MONGO_SIZE})${NC}"
else
    echo -e "${RED}✗ MongoDB 备份失败！${NC}"
    exit 1
fi

# 备份 PostgreSQL
echo ""
echo -e "${YELLOW}[3/5] 备份 PostgreSQL...${NC}"
docker exec lugang-ai-pg pg_dumpall -U "${PG_USER}" > "${FINAL_BACKUP_DIR}/postgresql/all_databases.sql"

# 验证备份
if [ -f "${FINAL_BACKUP_DIR}/postgresql/all_databases.sql" ] && [ -s "${FINAL_BACKUP_DIR}/postgresql/all_databases.sql" ]; then
    PG_SIZE=$(du -sh "${FINAL_BACKUP_DIR}/postgresql" | cut -f1)
    echo -e "${GREEN}✓ PostgreSQL 备份完成 (${PG_SIZE})${NC}"
else
    echo -e "${RED}✗ PostgreSQL 备份失败！${NC}"
    exit 1
fi

# 备份配置文件
echo ""
echo -e "${YELLOW}[4/5] 备份配置文件...${NC}"
cp -r "${PROJECT_DIR}/projects/app/.env"* "${FINAL_BACKUP_DIR}/configs/" 2>/dev/null || true
cp -r "${PROJECT_DIR}/docker-compose"*.yml "${FINAL_BACKUP_DIR}/configs/" 2>/dev/null || true
cp -r "${PROJECT_DIR}/projects/app/data" "${FINAL_BACKUP_DIR}/configs/" 2>/dev/null || true

# 保存当前镜像信息
docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "lugang|fastgpt" > "${FINAL_BACKUP_DIR}/docker-images/current-images.txt" 2>/dev/null || true
echo -e "${GREEN}✓ 配置文件备份完成${NC}"

# 保存当前镜像（强烈建议）
echo ""
echo -e "${YELLOW}[5/5] 保存 Docker 镜像...${NC}"
echo ""
echo -e "${RED}⚠️  强烈建议保存当前镜像，这是回滚的最后保障！${NC}"
read -p "是否保存当前 Docker 镜像? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 获取当前鲁港通前端镜像
    CURRENT_IMAGE=$(docker inspect lugang-ai-app --format='{{.Config.Image}}' 2>/dev/null || echo "")
    CURRENT_IMAGE_ID=$(docker inspect lugang-ai-app --format='{{.Image}}' 2>/dev/null || echo "")
    
    if [ -n "$CURRENT_IMAGE" ]; then
        echo "保存镜像: $CURRENT_IMAGE"
        echo "镜像ID: $CURRENT_IMAGE_ID"
        
        # 先给镜像打备份标签
        BACKUP_TAG="lugang-ai:backup-final-${TIMESTAMP}"
        docker tag "$CURRENT_IMAGE_ID" "$BACKUP_TAG" 2>/dev/null || docker tag "$CURRENT_IMAGE" "$BACKUP_TAG" 2>/dev/null
        echo "备份标签: $BACKUP_TAG"
        
        # 保存镜像到文件
        docker save "$CURRENT_IMAGE" | gzip > "${FINAL_BACKUP_DIR}/docker-images/lugang-ai-app.tar.gz"
        
        # 保存镜像信息
        echo "$CURRENT_IMAGE" > "${FINAL_BACKUP_DIR}/docker-images/image-info.txt"
        echo "$CURRENT_IMAGE_ID" >> "${FINAL_BACKUP_DIR}/docker-images/image-info.txt"
        echo "$BACKUP_TAG" >> "${FINAL_BACKUP_DIR}/docker-images/image-info.txt"
        
        IMAGE_SIZE=$(du -sh "${FINAL_BACKUP_DIR}/docker-images/lugang-ai-app.tar.gz" | cut -f1)
        echo -e "${GREEN}✓ 镜像保存完成 (${IMAGE_SIZE})${NC}"
        echo -e "${GREEN}✓ 备份标签: ${BACKUP_TAG}${NC}"
    fi
else
    echo -e "${YELLOW}跳过镜像保存${NC}"
    echo -e "${RED}警告: 如果不保存镜像，回滚时可能需要重新构建！${NC}"
fi

# 创建恢复脚本
echo ""
echo -e "${BLUE}创建恢复脚本...${NC}"

# 保存当前镜像信息到备份目录（用于恢复时参考）
CURRENT_IMAGE_FOR_RESTORE=$(docker inspect lugang-ai-app --format='{{.Config.Image}}' 2>/dev/null || echo "")
echo "${CURRENT_IMAGE_FOR_RESTORE}" > "${FINAL_BACKUP_DIR}/docker-images/original-image.txt"

cat > "${FINAL_BACKUP_DIR}/restore.sh" << 'RESTORE_SCRIPT'
#!/bin/bash

# ===== 鲁港通 - 恢复脚本 =====
# 从此备份恢复系统

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取脚本所在目录（备份目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}"
PROJECT_DIR="/www/wwwroot/lugang-ai"

MONGO_USER="root"
MONGO_PASSWORD="password"
PG_USER="postgres"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        鲁港通 - 恢复脚本                              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "备份目录: ${BACKUP_DIR}"
echo ""

# 检查备份文件是否存在
echo "检查备份文件..."
if [ ! -d "${BACKUP_DIR}/mongodb/dump" ]; then
    echo -e "${RED}错误: MongoDB 备份不存在${NC}"
    exit 1
fi
if [ ! -f "${BACKUP_DIR}/postgresql/all_databases.sql" ]; then
    echo -e "${RED}错误: PostgreSQL 备份不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 备份文件检查通过${NC}"
echo ""

# 确认恢复
echo -e "${RED}⚠️  警告: 这将覆盖当前所有数据！${NC}"
read -p "确认恢复? (输入 'RESTORE' 确认): " CONFIRM
if [[ "$CONFIRM" != "RESTORE" ]]; then
    echo "取消恢复"
    exit 0
fi

echo ""
echo "开始恢复..."

# 恢复 MongoDB
echo ""
echo -e "${YELLOW}[1/3] 恢复 MongoDB...${NC}"
docker cp "${BACKUP_DIR}/mongodb/dump" lugang-ai-mongo:/
docker exec lugang-ai-mongo mongorestore \
    --username="${MONGO_USER}" \
    --password="${MONGO_PASSWORD}" \
    --authenticationDatabase=admin \
    --drop \
    /dump
docker exec lugang-ai-mongo rm -rf /dump
echo -e "${GREEN}✓ MongoDB 恢复完成${NC}"

# 恢复 PostgreSQL
echo ""
echo -e "${YELLOW}[2/3] 恢复 PostgreSQL...${NC}"
cat "${BACKUP_DIR}/postgresql/all_databases.sql" | docker exec -i lugang-ai-pg psql -U "${PG_USER}"
echo -e "${GREEN}✓ PostgreSQL 恢复完成${NC}"

# 恢复 Docker 镜像（如果存在）
echo ""
echo -e "${YELLOW}[3/3] 恢复 Docker 镜像...${NC}"
if [ -f "${BACKUP_DIR}/docker-images/lugang-ai-app.tar.gz" ]; then
    echo "加载镜像文件..."
    LOADED_IMAGE=$(gunzip -c "${BACKUP_DIR}/docker-images/lugang-ai-app.tar.gz" | docker load | grep "Loaded image" | awk '{print $NF}')
    
    if [ -z "$LOADED_IMAGE" ]; then
        # 尝试从 image-info.txt 获取镜像名
        if [ -f "${BACKUP_DIR}/docker-images/image-info.txt" ]; then
            LOADED_IMAGE=$(head -1 "${BACKUP_DIR}/docker-images/image-info.txt")
        fi
    fi
    
    echo "加载的镜像: ${LOADED_IMAGE}"
    
    if [ -n "$LOADED_IMAGE" ]; then
        echo "重启容器使用恢复的镜像..."
        docker stop lugang-ai-app 2>/dev/null || true
        docker rm lugang-ai-app 2>/dev/null || true
        
        # 检查网络是否存在
        NETWORK_NAME="lugang-ai-network"
        if ! docker network ls --format "{{.Name}}" | grep -q "^${NETWORK_NAME}$"; then
            echo "创建网络: ${NETWORK_NAME}"
            docker network create ${NETWORK_NAME}
        fi
        
        docker run -d \
            --name lugang-ai-app \
            --restart always \
            -p 3210:3000 \
            --env-file "${PROJECT_DIR}/projects/app/.env.local" \
            --network lugang-ai-network \
            "${LOADED_IMAGE}"
        echo -e "${GREEN}✓ Docker 镜像恢复完成${NC}"
    else
        echo -e "${YELLOW}⚠ 无法确定镜像名称，请手动重启容器${NC}"
    fi
else
    echo -e "${YELLOW}⚠ 未找到镜像备份文件，跳过镜像恢复${NC}"
    echo "建议重启应用: docker restart lugang-ai-app"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              恢复完成!                                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "验证服务: curl http://localhost:3210/api/health"
RESTORE_SCRIPT

chmod +x "${FINAL_BACKUP_DIR}/restore.sh"
echo -e "${GREEN}✓ 恢复脚本已创建${NC}"

# 创建备份信息文件
cat > "${FINAL_BACKUP_DIR}/BACKUP_INFO.txt" << EOF
===== 鲁港通最终备份 =====
备份时间: $(date)
备份类型: 最终干净备份（功能验证后）
服务器: $(hostname)

===== 备份内容 =====
- MongoDB 完整数据
- PostgreSQL 完整数据
- 配置文件
- Docker 镜像信息

===== 恢复方法 =====
1. 确保容器正在运行
2. 执行: ./restore.sh

===== 备份大小 =====
$(du -sh ${FINAL_BACKUP_DIR}/*)

总大小: $(du -sh ${FINAL_BACKUP_DIR} | cut -f1)
EOF

# 删除旧备份（可选）
echo ""
echo -e "${YELLOW}检查旧备份...${NC}"
OLD_BACKUPS=$(find "${BACKUP_ROOT}" -maxdepth 1 -name "lugang-backup-*" -type d 2>/dev/null | wc -l)
if [ "$OLD_BACKUPS" -gt 0 ]; then
    echo "发现 ${OLD_BACKUPS} 个旧备份:"
    find "${BACKUP_ROOT}" -maxdepth 1 -name "lugang-backup-*" -type d -exec basename {} \;
    echo ""
    read -p "是否删除旧备份? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        find "${BACKUP_ROOT}" -maxdepth 1 -name "lugang-backup-*" -type d -exec rm -rf {} \;
        echo -e "${GREEN}✓ 旧备份已删除${NC}"
    fi
fi

# 显示结果
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              最终备份完成!                            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "备份位置: ${CYAN}${FINAL_BACKUP_DIR}${NC}"
echo ""
echo "备份内容:"
du -sh "${FINAL_BACKUP_DIR}"/*
echo ""
echo -e "总大小: ${YELLOW}$(du -sh ${FINAL_BACKUP_DIR} | cut -f1)${NC}"
echo ""
echo -e "${GREEN}恢复命令: ${FINAL_BACKUP_DIR}/restore.sh${NC}"
echo ""
echo -e "${YELLOW}下一步: 运行 06-pull-new-image.sh 拉取新镜像${NC}"
