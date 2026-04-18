#!/bin/bash
# 鲁港通 - 查看服务器日志脚本

echo "=========================================="
echo "鲁港通 - 服务器日志检查工具"
echo "=========================================="
echo ""

# 检查 Docker 容器日志
echo "1. 检查前端容器日志（最近100行）"
echo "=========================================="
docker logs --tail 100 lugang-ai 2>&1 | grep -E "(error|Error|ERROR|warn|Warn|WARN|empty|Empty|响应|response)" || echo "未找到相关错误"
echo ""

echo "2. 检查前端容器日志（包含'模型'关键词）"
echo "=========================================="
docker logs --tail 200 lugang-ai 2>&1 | grep -E "(模型|LLM|llm)" || echo "未找到相关日志"
echo ""

echo "3. 检查前端容器日志（包含'香港'或'幼儿园'关键词）"
echo "=========================================="
docker logs --tail 200 lugang-ai 2>&1 | grep -E "(香港|幼儿园|kindergarten)" || echo "未找到相关日志"
echo ""

echo "4. 检查后端容器日志（最近100行）"
echo "=========================================="
docker logs --tail 100 lugang-connect-enterprise 2>&1 | grep -E "(error|Error|ERROR|warn|Warn|WARN)" || echo "未找到相关错误"
echo ""

echo "5. 查看所有运行中的容器"
echo "=========================================="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "6. 检查前端容器完整日志（最近50行，不过滤）"
echo "=========================================="
docker logs --tail 50 lugang-ai 2>&1
echo ""

echo "=========================================="
echo "日志检查完成"
echo "=========================================="
echo ""
echo "如需查看更多日志，请使用以下命令："
echo "  - 查看前端实时日志: docker logs -f lugang-ai"
echo "  - 查看后端实时日志: docker logs -f lugang-connect-enterprise"
echo "  - 查看最近500行: docker logs --tail 500 lugang-ai"
