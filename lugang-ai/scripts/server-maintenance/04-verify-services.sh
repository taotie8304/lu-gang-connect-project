#!/bin/bash

# ===== 鲁港通 - 服务验证脚本 =====
# 验证所有服务是否正常运行
# 
# 使用方法: 
#   chmod +x 04-verify-services.sh
#   ./04-verify-services.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        鲁港通 - 服务验证脚本 v1.0                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗ $2${NC}"
        ((FAIL_COUNT++))
    fi
}

check_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARN_COUNT++))
}

# ===== 1. 检查容器状态 =====
echo -e "${YELLOW}[1/6] 检查容器状态...${NC}"
echo ""

# 检查鲁港通前端
if docker ps --format "{{.Names}}" | grep -q "^lugang-ai-app$"; then
    STATUS=$(docker inspect --format='{{.State.Status}}' lugang-ai-app)
    if [ "$STATUS" == "running" ]; then
        check_result 0 "鲁港通前端容器运行中"
    else
        check_result 1 "鲁港通前端容器状态异常: $STATUS"
    fi
else
    check_result 1 "鲁港通前端容器不存在"
fi

# 检查 MongoDB
if docker ps --format "{{.Names}}" | grep -q "^lugang-ai-mongo$"; then
    STATUS=$(docker inspect --format='{{.State.Status}}' lugang-ai-mongo)
    if [ "$STATUS" == "running" ]; then
        check_result 0 "MongoDB 容器运行中"
    else
        check_result 1 "MongoDB 容器状态异常: $STATUS"
    fi
else
    check_result 1 "MongoDB 容器不存在"
fi

# 检查 PostgreSQL
if docker ps --format "{{.Names}}" | grep -q "^lugang-ai-pg$"; then
    STATUS=$(docker inspect --format='{{.State.Status}}' lugang-ai-pg)
    if [ "$STATUS" == "running" ]; then
        check_result 0 "PostgreSQL 容器运行中"
    else
        check_result 1 "PostgreSQL 容器状态异常: $STATUS"
    fi
else
    check_result 1 "PostgreSQL 容器不存在"
fi

# 检查 Redis
if docker ps --format "{{.Names}}" | grep -q "^lugang-ai-redis$"; then
    STATUS=$(docker inspect --format='{{.State.Status}}' lugang-ai-redis)
    if [ "$STATUS" == "running" ]; then
        check_result 0 "Redis 容器运行中"
    else
        check_result 1 "Redis 容器状态异常: $STATUS"
    fi
else
    check_result 1 "Redis 容器不存在"
fi

# 检查鲁港通后端（可选）
if docker ps --format "{{.Names}}" | grep -q "^lugang-enterprise$"; then
    STATUS=$(docker inspect --format='{{.State.Status}}' lugang-enterprise)
    if [ "$STATUS" == "running" ]; then
        check_result 0 "鲁港通后端容器运行中"
    else
        check_warn "鲁港通后端容器状态异常: $STATUS"
    fi
else
    check_warn "鲁港通后端容器不存在（可能未部署）"
fi

echo ""

# ===== 2. 检查数据库连接 =====
echo -e "${YELLOW}[2/6] 检查数据库连接...${NC}"
echo ""

# 检查 MongoDB 连接
if docker exec lugang-ai-mongo mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null | grep -q "ok"; then
    check_result 0 "MongoDB 连接正常"
else
    # 尝试旧版 mongo 命令
    if docker exec lugang-ai-mongo mongo --eval "db.adminCommand('ping')" --quiet 2>/dev/null | grep -q "ok"; then
        check_result 0 "MongoDB 连接正常"
    else
        check_result 1 "MongoDB 连接失败"
    fi
fi

# 检查 PostgreSQL 连接
if docker exec lugang-ai-pg pg_isready -U postgres 2>/dev/null | grep -q "accepting"; then
    check_result 0 "PostgreSQL 连接正常"
else
    check_result 1 "PostgreSQL 连接失败"
fi

# 检查 Redis 连接
if docker exec lugang-ai-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    check_result 0 "Redis 连接正常"
else
    check_result 1 "Redis 连接失败"
fi

echo ""

# ===== 3. 检查端口监听 =====
echo -e "${YELLOW}[3/6] 检查端口监听...${NC}"
echo ""

# 检查 3210 端口（鲁港通前端）
if netstat -tlnp 2>/dev/null | grep -q ":3210" || ss -tlnp 2>/dev/null | grep -q ":3210"; then
    check_result 0 "端口 3210 (鲁港通前端) 监听中"
else
    check_result 1 "端口 3210 (鲁港通前端) 未监听"
fi

# 检查 27017 端口（MongoDB）
if netstat -tlnp 2>/dev/null | grep -q ":27017" || ss -tlnp 2>/dev/null | grep -q ":27017"; then
    check_result 0 "端口 27017 (MongoDB) 监听中"
else
    check_result 1 "端口 27017 (MongoDB) 未监听"
fi

# 检查 5432 端口（PostgreSQL）
if netstat -tlnp 2>/dev/null | grep -q ":5432" || ss -tlnp 2>/dev/null | grep -q ":5432"; then
    check_result 0 "端口 5432 (PostgreSQL) 监听中"
else
    check_result 1 "端口 5432 (PostgreSQL) 未监听"
fi

# 检查 8080 端口（鲁港通后端）
if netstat -tlnp 2>/dev/null | grep -q ":8080" || ss -tlnp 2>/dev/null | grep -q ":8080"; then
    check_result 0 "端口 8080 (鲁港通后端) 监听中"
else
    check_warn "端口 8080 (鲁港通后端) 未监听"
fi

echo ""

# ===== 4. 检查 HTTP 服务 =====
echo -e "${YELLOW}[4/6] 检查 HTTP 服务...${NC}"
echo ""

# 检查鲁港通前端健康检查
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3210/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    check_result 0 "鲁港通前端 API 健康检查通过 (HTTP $HTTP_CODE)"
else
    check_result 1 "鲁港通前端 API 健康检查失败 (HTTP $HTTP_CODE)"
fi

# 检查鲁港通前端首页
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3210 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "302" ]; then
    check_result 0 "鲁港通前端首页可访问 (HTTP $HTTP_CODE)"
else
    check_result 1 "鲁港通前端首页不可访问 (HTTP $HTTP_CODE)"
fi

# 检查鲁港通后端
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/status 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    check_result 0 "鲁港通后端 API 可访问 (HTTP $HTTP_CODE)"
else
    check_warn "鲁港通后端 API 不可访问 (HTTP $HTTP_CODE)"
fi

echo ""

# ===== 5. 检查外部访问 =====
echo -e "${YELLOW}[5/6] 检查外部域名访问...${NC}"
echo ""

# 检查 www.airscend.com
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://www.airscend.com 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "302" ]; then
    check_result 0 "www.airscend.com 可访问 (HTTP $HTTP_CODE)"
else
    check_warn "www.airscend.com 访问异常 (HTTP $HTTP_CODE)"
fi

# 检查 api.airscend.com
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://api.airscend.com/api/status 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    check_result 0 "api.airscend.com 可访问 (HTTP $HTTP_CODE)"
else
    check_warn "api.airscend.com 访问异常 (HTTP $HTTP_CODE)"
fi

echo ""

# ===== 6. 检查日志错误 =====
echo -e "${YELLOW}[6/6] 检查最近日志错误...${NC}"
echo ""

# 检查鲁港通前端日志
ERROR_COUNT=$(docker logs lugang-ai-app --since 10m 2>&1 | grep -ci "error" || echo "0")
if [ "$ERROR_COUNT" -lt 5 ]; then
    check_result 0 "鲁港通前端日志正常 (最近10分钟 $ERROR_COUNT 个错误)"
else
    check_warn "鲁港通前端日志有较多错误 (最近10分钟 $ERROR_COUNT 个错误)"
fi

# 检查 MongoDB 日志
ERROR_COUNT=$(docker logs lugang-ai-mongo --since 10m 2>&1 | grep -ci "error" || echo "0")
if [ "$ERROR_COUNT" -lt 5 ]; then
    check_result 0 "MongoDB 日志正常 (最近10分钟 $ERROR_COUNT 个错误)"
else
    check_warn "MongoDB 日志有较多错误 (最近10分钟 $ERROR_COUNT 个错误)"
fi

echo ""

# ===== 显示验证结果 =====
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  验证完成                             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "验证结果:"
echo -e "  ${GREEN}通过: ${PASS_COUNT}${NC}"
echo -e "  ${RED}失败: ${FAIL_COUNT}${NC}"
echo -e "  ${YELLOW}警告: ${WARN_COUNT}${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ 所有核心服务运行正常！${NC}"
    echo ""
    echo -e "${YELLOW}下一步: ${NC}"
    echo "  1. 在浏览器中访问 https://www.airscend.com 测试登录"
    echo "  2. 使用 root / LuGang@2025 登录"
    echo "  3. 测试知识库、应用等功能"
    echo "  4. 如果一切正常，运行 05-final-backup.sh 创建最终备份"
else
    echo -e "${RED}✗ 有 ${FAIL_COUNT} 项检查失败，请先修复问题${NC}"
    echo ""
    echo "查看日志:"
    echo "  docker logs lugang-ai-app --tail 100"
    echo "  docker logs lugang-ai-mongo --tail 100"
fi
