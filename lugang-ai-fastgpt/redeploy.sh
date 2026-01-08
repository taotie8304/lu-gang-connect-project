#!/bin/bash

# 鲁港通AI - 重新部署脚本
# 用于禁用可选服务后重新启动

echo "=========================================="
echo "鲁港通AI - 重新部署"
echo "=========================================="

# 停止所有容器
echo "1. 停止所有容器..."
docker-compose down

# 清理已停止的容器
echo "2. 清理已停止的容器..."
docker container prune -f

# 启动核心服务
echo "3. 启动核心服务（MongoDB、PostgreSQL、Redis、鲁港通AI）..."
docker-compose up -d

# 等待服务启动
echo "4. 等待服务启动（30秒）..."
sleep 30

# 查看容器状态
echo "5. 查看容器状态..."
docker-compose ps

# 查看应用日志
echo "6. 查看应用日志（最后20行）..."
docker logs lugang-ai-app --tail 20

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo "访问地址: http://156.225.30.134:3210"
echo "默认账户: root"
echo "默认密码: LuGang@2025"
echo ""
echo "查看完整日志: docker logs lugang-ai-app -f"
echo "=========================================="
