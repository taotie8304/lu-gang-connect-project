#!/bin/bash

# =====================================================
# 鲁港通AI - 服务器清理脚本
# 用于清理旧的LobeChat容器和相关文件
# =====================================================

set -e

echo "========================================="
echo "  鲁港通AI - 服务器清理工具"
echo "========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 1. 显示当前运行的容器
echo -e "${CYAN}=== 当前运行的Docker容器 ===${NC}"
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
echo ""

# 2. 显示当前的Docker镜像
echo -e "${CYAN}=== 当前的Docker镜像 ===${NC}"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""

# 3. 确认清理
echo -e "${YELLOW}即将清理以下内容：${NC}"
echo "  - 所有包含 'lobe' 或 'lugang-chat' 的容器"
echo "  - 所有包含 'lobe' 或 'lugang-chat' 的镜像"
echo "  - /www/wwwroot/lugang-connect-enterprise/chatgpt-web/ 目录下的旧配置"
echo ""
read -p "确认清理？(y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "取消清理"
    exit 0
fi

echo ""
echo -e "${CYAN}=== 开始清理 ===${NC}"
echo ""

# 4. 停止并删除LobeChat相关容器
echo -e "${YELLOW}1. 停止并删除LobeChat相关容器...${NC}"
docker ps -a --format "{{.Names}}" | grep -E "(lobe|lugang-chat)" | while read container; do
    echo "   停止并删除容器: $container"
    docker stop "$container" 2>/dev/null || true
    docker rm "$container" 2>/dev/null || true
done
echo -e "${GREEN}   完成${NC}"
echo ""

# 5. 删除LobeChat相关镜像
echo -e "${YELLOW}2. 删除LobeChat相关镜像...${NC}"
docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "(lobe|lugang-chat)" | while read image; do
    echo "   删除镜像: $image"
    docker rmi "$image" 2>/dev/null || true
done
echo -e "${GREEN}   完成${NC}"
echo ""

# 6. 清理旧的部署目录
echo -e "${YELLOW}3. 清理旧的部署配置...${NC}"
CHATGPT_WEB_DIR="/www/wwwroot/lugang-connect-enterprise/chatgpt-web"
if [ -d "$CHATGPT_WEB_DIR" ]; then
    echo "   备份旧配置到 ${CHATGPT_WEB_DIR}.bak"
    mv "$CHATGPT_WEB_DIR" "${CHATGPT_WEB_DIR}.bak.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
    mkdir -p "$CHATGPT_WEB_DIR"
fi
echo -e "${GREEN}   完成${NC}"
echo ""

# 7. 清理Docker系统
echo -e "${YELLOW}4. 清理Docker系统缓存...${NC}"
docker system prune -f
echo -e "${GREEN}   完成${NC}"
echo ""

# 8. 显示清理后的状态
echo -e "${CYAN}=== 清理后的状态 ===${NC}"
echo ""
echo "Docker容器:"
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
echo ""
echo "Docker镜像:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""

# 9. 显示磁盘空间
echo -e "${CYAN}=== 磁盘空间 ===${NC}"
df -h /
echo ""

echo "========================================="
echo -e "${GREEN}  ✅ 清理完成！${NC}"
echo "========================================="
echo ""
echo "下一步操作："
echo "1. 将 lugang-ai-fastgpt 目录上传到服务器"
echo "2. 运行 ./build.sh 构建镜像"
echo "3. 运行 ./deploy.sh start 启动服务"
echo ""
