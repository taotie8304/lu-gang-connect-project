#!/bin/bash

# ========================================
# 鲁港通AI - 一键部署脚本
# 使用方法: bash one-click-deploy.sh
# ========================================

set -e

echo "=========================================="
echo "  鲁港通AI - 一键部署脚本"
echo "=========================================="
echo ""

# 1. 生成密码
echo "步骤1: 生成随机密码..."
MONGO_PWD=$(openssl rand -hex 16)
PG_PWD=$(openssl rand -hex 16)
TOKEN_KEY=$(openssl rand -hex 16)
FILE_TOKEN_KEY=$(openssl rand -hex 16)
AES256_SECRET_KEY=$(openssl rand -hex 16)
ROOT_KEY=$(openssl rand -hex 16)

echo "✓ 密码生成完成"
echo ""

# 2. 显示密码
echo "=========================================="
echo "  生成的密码（请保存）"
echo "=========================================="
echo "MongoDB密码: $MONGO_PWD"
echo "PostgreSQL密码: $PG_PWD"
echo "TOKEN_KEY: $TOKEN_KEY"
echo "FILE_TOKEN_KEY: $FILE_TOKEN_KEY"
echo "AES256_SECRET_KEY: $AES256_SECRET_KEY"
echo "ROOT_KEY: $ROOT_KEY"
echo "管理员密码: LuGang@2025"
echo "=========================================="
echo ""

# 保存到文件
cat > passwords.txt << EOF
MongoDB密码: $MONGO_PWD
PostgreSQL密码: $PG_PWD
TOKEN_KEY: $TOKEN_KEY
FILE_TOKEN_KEY: $FILE_TOKEN_KEY
AES256_SECRET_KEY: $AES256_SECRET_KEY
ROOT_KEY: $ROOT_KEY
管理员密码: LuGang@2025
EOF

echo "✓ 密码已保存到 passwords.txt"
echo ""

# 3. 获取One API Token
echo "步骤2: 配置One API Token"
echo "请访问 http://156.225.30.134:8080 获取Token"
read -p "请输入One API Token (sk-xxxxx): " ONEAPI_TOKEN

if [ -z "$ONEAPI_TOKEN" ]; then
    echo "❌ 错误: One API Token不能为空"
    exit 1
fi

echo "✓ One API Token已配置"
echo ""

# 4. 创建.env.local
echo "步骤3: 创建环境变量文件..."
cat > projects/app/.env.local << EOF
# ===== 鲁港通AI系统配置 =====
LOG_DEPTH=3
LOG_LEVEL=info
STORE_LOG_LEVEL=warn

DEFAULT_ROOT_PSW=LuGang@2025

# 数据库配置
DB_MAX_LINK=10
MONGODB_URI=mongodb://root:${MONGO_PWD}@mongo:27017/lugang_ai?authSource=admin
MONGODB_LOG_URI=mongodb://root:${MONGO_PWD}@mongo:27017/lugang_ai?authSource=admin

PG_URL=postgresql://postgres:${PG_PWD}@pg:5432/postgres

REDIS_URL=redis://redis:6379

# 密钥配置
TOKEN_KEY=${TOKEN_KEY}
FILE_TOKEN_KEY=${FILE_TOKEN_KEY}
AES256_SECRET_KEY=${AES256_SECRET_KEY}
ROOT_KEY=${ROOT_KEY}

# One API集成配置
AIPROXY_API_ENDPOINT=http://156.225.30.134:8080
AIPROXY_API_TOKEN=${ONEAPI_TOKEN}

# 服务配置
PLUGIN_BASE_URL=
PLUGIN_TOKEN=

# 域名配置
FE_DOMAIN=http://156.225.30.134:3210
FILE_DOMAIN=http://156.225.30.134:3210

# 功能开关
HIDE_CHAT_COPYRIGHT_SETTING=true
USE_IP_LIMIT=false
SHOW_COUPON=false
SHOW_DISCOUNT_COUPON=false

# 安全配置
WORKFLOW_MAX_RUN_TIMES=500
WORKFLOW_MAX_LOOP_TIMES=50
SERVICE_REQUEST_MAX_CONTENT_LENGTH=10
CHECK_INTERNAL_IP=false

# 性能配置
EMBEDDING_CHUNK_SIZE=10
MULTIPLE_DATA_TO_BASE64=true
EOF

echo "✓ 环境变量文件已创建"
echo ""

# 5. 修改docker-compose.yml
echo "步骤4: 配置Docker Compose..."
sed -i "s/MONGO_INITDB_ROOT_PASSWORD: password/MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PWD}/" docker-compose.yml
sed -i "s/POSTGRES_PASSWORD: password/POSTGRES_PASSWORD: ${PG_PWD}/" docker-compose.yml

echo "✓ Docker Compose已配置"
echo ""

# 6. 构建镜像
echo "步骤5: 构建Docker镜像（需要15-30分钟）..."
docker build --no-cache -t lugang-ai:v1 -f projects/app/Dockerfile .

echo "✓ 镜像构建完成"
echo ""

# 7. 启动服务
echo "步骤6: 启动服务..."
docker-compose up -d

echo "✓ 服务已启动"
echo ""

# 8. 等待服务就绪
echo "步骤7: 等待服务就绪..."
sleep 15

# 9. 健康检查
echo "步骤8: 健康检查..."
for i in {1..30}; do
    if curl -s -f http://localhost:3210/api/health > /dev/null 2>&1; then
        echo "✓ 服务健康检查通过"
        break
    fi
    echo -n "."
    sleep 2
done

echo ""
echo ""

# 10. 显示结果
echo "=========================================="
echo "  🎉 部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://156.225.30.134:3210"
echo "用户名: root"
echo "密码: LuGang@2025"
echo ""
echo "密码文件: $(pwd)/passwords.txt"
echo ""
echo "常用命令:"
echo "  查看日志: docker-compose logs -f lugang-ai"
echo "  重启服务: docker-compose restart"
echo "  停止服务: docker-compose stop"
echo ""
echo "⚠️ 首次登录后请立即修改密码！"
echo "=========================================="
EOF
