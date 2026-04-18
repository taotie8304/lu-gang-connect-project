#!/bin/bash
# 鲁港通 - 详细日志检查脚本（用于诊断"模型流响应为空"问题）

echo "=========================================="
echo "鲁港通 - 详细日志诊断工具"
echo "问题：模型流响应为空"
echo "=========================================="
echo ""

# 获取容器名称
FRONTEND_CONTAINER=$(docker ps --filter "name=lugang-ai" --format "{{.Names}}" | head -1)
BACKEND_CONTAINER=$(docker ps --filter "name=lugang-connect" --format "{{.Names}}" | head -1)

if [ -z "$FRONTEND_CONTAINER" ]; then
    echo "❌ 未找到前端容器"
    exit 1
fi

echo "✅ 找到前端容器: $FRONTEND_CONTAINER"
if [ -n "$BACKEND_CONTAINER" ]; then
    echo "✅ 找到后端容器: $BACKEND_CONTAINER"
else
    echo "⚠️  未找到后端容器"
fi
echo ""

# 1. 检查最近的错误日志
echo "=========================================="
echo "1. 最近的错误和警告（前端）"
echo "=========================================="
docker logs --since 1h $FRONTEND_CONTAINER 2>&1 | grep -E "(error|Error|ERROR|warn|Warn|WARN)" | tail -20
echo ""

# 2. 检查空响应相关日志
echo "=========================================="
echo "2. 空响应相关日志"
echo "=========================================="
docker logs --since 1h $FRONTEND_CONTAINER 2>&1 | grep -E "(empty|Empty|空|响应|response)" | tail -20
echo ""

# 3. 检查 LLM 相关日志
echo "=========================================="
echo "3. LLM 模型调用日志"
echo "=========================================="
docker logs --since 1h $FRONTEND_CONTAINER 2>&1 | grep -E "(LLM|llm|模型|createLLMResponse|createStreamResponse)" | tail -20
echo ""

# 4. 检查诊断日志（如果已添加）
echo "=========================================="
echo "4. 鲁港通诊断日志"
echo "=========================================="
docker logs --since 1h $FRONTEND_CONTAINER 2>&1 | grep "鲁港通诊断" | tail -30
echo ""

# 5. 检查过滤相关日志
echo "=========================================="
echo "5. 内容过滤相关日志"
echo "=========================================="
docker logs --since 1h $FRONTEND_CONTAINER 2>&1 | grep -E "(sanitize|clean|filter|过滤)" | tail -20
echo ""

# 6. 检查最近的 API 请求
echo "=========================================="
echo "6. 最近的 API 请求（chat 相关）"
echo "=========================================="
docker logs --since 1h $FRONTEND_CONTAINER 2>&1 | grep -E "(POST|GET).*(/chat|/v1/chat)" | tail -10
echo ""

# 7. 如果有后端容器，检查后端日志
if [ -n "$BACKEND_CONTAINER" ]; then
    echo "=========================================="
    echo "7. 后端错误日志"
    echo "=========================================="
    docker logs --since 1h $BACKEND_CONTAINER 2>&1 | grep -E "(error|Error|ERROR)" | tail -20
    echo ""
fi

# 8. 检查完整的最近日志（用于上下文分析）
echo "=========================================="
echo "8. 最近的完整日志（最后100行）"
echo "=========================================="
docker logs --tail 100 $FRONTEND_CONTAINER 2>&1
echo ""

echo "=========================================="
echo "诊断完成"
echo "=========================================="
echo ""
echo "💡 提示："
echo "  - 如果看到 'LLM response empty' 日志，说明模型确实没有返回内容"
echo "  - 如果看到过滤相关的日志，可能是内容被过滤掉了"
echo "  - 如果没有看到任何错误，可能需要添加更多诊断日志"
echo ""
echo "📝 下一步："
echo "  1. 如果日志中有明确错误信息，根据错误信息修复"
echo "  2. 如果没有足够的日志，需要添加诊断日志后重新测试"
echo "  3. 可以使用 'docker logs -f $FRONTEND_CONTAINER' 实时查看日志"
