#!/bin/bash

# ===== 鲁港通 - 回滚脚本 =====
# 回滚到上一个版本或从备份恢复
# 
# 使用方法: 
#   chmod +x 07-rollback.sh
#   ./07-rollback.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
BACKUP_ROOT="/www/wwwroot/backups"
PROJECT_DIR="/www/wwwroot/lugang-ai"
MONGO_USER="root"
MONGO_PASSWORD="LuGang2024Secure"
PG_USER="postgres"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        鲁港通 - 回滚脚本 v1.0                         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# 显示回滚选项
echo -e "${BLUE}=== 回滚选项 ===${NC}"
echo ""
echo "1. 回滚 Docker 镜像（仅回滚应用，保留数据）"
echo "2. 从备份恢复数据库（恢复 MongoDB + PostgreSQL）"
echo "3. 完整回滚（镜像 + 数据库）"
echo "4. 查看可用备份"
echo "5. 退出"
echo ""
read -p "请选择 (1-5): " CHOICE

case $CHOICE in
    1)
        # 回滚 Docker 镜像
        echo ""
        echo -e "${YELLOW}=== 回滚 Docker 镜像 ===${NC}"
        
        # 显示所有可用的 lugang 相关镜像
        echo "可用的镜像:"
        docker images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}" | grep -E "lugang|REPOSITORY" || echo "无"
        echo ""
        
        # 检查回滚信息
        if [ -f /tmp/lugang-rollback-image.txt ]; then
            echo "找到回滚信息文件:"
            cat /tmp/lugang-rollback-image.txt
            echo ""
            
            # 优先使用备份标签（第三行）
            BACKUP_TAG=$(sed -n '3p' /tmp/lugang-rollback-image.txt 2>/dev/null || echo "")
            ORIGINAL_IMAGE=$(head -1 /tmp/lugang-rollback-image.txt 2>/dev/null || echo "")
            
            if [ -n "$BACKUP_TAG" ] && docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${BACKUP_TAG}$"; then
                ROLLBACK_IMAGE="$BACKUP_TAG"
                echo -e "${GREEN}使用备份标签: ${ROLLBACK_IMAGE}${NC}"
            elif [ -n "$ORIGINAL_IMAGE" ]; then
                ROLLBACK_IMAGE="$ORIGINAL_IMAGE"
                echo -e "${YELLOW}使用原始镜像: ${ROLLBACK_IMAGE}${NC}"
            fi
        fi
        
        if [ -z "$ROLLBACK_IMAGE" ]; then
            echo "未找到自动回滚信息"
            read -p "请输入要回滚的镜像名称: " ROLLBACK_IMAGE
        fi
        
        if [ -z "$ROLLBACK_IMAGE" ]; then
            echo -e "${RED}未指定镜像，退出${NC}"
            exit 1
        fi
        
        # 检查镜像是否存在
        if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${ROLLBACK_IMAGE}$"; then
            echo -e "${RED}镜像不存在: ${ROLLBACK_IMAGE}${NC}"
            
            # 检查是否有备份文件
            echo ""
            echo "检查备份文件..."
            LATEST_BACKUP=$(ls -td ${BACKUP_ROOT}/lugang-final-* 2>/dev/null | head -1)
            if [ -n "$LATEST_BACKUP" ] && [ -f "${LATEST_BACKUP}/docker-images/lugang-ai-app.tar.gz" ]; then
                echo "找到备份镜像文件: ${LATEST_BACKUP}/docker-images/lugang-ai-app.tar.gz"
                read -p "是否从备份文件恢复镜像? (y/n): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    echo "加载镜像..."
                    LOADED=$(gunzip -c "${LATEST_BACKUP}/docker-images/lugang-ai-app.tar.gz" | docker load)
                    echo "$LOADED"
                    ROLLBACK_IMAGE=$(echo "$LOADED" | grep "Loaded image" | awk '{print $NF}')
                    if [ -z "$ROLLBACK_IMAGE" ] && [ -f "${LATEST_BACKUP}/docker-images/image-info.txt" ]; then
                        ROLLBACK_IMAGE=$(head -1 "${LATEST_BACKUP}/docker-images/image-info.txt")
                    fi
                fi
            else
                echo -e "${RED}未找到备份镜像文件${NC}"
                exit 1
            fi
        fi
        
        echo ""
        echo -e "${CYAN}将回滚到: ${ROLLBACK_IMAGE}${NC}"
        read -p "确认回滚? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
        
        echo "停止当前容器..."
        docker stop lugang-ai-app 2>/dev/null || true
        docker rm lugang-ai-app 2>/dev/null || true
        
        echo "启动回滚容器..."
        docker run -d \
            --name lugang-ai-app \
            --restart always \
            -p 3210:3000 \
            --env-file "${PROJECT_DIR}/projects/app/.env.local" \
            --network lugang-ai-network \
            "${ROLLBACK_IMAGE}"
        
        # 等待启动
        echo "等待服务启动..."
        for i in {1..30}; do
            if curl -s -f http://localhost:3210/api/health > /dev/null 2>&1; then
                echo -e "${GREEN}✓ 服务启动成功!${NC}"
                break
            fi
            if [ $i -eq 30 ]; then
                echo -e "${RED}✗ 服务启动超时，请检查日志${NC}"
                docker logs lugang-ai-app --tail 50
            fi
            echo "  等待中... ($i/30)"
            sleep 2
        done
        
        echo ""
        echo -e "${GREEN}✓ 镜像回滚完成${NC}"
        ;;
        
    2)
        # 从备份恢复数据库
        echo ""
        echo -e "${YELLOW}=== 从备份恢复数据库 ===${NC}"
        
        # 列出可用备份
        echo "可用备份:"
        ls -la "${BACKUP_ROOT}" | grep -E "lugang-(backup|final)" || echo "无备份"
        echo ""
        read -p "请输入备份目录名称: " BACKUP_NAME
        
        BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"
        if [ ! -d "$BACKUP_DIR" ]; then
            echo -e "${RED}备份目录不存在: ${BACKUP_DIR}${NC}"
            exit 1
        fi
        
        echo ""
        echo -e "${RED}⚠️  警告: 这将覆盖当前数据库数据！${NC}"
        read -p "确认恢复? (输入 'RESTORE' 确认): " CONFIRM
        if [[ "$CONFIRM" != "RESTORE" ]]; then
            exit 0
        fi
        
        # 恢复 MongoDB
        if [ -d "${BACKUP_DIR}/mongodb/dump" ]; then
            echo "恢复 MongoDB..."
            docker cp "${BACKUP_DIR}/mongodb/dump" lugang-ai-mongo:/
            docker exec lugang-ai-mongo mongorestore \
                --username="${MONGO_USER}" \
                --password="${MONGO_PASSWORD}" \
                --authenticationDatabase=admin \
                --drop \
                /dump
            docker exec lugang-ai-mongo rm -rf /dump
            echo -e "${GREEN}✓ MongoDB 恢复完成${NC}"
        else
            echo -e "${YELLOW}⚠ 未找到 MongoDB 备份${NC}"
        fi
        
        # 恢复 PostgreSQL
        if [ -f "${BACKUP_DIR}/postgresql/all_databases.sql" ]; then
            echo "恢复 PostgreSQL..."
            cat "${BACKUP_DIR}/postgresql/all_databases.sql" | docker exec -i lugang-ai-pg psql -U "${PG_USER}"
            echo -e "${GREEN}✓ PostgreSQL 恢复完成${NC}"
        else
            echo -e "${YELLOW}⚠ 未找到 PostgreSQL 备份${NC}"
        fi
        
        echo ""
        echo -e "${GREEN}✓ 数据库恢复完成${NC}"
        echo "建议重启应用: docker restart lugang-ai-app"
        ;;
        
    3)
        # 完整回滚
        echo ""
        echo -e "${YELLOW}=== 完整回滚 ===${NC}"
        
        # 列出可用备份
        echo "可用备份:"
        ls -la "${BACKUP_ROOT}" | grep -E "lugang-(backup|final)" || echo "无备份"
        echo ""
        read -p "请输入备份目录名称: " BACKUP_NAME
        
        BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"
        if [ ! -d "$BACKUP_DIR" ]; then
            echo -e "${RED}备份目录不存在: ${BACKUP_DIR}${NC}"
            exit 1
        fi
        
        echo ""
        echo -e "${RED}⚠️  警告: 这将完全回滚到备份状态！${NC}"
        read -p "确认完整回滚? (输入 'FULL-RESTORE' 确认): " CONFIRM
        if [[ "$CONFIRM" != "FULL-RESTORE" ]]; then
            exit 0
        fi
        
        # 如果有恢复脚本，使用它
        if [ -f "${BACKUP_DIR}/restore.sh" ]; then
            echo "使用备份恢复脚本..."
            bash "${BACKUP_DIR}/restore.sh"
        else
            # 手动恢复
            # 恢复 MongoDB
            if [ -d "${BACKUP_DIR}/mongodb/dump" ]; then
                echo "恢复 MongoDB..."
                docker cp "${BACKUP_DIR}/mongodb/dump" lugang-ai-mongo:/
                docker exec lugang-ai-mongo mongorestore \
                    --username="${MONGO_USER}" \
                    --password="${MONGO_PASSWORD}" \
                    --authenticationDatabase=admin \
                    --drop \
                    /dump
                docker exec lugang-ai-mongo rm -rf /dump
            fi
            
            # 恢复 PostgreSQL
            if [ -f "${BACKUP_DIR}/postgresql/all_databases.sql" ]; then
                echo "恢复 PostgreSQL..."
                cat "${BACKUP_DIR}/postgresql/all_databases.sql" | docker exec -i lugang-ai-pg psql -U "${PG_USER}"
            fi
            
            # 恢复镜像
            if [ -f "${BACKUP_DIR}/docker-images/lugang-ai-app.tar.gz" ]; then
                echo "恢复 Docker 镜像..."
                gunzip -c "${BACKUP_DIR}/docker-images/lugang-ai-app.tar.gz" | docker load
                
                # 获取镜像名称并重启
                RESTORED_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep lugang-ai | head -1)
                if [ -n "$RESTORED_IMAGE" ]; then
                    docker stop lugang-ai-app 2>/dev/null || true
                    docker rm lugang-ai-app 2>/dev/null || true
                    docker run -d \
                        --name lugang-ai-app \
                        --restart always \
                        -p 3210:3000 \
                        --env-file "${PROJECT_DIR}/projects/app/.env.local" \
                        --network lugang-ai-network \
                        "${RESTORED_IMAGE}"
                fi
            fi
        fi
        
        echo ""
        echo -e "${GREEN}✓ 完整回滚完成${NC}"
        ;;
        
    4)
        # 查看可用备份
        echo ""
        echo -e "${BLUE}=== 可用备份 ===${NC}"
        echo ""
        
        if [ -d "$BACKUP_ROOT" ]; then
            for backup in "${BACKUP_ROOT}"/lugang-*; do
                if [ -d "$backup" ]; then
                    echo -e "${CYAN}$(basename $backup)${NC}"
                    if [ -f "${backup}/BACKUP_INFO.txt" ]; then
                        head -10 "${backup}/BACKUP_INFO.txt" | sed 's/^/  /'
                    fi
                    echo "  大小: $(du -sh $backup | cut -f1)"
                    echo ""
                fi
            done
        else
            echo "备份目录不存在: ${BACKUP_ROOT}"
        fi
        ;;
        
    5)
        echo "退出"
        exit 0
        ;;
        
    *)
        echo -e "${RED}无效选择${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${YELLOW}验证服务状态:${NC}"
echo "  ./04-verify-services.sh"
