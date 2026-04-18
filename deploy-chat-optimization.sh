#!/bin/bash

# 鲁港通 - 聊天显示优化功能部署脚本
# 功能：备份 -> 清理 -> 部署
# 日期：$(date +%Y-%m-%d)

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}鲁港通 - 聊天显示优化功能部署${NC}"
echo -e "${GREEN}========================================${NC}"

# 设置变量
BACKUP_DIR="/www/backup/$(date +%Y%m%d_%H%M%S)"
PROJECT_DIR="/www/wwwroot/lugang-ai"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

# ============================================
# 第一步：创建备份目录
# ============================================
echo -e "\n${YELLOW}[1/6] 创建备份目录...${NC}"
mkdir -p "$BACKUP_DIR"
echo "备份目录: $BACKUP_DIR"

# ============================================
# 第二步：备份所有容器数据
# ============================================
echo -e "\n${YELLOW}[2/6] 备份容器数据...${NC}"

cd "$PROJECT_DIR"

# 备份 MongoDB 数据库
echo "备份 MongoDB 数据库..."
docker exec lugang-ai-mongo-1 mongodump --out /tmp/mongodb_backup
docker cp lugang-ai-mongo-1:/tmp/mongodb_backup "$BACKUP_DIR/mongodb_backup"
echo -e "${GREEN}✓ MongoDB 备份完成${NC}"

# 备份 PostgreSQL 数据库
echo "备份 PostgreSQL 数据库..."
docker exec lugang-ai-pg-1 pg_dumpall -U username > "$BACKUP_DIR/postgresql_backup.sql"
echo -e "${GREEN}✓ PostgreSQL 备份完成${NC}"

# 备份 MySQL 数据库（后端）
echo "备份 MySQL 数据库..."
docker exec lugang-connect-mysql mysqldump -u root -p'123456' --all-databases > "$BACKUP_DIR/mysql_backup.sql"
echo -e "${GREEN}✓ MySQL 备份完成${NC}"

# 备份 Redis 数据
echo "备份 Redis 数据..."
docker exec lugang-ai-redis-1 redis-cli SAVE
docker cp lugang-ai-redis-1:/data/dump.rdb "$BACKUP_DIR/redis_dump.rdb"
echo -e "${GREEN}✓ Redis 备份完成${NC}"

# 备份 docker-compose.yml 和 .env 文件
echo "备份配置文件..."
cp "$COMPOSE_FILE" "$BACKUP_DIR/docker-compose.yml"
cp "$PROJECT_DIR/.env" "$BACKUP_DIR/.env" 2>/dev/null || echo "未找到 .env 文件"
echo -e "${GREEN}✓ 配置文件备份完成${NC}"

# 备份容器列表
echo "备份容器列表..."
docker ps -a > "$BACKUP_DIR/containers_list.txt"
docker images > "$BACKUP_DIR/images_list.txt"
echo -e "${GREEN}✓ 容器列表备份完成${NC}"

echo -e "${GREEN}所有数据已备份到: $BACKUP_DIR${NC}"

# ============================================
# 第三步：清理旧的备份（保留最近7天）
# ============================================
echo -e "\n${YELLOW}[3/6] 清理旧备份（保留最近7天）...${NC}"
find /www/backup -type d -name "20*" -mtime +7 -exec rm -rf {} + 2>/dev/null || true
echo -e "${GREEN}✓ 旧备份清理完成${NC}"

# ============================================
# 第四步：清理无用的容器和镜像
# ============================================
echo -e "\n${YELLOW}[4/6] 清理无用的容器和镜像...${NC}"

# 停止所有容器（但不删除）
echo "停止所有容器..."
cd "$PROJECT_DIR"
docker-compose down

# 清理停止的容器
echo "清理停止的容器..."
docker container prune -f

# 清理悬空镜像（dangling images）
echo "清理悬空镜像..."
docker image prune -f

# 清理未使用的镜像（可选，谨慎使用）
# docker image prune -a -f --filter "until=168h"  # 清理7天前的未使用镜像

echo -e "${GREEN}✓ 清理完成${NC}"

# ============================================
# 第五步：拉取最新镜像
# ============================================
echo -e "\n${YELLOW}[5/6] 拉取最新镜像...${NC}"

cd "$PROJECT_DIR"

# 拉取前端镜像
echo "拉取前端镜像 ghcr.io/taotie8304/lugang-ai:latest ..."
docker pull ghcr.io/taotie8304/lugang-ai:latest
echo -e "${GREEN}✓ 前端镜像拉取完成${NC}"

# 拉取后端镜像
echo "拉取后端镜像 ghcr.io/taotie8304/lugang-enterprise:latest ..."
docker pull ghcr.io/taotie8304/lugang-enterprise:latest
echo -e "${GREEN}✓ 后端镜像拉取完成${NC}"

# ============================================
# 第六步：启动新容器
# ============================================
echo -e "\n${YELLOW}[6/6] 启动新容器...${NC}"

cd "$PROJECT_DIR"

# 启动所有服务
echo "启动前端服务..."
docker-compose up -d

# 等待服务启动
echo "等待服务启动（30秒）..."
sleep 30

# 检查容器状态
echo -e "\n${YELLOW}检查容器状态...${NC}"
docker-compose ps

# 检查前端日志
echo -e "\n${YELLOW}前端服务日志（最后20行）:${NC}"
docker-compose logs --tail=20 lugang-ai

# 启动后端服务（如果需要）
echo -e "\n${YELLOW}检查后端服务...${NC}"
if docker ps | grep -q lugang-connect; then
    echo -e "${GREEN}✓ 后端服务正在运行${NC}"
else
    echo -e "${YELLOW}后端服务未运行，尝试启动...${NC}"
    # 这里需要根据实际的后端启动命令调整
    # docker run -d --name lugang-connect ...
fi

# ============================================
# 完成
# ============================================
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n备份位置: ${GREEN}$BACKUP_DIR${NC}"
echo -e "\n${YELLOW}请访问以下地址验证功能:${NC}"
echo -e "前端: ${GREEN}https://www.airscend.com${NC}"
echo -e "后端: ${GREEN}https://api.airscend.com${NC}"
echo -e "\n${YELLOW}验证清单:${NC}"
echo "  □ AI 回复中不显示图片"
echo "  □ 思考模式有灰色背景"
echo "  □ 普通用户看不到引用标记"
echo "  □ 表格渲染正确（无 <br> 标签）"
echo "  □ 移动端显示正常"
echo -e "\n${YELLOW}如需回滚，请运行:${NC}"
echo -e "  cd $PROJECT_DIR"
echo -e "  docker-compose down"
echo -e "  # 恢复备份的配置文件"
echo -e "  cp $BACKUP_DIR/docker-compose.yml ."
echo -e "  # 使用旧镜像标签重新部署"
echo -e "  docker-compose up -d"

