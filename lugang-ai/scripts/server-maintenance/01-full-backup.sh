#!/bin/bash

# ===== 鲁港通 - 完整备份脚本 =====
# 执行前请确保有足够的磁盘空间
# 
# 使用方法: 
#   chmod +x 01-full-backup.sh
#   ./01-full-backup.sh

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
BACKUP_DIR="${BACKUP_ROOT}/lugang-backup-${TIMESTAMP}"
PROJECT_DIR="/www/wwwroot/lugang-ai"

# 数据库配置 - 从环境变量或默认值获取
# 注意：这些密码需要与 docker-compose.yml 中的配置一致！
# 默认密码来自 docker-compose.yml: MONGO_INITDB_ROOT_PASSWORD=password, POSTGRES_PASSWORD=password
MONGO_USER="${MONGO_USER:-root}"
MONGO_PASSWORD="${MONGO_PASSWORD:-password}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-password}"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        鲁港通 - 完整备份脚本 v1.1                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}备份时间: ${TIMESTAMP}${NC}"
echo -e "${BLUE}备份目录: ${BACKUP_DIR}${NC}"
echo ""

# ===== 前置检查 =====
echo -e "${YELLOW}[0/8] 前置检查...${NC}"

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}警告: 建议使用 root 用户运行此脚本${NC}"
fi

# 检查备份目录是否可写
if [ ! -d "${BACKUP_ROOT}" ]; then
    echo "创建备份根目录: ${BACKUP_ROOT}"
    mkdir -p "${BACKUP_ROOT}" || {
        echo -e "${RED}错误: 无法创建备份目录 ${BACKUP_ROOT}${NC}"
        exit 1
    }
fi

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

# 尝试验证数据库密码
echo ""
echo "验证数据库连接..."
if ! docker exec lugang-ai-mongo mongosh --username="${MONGO_USER}" --password="${MONGO_PASSWORD}" --authenticationDatabase=admin --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
    # 尝试旧版 mongo 命令
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

# 检查磁盘空间
echo -e "${YELLOW}[0/7] 检查磁盘空间...${NC}"
AVAILABLE_SPACE=$(df -BG /www/wwwroot | tail -1 | awk '{print $4}' | sed 's/G//')
echo "可用空间: ${AVAILABLE_SPACE}GB"
if [ "$AVAILABLE_SPACE" -lt 10 ]; then
    echo -e "${RED}警告: 磁盘空间不足 10GB，建议清理后再备份${NC}"
    read -p "是否继续? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 创建备份目录
echo -e "${YELLOW}[1/7] 创建备份目录...${NC}"
mkdir -p "${BACKUP_DIR}"/{mongodb,postgresql,redis,docker,configs,volumes}
echo -e "${GREEN}✓ 备份目录已创建${NC}"

# 备份 MongoDB
echo ""
echo -e "${YELLOW}[2/7] 备份 MongoDB 数据库...${NC}"
if docker ps | grep -q lugang-ai-mongo; then
    docker exec lugang-ai-mongo mongodump \
        --username="${MONGO_USER}" \
        --password="${MONGO_PASSWORD}" \
        --authenticationDatabase=admin \
        --out=/dump
    
    docker cp lugang-ai-mongo:/dump "${BACKUP_DIR}/mongodb/"
    docker exec lugang-ai-mongo rm -rf /dump
    
    # 验证备份是否成功
    if [ -d "${BACKUP_DIR}/mongodb/dump" ] && [ "$(ls -A ${BACKUP_DIR}/mongodb/dump 2>/dev/null)" ]; then
        MONGO_SIZE=$(du -sh "${BACKUP_DIR}/mongodb" | cut -f1)
        echo -e "${GREEN}✓ MongoDB 备份完成 (${MONGO_SIZE})${NC}"
    else
        echo -e "${RED}✗ MongoDB 备份失败！备份目录为空${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ MongoDB 容器未运行，跳过${NC}"
fi

# 备份 PostgreSQL
echo ""
echo -e "${YELLOW}[3/7] 备份 PostgreSQL 数据库...${NC}"
if docker ps | grep -q lugang-ai-pg; then
    docker exec lugang-ai-pg pg_dumpall \
        -U "${PG_USER}" \
        > "${BACKUP_DIR}/postgresql/all_databases.sql"
    
    # 验证备份是否成功
    if [ -f "${BACKUP_DIR}/postgresql/all_databases.sql" ] && [ -s "${BACKUP_DIR}/postgresql/all_databases.sql" ]; then
        PG_SIZE=$(du -sh "${BACKUP_DIR}/postgresql" | cut -f1)
        echo -e "${GREEN}✓ PostgreSQL 备份完成 (${PG_SIZE})${NC}"
    else
        echo -e "${RED}✗ PostgreSQL 备份失败！备份文件为空${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ PostgreSQL 容器未运行，跳过${NC}"
fi

# 备份 Redis
echo ""
echo -e "${YELLOW}[4/7] 备份 Redis 数据...${NC}"
if docker ps | grep -q lugang-ai-redis; then
    # 触发 RDB 保存
    docker exec lugang-ai-redis redis-cli BGSAVE
    sleep 3
    
    # 复制 RDB 文件
    docker cp lugang-ai-redis:/data/dump.rdb "${BACKUP_DIR}/redis/" 2>/dev/null || echo "无 RDB 文件"
    echo -e "${GREEN}✓ Redis 备份完成${NC}"
else
    echo -e "${RED}✗ Redis 容器未运行，跳过${NC}"
fi

# 备份配置文件
echo ""
echo -e "${YELLOW}[5/7] 备份配置文件...${NC}"
if [ -d "${PROJECT_DIR}" ]; then
    # 备份环境配置
    cp -r "${PROJECT_DIR}/projects/app/.env"* "${BACKUP_DIR}/configs/" 2>/dev/null || true
    cp -r "${PROJECT_DIR}/docker-compose"*.yml "${BACKUP_DIR}/configs/" 2>/dev/null || true
    cp -r "${PROJECT_DIR}/projects/app/data" "${BACKUP_DIR}/configs/" 2>/dev/null || true
    
    echo -e "${GREEN}✓ 配置文件备份完成${NC}"
else
    echo -e "${RED}✗ 项目目录不存在${NC}"
fi

# 备份 Docker 卷数据
echo ""
echo -e "${YELLOW}[6/7] 备份 Docker 卷数据...${NC}"
if [ -d "${PROJECT_DIR}/data" ]; then
    cp -r "${PROJECT_DIR}/data" "${BACKUP_DIR}/volumes/"
    VOLUMES_SIZE=$(du -sh "${BACKUP_DIR}/volumes" | cut -f1)
    echo -e "${GREEN}✓ Docker 卷备份完成 (${VOLUMES_SIZE})${NC}"
else
    echo -e "${YELLOW}⚠ 未找到 data 目录${NC}"
fi

# 保存 Docker 状态信息
echo ""
echo -e "${YELLOW}[7/7] 保存 Docker 状态信息...${NC}"
docker ps -a > "${BACKUP_DIR}/docker/containers.txt"
docker images > "${BACKUP_DIR}/docker/images.txt"
docker volume ls > "${BACKUP_DIR}/docker/volumes.txt"
docker network ls > "${BACKUP_DIR}/docker/networks.txt"

# 保存当前镜像 ID
docker images --format "{{.Repository}}:{{.Tag}} {{.ID}}" | grep -E "lugang|fastgpt" > "${BACKUP_DIR}/docker/lugang-images.txt" 2>/dev/null || true

echo -e "${GREEN}✓ Docker 状态信息已保存${NC}"

# 创建备份清单
echo ""
echo -e "${BLUE}创建备份清单...${NC}"
cat > "${BACKUP_DIR}/BACKUP_INFO.txt" << EOF
===== 鲁港通备份信息 =====
备份时间: ${TIMESTAMP}
备份目录: ${BACKUP_DIR}
服务器: $(hostname)
IP: $(hostname -I | awk '{print $1}')

===== 备份内容 =====
- MongoDB 数据库
- PostgreSQL 数据库
- Redis 数据
- 配置文件
- Docker 卷数据
- Docker 状态信息

===== 恢复命令 =====
# 恢复 MongoDB
docker exec -i lugang-ai-mongo mongorestore --username=root --password=password --authenticationDatabase=admin /dump

# 恢复 PostgreSQL
cat ${BACKUP_DIR}/postgresql/all_databases.sql | docker exec -i lugang-ai-pg psql -U postgres

# 恢复配置文件
cp -r ${BACKUP_DIR}/configs/* ${PROJECT_DIR}/

===== 备份大小 =====
$(du -sh ${BACKUP_DIR}/*)

总大小: $(du -sh ${BACKUP_DIR} | cut -f1)
EOF

# 显示备份摘要
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  备份完成!                            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}备份位置: ${BACKUP_DIR}${NC}"
echo ""
echo "备份内容:"
du -sh "${BACKUP_DIR}"/*
echo ""
echo -e "总大小: ${YELLOW}$(du -sh ${BACKUP_DIR} | cut -f1)${NC}"
echo ""
echo -e "${GREEN}备份信息已保存到: ${BACKUP_DIR}/BACKUP_INFO.txt${NC}"
echo ""
echo -e "${YELLOW}下一步: 运行 02-check-unused-resources.sh 检查无用资源${NC}"
