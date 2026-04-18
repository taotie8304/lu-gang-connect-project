#!/bin/bash

# 鲁港通 - 检查功能是否存在于容器中

echo "========================================"
echo "检查容器中的功能代码"
echo "========================================"

cd /www/wwwroot/lugang-ai

# 获取容器 ID
CONTAINER_ID=$(docker ps | grep lugang-ai | grep -v mongo | grep -v redis | grep -v pg | awk '{print $1}')

if [ -z "$CONTAINER_ID" ]; then
    echo "错误：找不到 lugang-ai 容器"
    exit 1
fi

echo "容器 ID: $CONTAINER_ID"
echo ""

# ============================================
# 检查知识库自动更新功能
# ============================================
echo "========== 知识库自动更新功能 =========="
echo ""
echo "[1] 检查前端组件是否存在："
docker exec $CONTAINER_ID ls -la /app/projects/app/src/pageComponents/dataset/detail/AutoUpdate/ 2>/dev/null && echo "✅ 前端组件存在" || echo "❌ 前端组件不存在"

echo ""
echo "[2] 检查后端模块是否存在："
docker exec $CONTAINER_ID ls -la /app/packages/service/core/dataset/autoUpdate/ 2>/dev/null && echo "✅ 后端模块存在" || echo "❌ 后端模块不存在"

echo ""
echo "[3] 检查 API 路由是否存在："
docker exec $CONTAINER_ID ls -la /app/projects/app/src/pages/api/core/dataset/collection/autoUpdate/ 2>/dev/null && echo "✅ API 路由存在" || echo "❌ API 路由不存在"

echo ""
echo "[4] 检查 NavBar 是否包含 autoUpdate 标签："
docker exec $CONTAINER_ID grep -n "autoUpdate" /app/projects/app/src/pageComponents/dataset/detail/NavBar.tsx 2>/dev/null && echo "✅ NavBar 包含 autoUpdate" || echo "❌ NavBar 不包含 autoUpdate"

# ============================================
# 检查聊天显示优化功能
# ============================================
echo ""
echo "========== 聊天显示优化功能 =========="
echo ""
echo "[1] 检查思考模式背景色："
docker exec $CONTAINER_ID grep -n "bg={'#F7F8FA'}" /app/projects/app/src/components/core/chat/components/AIResponseBox.tsx 2>/dev/null && echo "✅ 背景色设置存在" || echo "❌ 背景色设置不存在"

echo ""
echo "[2] 检查图片禁用："
docker exec $CONTAINER_ID grep -n "return null" /app/projects/app/src/components/Markdown/img/Image.tsx 2>/dev/null && echo "✅ 图片禁用存在" || echo "❌ 图片禁用不存在"

echo ""
echo "[3] 检查引用隐藏："
docker exec $CONTAINER_ID grep -n "isRoot" /app/projects/app/src/components/Markdown/A.tsx 2>/dev/null && echo "✅ 引用隐藏存在" || echo "❌ 引用隐藏不存在"

# ============================================
# 检查镜像构建时间
# ============================================
echo ""
echo "========== 镜像信息 =========="
echo ""
echo "当前镜像："
docker images ghcr.io/taotie8304/lugang-ai:latest --format "table {{.ID}}\t{{.CreatedAt}}\t{{.Size}}"

echo ""
echo "镜像详细信息："
docker inspect ghcr.io/taotie8304/lugang-ai:latest | grep -A 3 "Created"

# ============================================
# 检查 Git 提交
# ============================================
echo ""
echo "========== Git 提交历史 =========="
echo ""
echo "最近的提交："
docker exec $CONTAINER_ID cat /app/.git/HEAD 2>/dev/null || echo "容器中没有 .git 目录（这是正常的）"

echo ""
echo "========================================"
echo "检查完成"
echo "========================================"
echo ""
echo "如果功能代码不存在，说明镜像没有包含最新代码。"
echo "可能的原因："
echo "  1. GitHub Actions 还在构建中"
echo "  2. GitHub Actions 构建失败"
echo "  3. 镜像没有正确推送到 ghcr.io"
echo ""
echo "解决方案："
echo "  1. 访问 https://github.com/taotie8304/lu-gang-connect-project/actions"
echo "  2. 检查最新的 workflow 是否成功（绿色勾）"
echo "  3. 如果失败（红色叉），查看错误日志"
echo "  4. 如果成功，等待几分钟后重新拉取镜像"
echo ""
