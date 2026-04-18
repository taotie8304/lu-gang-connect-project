#!/bin/bash

# 鲁港通 - 自动更新功能部署脚本

set -e  # 遇到错误立即退出

echo "========================================="
echo "鲁港通 - 自动更新功能部署脚本"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 请在 lugang-ai 根目录运行此脚本${NC}"
    exit 1
fi

echo -e "${YELLOW}步骤 1/5: 检查依赖包...${NC}"
echo "检查必需的依赖包是否已安装..."

REQUIRED_PACKAGES=("cheerio" "node-cron" "papaparse" "node-xlsx" "axios")
MISSING_PACKAGES=()

for package in "${REQUIRED_PACKAGES[@]}"; do
    if pnpm list "$package" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $package 已安装"
    else
        echo -e "${RED}✗${NC} $package 未安装"
        MISSING_PACKAGES+=("$package")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -ne 0 ]; then
    echo -e "${RED}错误: 缺少依赖包，请运行 'pnpm install'${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}步骤 2/5: 构建项目...${NC}"
echo "构建 TypeScript 代码..."

pnpm build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} 构建成功"
else
    echo -e "${RED}✗${NC} 构建失败"
    exit 1
fi

echo ""
echo -e "${YELLOW}步骤 3/5: 检查 MongoDB 连接...${NC}"

# 尝试连接 MongoDB
if docker ps | grep -q "lugang-ai-mongo"; then
    echo -e "${GREEN}✓${NC} MongoDB 容器正在运行"
else
    echo -e "${RED}✗${NC} MongoDB 容器未运行"
    echo "请先启动 MongoDB: docker-compose up -d mongo"
    exit 1
fi

echo ""
echo -e "${YELLOW}步骤 4/5: 创建数据库索引...${NC}"
echo "为自动更新功能创建优化索引..."

# 创建索引的 JavaScript 脚本
INDEX_SCRIPT='
db = db.getSiblingDB("lugang_ai");

print("创建索引: idx_auto_update_enabled");
db.dataset_collections.createIndex(
  { "autoUpdateConfig.enabled": 1 },
  { name: "idx_auto_update_enabled", background: true, sparse: true }
);

print("创建索引: idx_auto_update_check_time");
db.dataset_collections.createIndex(
  { "autoUpdateConfig.enabled": 1, "autoUpdateConfig.lastCheckTime": -1 },
  { name: "idx_auto_update_check_time", background: true, sparse: true }
);

print("创建索引: idx_auto_update_update_time");
db.dataset_collections.createIndex(
  { "autoUpdateConfig.enabled": 1, "autoUpdateConfig.lastUpdateTime": -1 },
  { name: "idx_auto_update_update_time", background: true, sparse: true }
);

print("创建索引: idx_team_auto_update");
db.dataset_collections.createIndex(
  { teamId: 1, "autoUpdateConfig.enabled": 1 },
  { name: "idx_team_auto_update", background: true }
);

print("索引创建完成");
print("验证索引:");
db.dataset_collections.getIndexes().forEach(function(index) {
  if (index.name.includes("auto_update")) {
    print("  ✓ " + index.name);
  }
});
'

# 执行索引创建
if docker exec lugang-ai-mongo mongosh --quiet --eval "$INDEX_SCRIPT" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 索引创建成功"
elif docker exec lugang-ai-mongo mongo --quiet --eval "$INDEX_SCRIPT" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 索引创建成功 (使用 mongo 命令)"
else
    echo -e "${YELLOW}⚠${NC} 无法自动创建索引，请手动执行"
    echo "手动执行命令:"
    echo "  docker exec -it lugang-ai-mongo mongosh lugang_ai"
    echo "然后运行 DATABASE_OPTIMIZATION.md 中的索引创建命令"
fi

echo ""
echo -e "${YELLOW}步骤 5/5: 验证部署...${NC}"

# 检查核心文件是否存在
FILES=(
    "packages/service/core/dataset/autoUpdate/scraper.ts"
    "packages/service/core/dataset/autoUpdate/detector.ts"
    "packages/service/core/dataset/autoUpdate/downloader.ts"
    "packages/service/core/dataset/autoUpdate/scheduler.ts"
    "packages/service/core/dataset/autoUpdate/index.ts"
    "projects/app/src/pages/api/core/dataset/collection/autoUpdate/config.ts"
    "projects/app/src/pages/api/core/dataset/collection/autoUpdate/trigger.ts"
    "projects/app/src/pages/api/core/dataset/collection/autoUpdate/detect.ts"
    "projects/app/src/pages/api/core/dataset/collection/autoUpdate/history.ts"
)

ALL_FILES_EXIST=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file 不存在"
        ALL_FILES_EXIST=false
    fi
done

if [ "$ALL_FILES_EXIST" = false ]; then
    echo -e "${RED}错误: 部分文件缺失${NC}"
    exit 1
fi

echo ""
echo "========================================="
echo -e "${GREEN}部署完成！${NC}"
echo "========================================="
echo ""
echo "下一步:"
echo "1. 启动应用: pnpm dev (开发) 或 docker-compose up -d (生产)"
echo "2. 检查日志: docker logs -f lugang-ai"
echo "3. 查看启动日志中是否有: '鲁港通 - 自动更新定时任务已启动'"
echo "4. 访问前端界面测试功能"
echo ""
echo "文档:"
echo "- 功能说明: packages/service/core/dataset/autoUpdate/README.md"
echo "- 部署清单: packages/service/core/dataset/autoUpdate/DEPLOYMENT_CHECKLIST.md"
echo "- 性能优化: packages/service/core/dataset/autoUpdate/DATABASE_OPTIMIZATION.md"
echo "- 代码审查: packages/service/core/dataset/autoUpdate/CODE_REVIEW.md"
echo ""
