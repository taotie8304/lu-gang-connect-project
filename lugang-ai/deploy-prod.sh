#!/bin/bash

# ===== 鲁港通跨境AI智能平台 - 生产环境部署脚本 =====
#
# N3 起仅部署 FastGPT 二开前端（大模型直连阿里百炼，不再部署 One API 后端）：
# - 鲁港通前端（鲁港通跨境AI智能服务助手）- www.airscend.com:3210
# - 依赖容器：mongo(副本集)/pg/redis/minio/plugin(v1.1.1)/sandbox/mcp-server
#
# ⚠️ 首次从 4.14.4 升级到 4.16.2：部署后必须按 MIGRATION-4162.md 执行数据迁移
#    （备份 → 副本集核查 → 重装系统工具 → 逐个迁移脚本），否则工作流可能报错

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
DEFAULT_REGISTRY="ghcr.io"
DEFAULT_IMAGE_TAG="latest"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     鲁港通跨境AI智能平台 - 生产环境部署脚本 v2.0     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}部署服务：${NC}"
echo "  • 鲁港通前端 (www.airscend.com:3210)"
echo "  • 依赖容器 mongo/pg/redis/minio/plugin/sandbox/mcp-server"
echo ""

# 检查配置文件
if [ ! -f ".env.deploy" ]; then
    echo -e "${YELLOW}未找到 .env.deploy 配置文件，创建模板...${NC}"
    cat > .env.deploy << 'EOF'
# ===== 鲁港通跨境AI智能平台 - 部署配置（不入 git）=====

# GitHub 用户名（必填）
GITHUB_USERNAME=your-github-username

# 镜像标签（可选，默认 latest）
IMAGE_TAG=latest

# GitHub Container Registry Token（私有仓库需要，权限 read:packages）
GHCR_TOKEN=

# ===== 数据库账号密码 =====
# ⚠升级场景必填：必须填服务器现网真实值（见服务器 projects/app/.env.local 与现网 compose），
#   填错或留空将连不上现有工作流/知识库数据；本文件不入 git，严禁把真实值提交进仓库
MONGO_USER=root
MONGO_PASSWORD=
PG_USER=postgres
PG_PASSWORD=

# ===== MinIO 对象存储 =====
# ⚠升级场景：MINIO_ROOT_PASSWORD 必须等于现有值 LuGang2024Minio，否则读不到已上传的知识库源文件
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=LuGang2024Minio
S3_PUBLIC_BUCKET=lugang-public
S3_PRIVATE_BUCKET=lugang-private

# ===== 应用内部通信令牌（留空则首次部署自动生成强随机值并回写本文件）=====
# plugin 服务鉴权（前端 PLUGIN_TOKEN 与 plugin AUTH_TOKEN 必须一致，≥​32 位）
PLUGIN_AUTH_TOKEN=
# 代码沙箱鉴权（前端 CODE_SANDBOX_TOKEN 与 sandbox SANDBOX_TOKEN 必须一致）
CODE_SANDBOX_TOKEN=
EOF
    echo -e "${YELLOW}请编辑 .env.deploy 文件后重新运行此脚本${NC}"
    echo -e "${BLUE}nano .env.deploy${NC}"
    exit 1
fi

# 加载配置
source .env.deploy

# 鲁港通 - 升级场景强校验：数据库密码留空会让 compose 回落默认弱口令、连不上现有数据
if [ -z "$MONGO_PASSWORD" ] || [ -z "$PG_PASSWORD" ]; then
    echo -e "${RED}错误: 请在 .env.deploy 中填写 MONGO_PASSWORD / PG_PASSWORD（服务器现网真实值）${NC}"
    exit 1
fi

# 鲁港通 - 应用内部通信令牌：留空则自动生成强随机值（≥32 位）并回写 .env.deploy
if [ -z "$PLUGIN_AUTH_TOKEN" ]; then
    PLUGIN_AUTH_TOKEN=$(openssl rand -base64 32 | tr -d '\n')
    sed -i "s#^PLUGIN_AUTH_TOKEN=.*#PLUGIN_AUTH_TOKEN=${PLUGIN_AUTH_TOKEN}#" .env.deploy
    echo -e "${GREEN}✓ 已自动生成 PLUGIN_AUTH_TOKEN 并回写 .env.deploy${NC}"
fi
if [ -z "$CODE_SANDBOX_TOKEN" ]; then
    CODE_SANDBOX_TOKEN=$(openssl rand -base64 32 | tr -d '\n')
    sed -i "s#^CODE_SANDBOX_TOKEN=.*#CODE_SANDBOX_TOKEN=${CODE_SANDBOX_TOKEN}#" .env.deploy
    echo -e "${GREEN}✓ 已自动生成 CODE_SANDBOX_TOKEN 并回写 .env.deploy${NC}"
fi

# 验证必填配置
if [ -z "$GITHUB_USERNAME" ] || [ "$GITHUB_USERNAME" = "your-github-username" ]; then
    echo -e "${RED}错误: 请在 .env.deploy 中设置 GITHUB_USERNAME${NC}"
    exit 1
fi

# 设置镜像名称
IMAGE_TAG=${IMAGE_TAG:-$DEFAULT_IMAGE_TAG}
LUGANG_AI_IMAGE="${DEFAULT_REGISTRY}/${GITHUB_USERNAME}/lugang-ai:${IMAGE_TAG}"

# 鲁港通 - N3 已移除 One API 后端：仅部署 FastGPT 二开前端

echo -e "${BLUE}配置信息:${NC}"
echo "  GitHub 用户名: $GITHUB_USERNAME"
echo "  鲁港通前端镜像: $LUGANG_AI_IMAGE"
echo ""

# 步骤 1: 登录到 GitHub Container Registry
echo -e "${YELLOW}[1/5] 登录到 GitHub Container Registry${NC}"
if [ -n "$GHCR_TOKEN" ]; then
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
    echo -e "${GREEN}✓ 登录成功${NC}"
else
    echo -e "${YELLOW}提示: 未设置 GHCR_TOKEN，如果镜像是公开的可以继续${NC}"
fi

# 步骤 2: 拉取鲁港通前端镜像
echo ""
echo -e "${YELLOW}[2/5] 拉取鲁港通前端镜像${NC}"
docker pull $LUGANG_AI_IMAGE
echo -e "${GREEN}✓ 鲁港通前端镜像拉取成功${NC}"

# 步骤 3: 记录当前版本（用于回滚）并停止旧容器
echo ""
echo -e "${YELLOW}[3/5] 记录当前版本并停止旧容器${NC}"
CURRENT_AI_IMAGE=$(docker inspect --format='{{.Config.Image}}' lugang-ai-app 2>/dev/null || echo "无")
echo "${CURRENT_AI_IMAGE}" > /tmp/lugang-ai-rollback-previous-tag
echo -e "${GREEN}✓ 当前版本已记录: ${CURRENT_AI_IMAGE}（可用 ./rollback.sh 回滚）${NC}"
export LUGANG_AI_IMAGE
export MONGO_USER MONGO_PASSWORD
export PG_USER PG_PASSWORD
export MINIO_ROOT_USER MINIO_ROOT_PASSWORD
export S3_PUBLIC_BUCKET S3_PRIVATE_BUCKET
export PLUGIN_AUTH_TOKEN CODE_SANDBOX_TOKEN
# 鲁港通 - N3：旧后端容器已从编排移除，stop/rm 只处理前端
docker compose -f docker-compose.prod.yml stop lugang-ai 2>/dev/null || true
docker compose -f docker-compose.prod.yml rm -f lugang-ai 2>/dev/null || true
# 清理历史遗留的旧后端容器（若存在）
docker rm -f lugang-enterprise 2>/dev/null || true
echo -e "${GREEN}✓ 旧容器已停止${NC}"

# 步骤 4: 启动新容器
echo ""
echo -e "${YELLOW}[4/5] 启动服务${NC}"
# --remove-orphans：避免历史残留容器与当前编排不一致；minio/plugin 随本仓库 compose 一并拉起
docker compose -f docker-compose.prod.yml up -d --remove-orphans
echo -e "${GREEN}✓ 服务已启动${NC}"
echo -e "${YELLOW}若曾手动改过 plugin/minio，建议首次验证：docker compose -f docker-compose.prod.yml up -d --force-recreate plugin minio lugang-ai${NC}"

# 步骤 5: 检查服务状态
echo ""
echo -e "${YELLOW}[5/5] 检查服务状态${NC}"
sleep 5

# 显示容器状态
docker compose -f docker-compose.prod.yml ps

# 等待鲁港通前端启动
echo ""
echo -e "${YELLOW}等待鲁港通前端启动...${NC}"
for i in {1..30}; do
    if curl -s -f http://localhost:3210/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 鲁港通前端启动成功!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ 鲁港通前端启动超时，请检查日志${NC}"
        docker logs lugang-ai-app --tail 50
    fi
    echo "  等待中... ($i/30)"
    sleep 2
done

# 显示最近日志
echo ""
echo -e "${BLUE}鲁港通前端最近日志:${NC}"
docker logs lugang-ai-app --tail 5 2>/dev/null || echo "无日志"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    部署完成!                          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "鲁港通平台: ${BLUE}https://www.airscend.com${NC} (端口 3210)"
echo ""
# 鲁港通 - 4.14.4→4.16.2 首次升级必须执行数据迁移，否则工作流/知识库可能报错
echo -e "${YELLOW}⚠ 若本次为 4.14.4 → 4.16.2 首次升级，请按 MIGRATION-4162.md 继续：${NC}"
echo -e "  重装系统工具（管理员→插件→导入）→ 逐个执行迁移脚本 → 验证清单"
echo -e "${YELLOW}⚠ 最终部署提醒：内部 Redis 当前未设密码，上线前请为 Redis 启用鉴权，并整改宝塔宿主 Redis 无鉴权全网卡暴露${NC}"
echo ""
echo -e "查看日志:"
echo -e "  鲁港通平台: ${BLUE}docker logs -f lugang-ai-app${NC}"
