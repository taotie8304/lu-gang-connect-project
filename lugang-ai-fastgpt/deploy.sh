#!/bin/bash

# 鲁港通AI - FastGPT定制版部署脚本
# 使用方法: ./deploy.sh [start|stop|restart|status|logs]

set -e

COMMAND=${1:-start}

echo "========================================="
echo "  鲁港通AI - FastGPT定制版部署工具"
echo "========================================="
echo ""

case $COMMAND in
    start)
        echo "🚀 启动鲁港通AI服务..."
        echo ""
        
        # 创建数据目录
        mkdir -p data/mongo data/pg data/redis data/minio
        
        # 启动服务
        docker-compose up -d
        
        echo ""
        echo "========================================="
        echo "  ✅ 服务启动成功！"
        echo "========================================="
        echo ""
        echo "服务访问地址: http://156.225.30.134:3210"
        echo "默认账户: root"
        echo "默认密码: LuGang@2025"
        echo ""
        echo "查看日志: ./deploy.sh logs"
        echo "查看状态: ./deploy.sh status"
        echo ""
        ;;
        
    stop)
        echo "🛑 停止鲁港通AI服务..."
        docker-compose down
        echo "✅ 服务已停止"
        ;;
        
    restart)
        echo "🔄 重启鲁港通AI服务..."
        docker-compose restart
        echo "✅ 服务已重启"
        ;;
        
    status)
        echo "📊 鲁港通AI服务状态："
        echo ""
        docker-compose ps
        ;;
        
    logs)
        echo "📋 查看鲁港通AI日志（按Ctrl+C退出）："
        echo ""
        docker-compose logs -f lugang-ai
        ;;
        
    *)
        echo "用法: ./deploy.sh [start|stop|restart|status|logs]"
        echo ""
        echo "命令说明:"
        echo "  start   - 启动服务"
        echo "  stop    - 停止服务"
        echo "  restart - 重启服务"
        echo "  status  - 查看服务状态"
        echo "  logs    - 查看服务日志"
        exit 1
        ;;
esac
