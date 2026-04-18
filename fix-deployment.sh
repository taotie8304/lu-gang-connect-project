#!/bin/bash

# 鲁港通 - 聊天显示优化功能修复脚本
# 问题：背景色和引用隐藏功能没有生效

set -e

echo "========================================"
echo "鲁港通 - 诊断和修复部署问题"
echo "========================================"

cd /www/wwwroot/lugang-ai

# ============================================
# 第一步：检查当前镜像版本
# ============================================
echo ""
echo "[1/7] 检查当前镜像版本..."
echo "当前镜像信息："
docker images ghcr.io/taotie8304/lugang-ai:latest --format "table {{.ID}}\t{{.CreatedAt}}\t{{.Size}}"

echo ""
echo "当前运行的容器："
docker ps | grep lugang-ai | grep -v mongo | grep -v redis | grep -v pg

# ============================================
# 第二步：检查容器内的文件
# ============================================
echo ""
echo "[2/7] 检查容器内的代码文件..."
CONTAINER_ID=$(docker ps | grep lugang-ai | grep -v mongo | grep -v redis | grep -v pg | awk '{print $1}')

if [ -z "$CONTAINER_ID" ]; then
    echo "错误：找不到 lugang-ai 容器"
    exit 1
fi

echo "容器 ID: $CONTAINER_ID"
echo ""
echo "检查 AIResponseBox.tsx 文件（应该包含 bg={'#F7F8FA'}）："
docker exec $CONTAINER_ID grep -n "bg={'#F7F8FA'}" /app/projects/app/src/components/core/chat/components/AIResponseBox.tsx || echo "❌ 未找到背景色设置"

echo ""
echo "检查 Image.tsx 文件（应该返回 null）："
docker exec $CONTAINER_ID grep -n "return null" /app/projects/app/src/components/Markdown/img/Image.tsx || echo "❌ 未找到图片禁用代码"

echo ""
echo "检查 A.tsx 文件（应该包含引用隐藏逻辑）："
docker exec $CONTAINER_ID grep -n "isRoot" /app/projects/app/src/components/Markdown/A.tsx || echo "❌ 未找到引用隐藏代码"

# ============================================
# 第三步：停止容器
# ============================================
echo ""
echo "[3/7] 停止所有容器..."
docker-compose down

# ============================================
# 第四步：删除旧镜像并清理缓存
# ============================================
echo ""
echo "[4/7] 删除旧镜像并清理缓存..."
docker rmi ghcr.io/taotie8304/lugang-ai:latest -f || echo "镜像已删除或不存在"
docker system prune -f

# ============================================
# 第五步：重新拉取最新镜像
# ============================================
echo ""
echo "[5/7] 重新拉取最新镜像..."
docker pull ghcr.io/taotie8304/lugang-ai:latest

echo ""
echo "新镜像信息："
docker images ghcr.io/taotie8304/lugang-ai:latest --format "table {{.ID}}\t{{.CreatedAt}}\t{{.Size}}"

# ============================================
# 第六步：启动容器
# ============================================
echo ""
echo "[6/7] 启动容器..."
docker-compose up -d

echo "等待服务启动（30秒）..."
sleep 30

# ============================================
# 第七步：验证新代码
# ============================================
echo ""
echo "[7/7] 验证新代码..."
CONTAINER_ID=$(docker ps | grep lugang-ai | grep -v mongo | grep -v redis | grep -v pg | awk '{print $1}')

echo "新容器 ID: $CONTAINER_ID"
echo ""
echo "验证 AIResponseBox.tsx："
docker exec $CONTAINER_ID grep -A 5 "bg={'#F7F8FA'}" /app/projects/app/src/components/core/chat/components/AIResponseBox.tsx || echo "❌ 背景色设置未找到"

echo ""
echo "验证 Image.tsx："
docker exec $CONTAINER_ID head -20 /app/projects/app/src/components/Markdown/img/Image.tsx

echo ""
echo "验证 A.tsx："
docker exec $CONTAINER_ID grep -A 10 "isRoot" /app/projects/app/src/components/Markdown/A.tsx | head -20

# ============================================
# 查看日志
# ============================================
echo ""
echo "前端服务日志（最后30行）："
docker-compose logs --tail=30 lugang-ai

# ============================================
# 完成
# ============================================
echo ""
echo "========================================"
echo "修复完成！"
echo "========================================"
echo ""
echo "请执行以下操作验证功能："
echo ""
echo "1. 清除浏览器缓存："
echo "   - 按 Ctrl + Shift + Delete"
echo "   - 选择'缓存的图片和文件'"
echo "   - 点击'清除数据'"
echo ""
echo "2. 强制刷新页面："
echo "   - 访问 https://www.airscend.com"
echo "   - 按 Ctrl + F5 强制刷新"
echo ""
echo "3. 或使用无痕模式："
echo "   - 按 Ctrl + Shift + N 打开无痕窗口"
echo "   - 访问 https://www.airscend.com"
echo ""
echo "验证清单："
echo "  □ 思考模式有灰色背景（#F7F8FA）"
echo "  □ 最终答案背景是白色"
echo "  □ 底部的引用（如'第一步：出生登记'）已隐藏"
echo "  □ AI 回复中不显示图片"
echo "  □ 表格渲染正确"
echo ""
