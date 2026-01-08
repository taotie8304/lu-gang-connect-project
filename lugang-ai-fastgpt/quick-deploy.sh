#!/bin/bash

# ========================================
# 鲁港通AI - 快速部署脚本
# 适用于服务器上已有代码的情况
# ========================================

set -e

echo "=========================================="
echo "  鲁港通AI - 快速部署"
echo "=========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 错误: 请在 lugang-ai-fastgpt 目录下运行此脚本"
    exit 1
fi

# 1. 生成随机密码
echo "步骤1: 生成安全密码..."
MONGO_PASSWORD=$(openssl rand -hex 16)
PG_PASSWORD=$(openssl rand -hex 16)
TOKEN_KEY=$(openssl rand -hex 32)
FILE_TOKEN_KEY=$(openssl rand -hex 32)
AES256_SECRET_KEY=$(openssl rand -hex 32)
ROOT_KEY=$(openssl rand -hex 32)
ROOT_PSW=$(openssl rand -hex 16)

echo "✓ 密码已生成"
echo ""

# 2. 保存密码到文件
PASSWORDS_FILE="deployment-passwords.txt"
cat > $PASSWORDS_FILE << EOF
========================================
鲁港通AI - 部署密码
生成时间: $(date)
========================================

MongoDB密码: $MONGO_PASSWORD
PostgreSQL密码: $PG_PASSWORD
管理员密码: $ROOT_PSW

TOKEN_KEY: $TOKEN_KEY
FILE_TOKEN_KEY: $FILE_TOKEN_KEY
AES256_SECRET_KEY: $AES256_SECRET_KEY
ROOT_KEY: $ROOT_KEY

========================================
重要提示:
1. 请妥善保管此文件
2. 管理员账号: root
3. 管理员密码: $ROOT_PSW
4. 访问地址: http://156.225.30.134:3210
========================================
EOF

echo "✓ 密码已保存到: $PASSWORDS_FILE"
echo ""

# 3. 检查环境变量文件
echo "步骤2: 配置环境变量..."

if [ ! -f "projects/app/.env.local" ]; then
    echo "❌ 错误: 环境变量文件不存在"
    echo ""
    echo "请先创建 projects/app/.env.local 文件"
    echo "您可以："
    echo "1. 复制模板: cp projects/app/.env.local.example projects/app/.env.local"
    echo "2. 或使用宝塔面板文件管理器创建"
    echo ""
    exit 1
fi

# 4. 更新docker-compose.yml中的密码
echo "步骤3: 更新Docker配置..."

# 备份原文件
cp docker-compose.yml docker-compose.yml.backup

# 更新MongoDB密码
sed -i "s/MONGO_INITDB_ROOT_PASSWORD=.*/MONGO_INITDB_ROOT_PASSWORD=$MONGO_PASSWORD/" docker-compose.yml

# 更新PostgreSQL密码
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$PG_PASSWORD/" docker-compose.yml

echo "✓ Docker配置已更新"
echo ""

# 5. 提示用户更新.env.local
echo "=========================================="
echo "  ⚠️  重要：需要手动配置"
echo "=========================================="
echo ""
echo "请编辑文件: projects/app/.env.local"
echo ""
echo "需要修改以下配置："
echo ""
echo "1. MongoDB连接:"
echo "   MONGODB_URI=mongodb://username:$MONGO_PASSWORD@mongo:27017/fastgpt?authSource=admin"
echo ""
echo "2. PostgreSQL连接:"
echo "   PG_URL=postgresql://username:$PG_PASSWORD@pg:5432/postgres"
echo ""
echo "3. 应用密钥:"
echo "   TOKEN_KEY=$TOKEN_KEY"
echo "   FILE_TOKEN_KEY=$FILE_TOKEN_KEY"
echo "   AES256_SECRET_KEY=$AES256_SECRET_KEY"
echo "   ROOT_KEY=$ROOT_KEY"
echo ""
echo "4. One API配置:"
echo "   CHAT_API_KEY=sk-从OneAPI后台获取"
echo "   AIPROXY_API_TOKEN=sk-从OneAPI后台获取"
echo ""
echo "5. 管理员密码:"
echo "   DEFAULT_ROOT_PSW=$ROOT_PSW"
echo ""
echo "=========================================="
echo ""
read -p "配置完成后按Enter继续部署..."

# 6. 停止现有服务
echo ""
echo "步骤4: 停止现有服务..."
docker-compose down 2>/dev/null || echo "  没有运行中的服务"
echo "✓ 服务已停止"
echo ""

# 7. 构建镜像
echo "步骤5: 构建Docker镜像..."
echo "  这需要15-30分钟，请耐心等待..."
echo ""

docker build --no-cache -t lugang-ai:v1 -f projects/app/Dockerfile .

echo ""
echo "✓ 镜像构建完成"
echo ""

# 8. 启动服务
echo "步骤6: 启动服务..."
docker-compose up -d

echo "✓ 服务已启动"
echo ""

# 9. 等待服务就绪
echo "步骤7: 等待服务就绪（约30秒）..."
sleep 30

# 10. 显示服务状态
echo ""
echo "步骤8: 检查服务状态..."
docker-compose ps

echo ""
echo "=========================================="
echo "  🎉 部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://156.225.30.134:3210"
echo "管理员账号: root"
echo "管理员密码: $ROOT_PSW"
echo ""
echo "密码文件: $PASSWORDS_FILE"
echo ""
echo "常用命令:"
echo "  查看日志: docker-compose logs -f lugang-ai"
echo "  重启服务: docker-compose restart"
echo "  停止服务: docker-compose down"
echo ""
echo "=========================================="
