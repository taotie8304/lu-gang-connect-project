#!/bin/bash
# 鲁港通 - 更新所有系统内容到数据库
# 使用方法：bash update_all_system_contents.sh

echo "=================================================="
echo "🚀 鲁港通 - 批量更新系统内容到数据库"
echo "=================================================="
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 MongoDB 依赖
if ! node -e "require('mongodb')" 2>/dev/null; then
    echo "📦 安装 MongoDB 依赖..."
    npm install mongodb
fi

# 检查 opencc-js 依赖
if ! node -e "require('opencc-js')" 2>/dev/null; then
    echo "📦 安装 opencc-js 依赖..."
    npm install opencc-js
fi

echo ""
echo "=================================================="
echo "📝 第一步：更新隐私政策"
echo "=================================================="
echo ""

# 1. 更新繁体隐私政策
echo "1️⃣  更新繁体隐私政策..."
node add_privacy_policy_zh_hant.js
if [ $? -ne 0 ]; then
    echo "❌ 繁体隐私政策更新失败"
    exit 1
fi
echo ""

# 2. 更新英文隐私政策
echo "2️⃣  更新英文隐私政策..."
node add_privacy_policy_en.js
if [ $? -ne 0 ]; then
    echo "❌ 英文隐私政策更新失败"
    exit 1
fi
echo ""

# 3. 转换并更新简体隐私政策
echo "3️⃣  转换并更新简体隐私政策..."
node convert_privacy_policy_to_simplified.js
if [ $? -ne 0 ]; then
    echo "❌ 简体隐私政策转换失败"
    exit 1
fi
echo ""

echo "=================================================="
echo "📝 第二步：更新个人资料收集声明"
echo "=================================================="
echo ""

# 4. 更新繁体个人资料收集声明
echo "4️⃣  更新繁体个人资料收集声明..."
node add_data_collection_zh_hant.js
if [ $? -ne 0 ]; then
    echo "❌ 繁体个人资料收集声明更新失败"
    exit 1
fi
echo ""

# 5. 更新英文个人资料收集声明
echo "5️⃣  更新英文个人资料收集声明..."
node add_data_collection_en.js
if [ $? -ne 0 ]; then
    echo "❌ 英文个人资料收集声明更新失败"
    exit 1
fi
echo ""

# 6. 转换并更新简体个人资料收集声明
echo "6️⃣  转换并更新简体个人资料收集声明..."
node convert_data_collection_to_simplified.js
if [ $? -ne 0 ]; then
    echo "❌ 简体个人资料收集声明转换失败"
    exit 1
fi
echo ""

echo "=================================================="
echo "✅ 所有系统内容已成功更新到数据库！"
echo "=================================================="
echo ""
echo "📊 更新内容："
echo "   ✓ 隐私政策（繁体、简体、英文）"
echo "   ✓ 个人资料收集声明（繁体、简体、英文）"
echo ""
