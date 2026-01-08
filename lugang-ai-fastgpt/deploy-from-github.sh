#!/bin/bash

# ========================================
# 鲁港通AI - GitHub自动部署脚本
# ========================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
GITHUB_REPO="https://github.com/taotie8304/lu-gang-connect-project.git"
DEPLOY_DIR="/www/wwwroot"
PROJECT_NAME="lu-gang-connect-project"
FASTGPT_DIR="lugang-ai-fastgpt"

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安装，请先安装"
        exit 1
    fi
}

# 步骤1: 检查环境
print_info "步骤1: 检查部署环境..."
check_command docker
check_command docker-compose
check_command git
print_info "✓ 环境检查通过"

# 步骤2: 备份旧部署
if [ -d "$DEPLOY_DIR/$PROJECT_NAME/$FASTGPT_DIR" ]; then
    print_warn "检测到旧部署，正在备份..."
    cd $DEPLOY_DIR/$PROJECT_NAME/$FASTGPT_DIR
    
    # 停止服务
    docker-compose down
    
    # 备份数据
    if [ -d "data" ]; then
        BACKUP_NAME="data.backup.$(date +%Y%m%d_%H%M%S)"
        mv data ../$BACKUP_NAME
        print_info "✓ 数据已备份到 $BACKUP_NAME"
    fi
    
    # 备份环境变量
    if [ -f "projects/app/.env.local" ]; then
        cp projects/app/.env.local /tmp/.env.local.backup
        print_info "✓ 环境变量已备份到 /tmp/.env.local.backup"
    fi
fi

# 步骤3: 清理旧代码
print_info "步骤3: 清理旧代码..."
cd $DEPLOY_DIR
if [ -d "$PROJECT_NAME" ]; then
    rm -rf $PROJECT_NAME
    print_info "✓ 旧代码已清理"
fi

# 步骤4: 克隆GitHub仓库
print_info "步骤4: 从GitHub克隆项目..."
git clone $GITHUB_REPO
cd $PROJECT_NAME/$FASTGPT_DIR
print_info "✓ 代码克隆完成"

# 步骤5: 恢复环境变量
print_info "步骤5: 配置环境变量..."
if [ -f "/tmp/.env.local.backup" ]; then
    cp /tmp/.env.local.backup projects/app/.env.local
    print_info "✓ 环境变量已恢复"
else
    print_warn "未找到备份的环境变量，请手动配置"
    print_warn "请编辑: projects/app/.env.local"
    read -p "按Enter继续..."
fi

# 步骤6: 检查端口占用
print_info "步骤6: 检查端口占用..."
PORTS=(27017 5432 6380 3210)
for PORT in "${PORTS[@]}"; do
    if netstat -tulpn | grep -q ":$PORT "; then
        print_warn "端口 $PORT 已被占用"
        print_warn "请修改 docker-compose.yml 中的端口映射"
    fi
done

# 步骤7: 构建Docker镜像
print_info "步骤7: 构建Docker镜像（需要15-30分钟）..."
docker build --no-cache -t lugang-ai:v1 -f projects/app/Dockerfile .
print_info "✓ 镜像构建完成"

# 步骤8: 启动服务
print_info "步骤8: 启动服务..."
docker-compose up -d
print_info "✓ 服务已启动"

# 步骤9: 等待服务就绪
print_info "步骤9: 等待服务就绪..."
sleep 10

# 步骤10: 健康检查
print_info "步骤10: 健康检查..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f http://localhost:3210/api/health > /dev/null 2>&1; then
        print_info "✓ 服务健康检查通过"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "服务启动超时，请检查日志"
    docker-compose logs --tail=50 lugang-ai
    exit 1
fi

# 步骤11: 显示服务状态
print_info "步骤11: 服务状态..."
docker-compose ps

# 完成
echo ""
echo "========================================"
print_info "🎉 部署完成！"
echo "========================================"
echo ""
echo "访问地址: http://156.225.30.134:3210"
echo "默认用户: root"
echo "默认密码: 查看 projects/app/.env.local 中的 DEFAULT_ROOT_PSW"
echo ""
echo "常用命令:"
echo "  查看日志: docker-compose logs -f lugang-ai"
echo "  重启服务: docker-compose restart"
echo "  停止服务: docker-compose stop"
echo "  启动服务: docker-compose start"
echo ""
print_warn "首次登录后请立即修改默认密码！"
echo ""
