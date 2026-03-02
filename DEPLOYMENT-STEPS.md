# 鲁港通项目 - 生产环境部署步骤

## 服务器信息
- **IP**: 156.225.30.134
- **用户**: root
- **项目路径**: /www/wwwroot/lugang-ai

---

## 第一步：检查现有容器和数据库

### 1.1 连接到服务器
```bash
ssh root@156.225.30.134
```

### 1.2 检查所有正在运行的容器
```bash
# 查看所有容器（包括停止的）
docker ps -a

# 查看正在运行的容器详细信息
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

# 查看容器资源使用情况
docker stats --no-stream
```

### 1.3 检查 Docker 网络
```bash
# 查看所有网络
docker network ls

# 查看网络详细信息
docker network inspect bridge
```

### 1.4 检查 Docker 卷（数据卷）
```bash
# 查看所有卷
docker volume ls

# 查看卷详细信息
docker volume inspect $(docker volume ls -q)
```

### 1.5 检查数据库容器
```bash
# 查找 MongoDB 容器
docker ps | grep mongo

# 查看 MongoDB 容器日志
docker logs <mongodb-container-name> --tail 50

# 进入 MongoDB 容器检查数据库
docker exec -it <mongodb-container-name> mongosh
# 在 mongosh 中执行：
# show dbs
# use fastgpt
# show collections
# exit
```

### 1.6 检查磁盘空间
```bash
# 查看磁盘使用情况
df -h

# 查看 Docker 占用空间
docker system df

# 查看项目目录大小
du -sh /www/wwwroot/lugang-ai
```

---

## 第二步：备份现有容器和数据库

### 2.1 创建备份目录
```bash
# 创建备份目录（使用时间戳）
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups/lugang_backup_${BACKUP_DATE}"
mkdir -p ${BACKUP_DIR}

echo "备份目录: ${BACKUP_DIR}"
```

### 2.2 备份 MongoDB 数据库
```bash
# 方法一：使用 mongodump（推荐）
# 找到 MongoDB 容器名称
MONGO_CONTAINER=$(docker ps --filter "ancestor=mongo" --format "{{.Names}}" | head -1)

# 如果找不到，手动指定容器名称
# MONGO_CONTAINER="mongo-container-name"

echo "MongoDB 容器: ${MONGO_CONTAINER}"

# 备份所有数据库
docker exec ${MONGO_CONTAINER} mongodump --out=/tmp/backup

# 将备份复制到宿主机
docker cp ${MONGO_CONTAINER}:/tmp/backup ${BACKUP_DIR}/mongodb_backup

# 清理容器内的临时备份
docker exec ${MONGO_CONTAINER} rm -rf /tmp/backup

echo "✅ MongoDB 数据库备份完成: ${BACKUP_DIR}/mongodb_backup"
```

### 2.3 备份 Docker 容器配置
```bash
# 导出所有容器的配置
docker ps -a --format "{{.Names}}" | while read container; do
    docker inspect ${container} > ${BACKUP_DIR}/container_${container}.json
done

echo "✅ 容器配置备份完成"
```

### 2.4 备份 Docker 镜像
```bash
# 备份当前使用的鲁港通镜像
CURRENT_IMAGE=$(docker ps --filter "name=lugang-ai-app" --format "{{.Image}}")

if [ ! -z "${CURRENT_IMAGE}" ]; then
    echo "当前镜像: ${CURRENT_IMAGE}"
    docker save ${CURRENT_IMAGE} -o ${BACKUP_DIR}/lugang-ai-image.tar
    echo "✅ Docker 镜像备份完成: ${BACKUP_DIR}/lugang-ai-image.tar"
else
    echo "⚠️  未找到鲁港通容器"
fi
```

### 2.5 备份项目配置文件
```bash
# 备份 docker-compose 文件
if [ -f /www/wwwroot/lugang-ai/docker-compose.yml ]; then
    cp /www/wwwroot/lugang-ai/docker-compose.yml ${BACKUP_DIR}/
    echo "✅ docker-compose.yml 备份完成"
fi

if [ -f /www/wwwroot/lugang-ai/docker-compose.prod.yml ]; then
    cp /www/wwwroot/lugang-ai/docker-compose.prod.yml ${BACKUP_DIR}/
    echo "✅ docker-compose.prod.yml 备份完成"
fi

# 备份环境变量文件
if [ -f /www/wwwroot/lugang-ai/.env ]; then
    cp /www/wwwroot/lugang-ai/.env ${BACKUP_DIR}/
    echo "✅ .env 文件备份完成"
fi

# 备份部署脚本
if [ -f /www/wwwroot/lugang-ai/deploy-prod.sh ]; then
    cp /www/wwwroot/lugang-ai/deploy-prod.sh ${BACKUP_DIR}/
    echo "✅ deploy-prod.sh 备份完成"
fi
```

### 2.6 备份 Docker 卷数据
```bash
# 备份所有 Docker 卷
docker volume ls --format "{{.Name}}" | while read volume; do
    echo "备份卷: ${volume}"
    docker run --rm -v ${volume}:/data -v ${BACKUP_DIR}:/backup alpine tar czf /backup/volume_${volume}.tar.gz -C /data .
done

echo "✅ Docker 卷备份完成"
```

### 2.7 创建备份清单
```bash
# 生成备份清单
cat > ${BACKUP_DIR}/backup_manifest.txt << EOF
鲁港通项目备份清单
==================
备份时间: ${BACKUP_DATE}
备份路径: ${BACKUP_DIR}

包含内容:
- MongoDB 数据库备份
- Docker 容器配置
- Docker 镜像备份
- 项目配置文件
- Docker 卷数据

容器列表:
$(docker ps -a --format "{{.Names}}\t{{.Image}}\t{{.Status}}")

数据库列表:
$(docker exec ${MONGO_CONTAINER} mongosh --quiet --eval "db.adminCommand('listDatabases')" 2>/dev/null || echo "无法连接到 MongoDB")
EOF

cat ${BACKUP_DIR}/backup_manifest.txt
echo ""
echo "✅ 备份清单已创建"
```

### 2.8 压缩备份（可选）
```bash
# 压缩整个备份目录
cd /root/backups
tar czf lugang_backup_${BACKUP_DATE}.tar.gz lugang_backup_${BACKUP_DATE}/

echo "✅ 备份已压缩: /root/backups/lugang_backup_${BACKUP_DATE}.tar.gz"
echo "备份大小: $(du -sh lugang_backup_${BACKUP_DATE}.tar.gz)"
```

---

## 第三步：部署新镜像

### 3.1 拉取最新镜像
```bash
# 进入项目目录
cd /www/wwwroot/lugang-ai

# 拉取最新镜像（替换 YOUR_GITHUB_USERNAME）
docker pull ghcr.io/YOUR_GITHUB_USERNAME/lugang-ai:latest

# 验证镜像已下载
docker images | grep lugang-ai
```

### 3.2 停止现有容器
```bash
# 停止鲁港通前端容器
docker stop lugang-ai-app

# 可选：停止其他相关容器
# docker stop <other-container-name>
```

### 3.3 备份当前容器（额外保险）
```bash
# 提交当前容器为镜像（以防万一）
docker commit lugang-ai-app lugang-ai-app:backup-${BACKUP_DATE}

echo "✅ 当前容器已备份为镜像: lugang-ai-app:backup-${BACKUP_DATE}"
```

### 3.4 删除旧容器
```bash
# 删除旧容器
docker rm lugang-ai-app

echo "✅ 旧容器已删除"
```

### 3.5 启动新容器

#### 方法一：使用 docker-compose（推荐）
```bash
# 如果使用 docker-compose
cd /www/wwwroot/lugang-ai

# 拉取最新镜像并重启
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f --tail 100
```

#### 方法二：使用部署脚本
```bash
# 如果有部署脚本
cd /www/wwwroot/lugang-ai
./deploy-prod.sh
```

#### 方法三：手动启动容器
```bash
# 手动启动容器（需要根据实际配置调整参数）
docker run -d \
  --name lugang-ai-app \
  --restart always \
  -p 3210:3000 \
  -e MONGODB_URI="mongodb://mongo:27017/fastgpt" \
  -e ONE_API_URL="https://api.airscend.com" \
  -e ONE_API_TOKEN="your-token" \
  --network lugang-network \
  ghcr.io/YOUR_GITHUB_USERNAME/lugang-ai:latest

echo "✅ 新容器已启动"
```

### 3.6 验证部署
```bash
# 查看容器状态
docker ps | grep lugang-ai-app

# 查看容器日志
docker logs lugang-ai-app --tail 100 -f

# 检查容器健康状态
docker inspect lugang-ai-app | grep -A 10 "Health"

# 测试应用是否响应
curl -I http://localhost:3210

# 或者从外部测试
curl -I https://www.airscend.com
```

### 3.7 检查数据库连接
```bash
# 进入容器检查
docker exec -it lugang-ai-app sh

# 在容器内检查环境变量
env | grep MONGO
env | grep ONE_API

# 退出容器
exit
```

---

## 第四步：回滚（如果需要）

### 4.1 快速回滚到备份镜像
```bash
# 停止新容器
docker stop lugang-ai-app
docker rm lugang-ai-app

# 使用备份的镜像启动
docker run -d \
  --name lugang-ai-app \
  --restart always \
  -p 3210:3000 \
  -e MONGODB_URI="mongodb://mongo:27017/fastgpt" \
  -e ONE_API_URL="https://api.airscend.com" \
  -e ONE_API_TOKEN="your-token" \
  --network lugang-network \
  lugang-ai-app:backup-${BACKUP_DATE}

echo "✅ 已回滚到备份镜像"
```

### 4.2 从备份恢复数据库
```bash
# 如果需要恢复数据库
MONGO_CONTAINER=$(docker ps --filter "ancestor=mongo" --format "{{.Names}}" | head -1)

# 复制备份到容器
docker cp ${BACKUP_DIR}/mongodb_backup ${MONGO_CONTAINER}:/tmp/backup

# 恢复数据库
docker exec ${MONGO_CONTAINER} mongorestore /tmp/backup

# 清理
docker exec ${MONGO_CONTAINER} rm -rf /tmp/backup

echo "✅ 数据库已恢复"
```

### 4.3 恢复配置文件
```bash
# 恢复 docker-compose 文件
cp ${BACKUP_DIR}/docker-compose.prod.yml /www/wwwroot/lugang-ai/

# 恢复环境变量
cp ${BACKUP_DIR}/.env /www/wwwroot/lugang-ai/

echo "✅ 配置文件已恢复"
```

---

## 第五步：监控和验证

### 5.1 监控容器日志
```bash
# 实时查看日志
docker logs lugang-ai-app -f

# 查看最近的错误
docker logs lugang-ai-app 2>&1 | grep -i error

# 查看最近的警告
docker logs lugang-ai-app 2>&1 | grep -i warn
```

### 5.2 检查应用功能
```bash
# 测试主页
curl -I https://www.airscend.com

# 测试 API
curl https://www.airscend.com/api/health

# 测试支付 API
curl https://www.airscend.com/api/recharge/packages
```

### 5.3 检查资源使用
```bash
# 查看容器资源使用
docker stats lugang-ai-app --no-stream

# 查看磁盘空间
df -h

# 查看内存使用
free -h
```

---

## 完整部署脚本（一键执行）

创建一个完整的部署脚本：

```bash
cat > /root/deploy_lugang_new.sh << 'DEPLOY_SCRIPT'
#!/bin/bash

set -e  # 遇到错误立即退出

echo "=========================================="
echo "鲁港通项目部署脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
GITHUB_USERNAME="YOUR_GITHUB_USERNAME"  # 替换为你的 GitHub 用户名
PROJECT_DIR="/www/wwwroot/lugang-ai"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups/lugang_backup_${BACKUP_DATE}"

echo -e "${YELLOW}步骤 1/5: 创建备份目录${NC}"
mkdir -p ${BACKUP_DIR}
echo "备份目录: ${BACKUP_DIR}"
echo ""

echo -e "${YELLOW}步骤 2/5: 备份 MongoDB 数据库${NC}"
MONGO_CONTAINER=$(docker ps --filter "ancestor=mongo" --format "{{.Names}}" | head -1)
if [ -z "${MONGO_CONTAINER}" ]; then
    echo -e "${RED}错误: 未找到 MongoDB 容器${NC}"
    exit 1
fi
echo "MongoDB 容器: ${MONGO_CONTAINER}"
docker exec ${MONGO_CONTAINER} mongodump --out=/tmp/backup
docker cp ${MONGO_CONTAINER}:/tmp/backup ${BACKUP_DIR}/mongodb_backup
docker exec ${MONGO_CONTAINER} rm -rf /tmp/backup
echo -e "${GREEN}✅ MongoDB 备份完成${NC}"
echo ""

echo -e "${YELLOW}步骤 3/5: 备份当前容器${NC}"
CURRENT_IMAGE=$(docker ps --filter "name=lugang-ai-app" --format "{{.Image}}")
if [ ! -z "${CURRENT_IMAGE}" ]; then
    docker commit lugang-ai-app lugang-ai-app:backup-${BACKUP_DATE}
    docker save ${CURRENT_IMAGE} -o ${BACKUP_DIR}/lugang-ai-image.tar
    echo -e "${GREEN}✅ 容器备份完成${NC}"
else
    echo -e "${YELLOW}⚠️  未找到运行中的鲁港通容器${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 4/5: 部署新镜像${NC}"
cd ${PROJECT_DIR}

# 拉取最新镜像
echo "拉取最新镜像..."
docker pull ghcr.io/${GITHUB_USERNAME}/lugang-ai:latest

# 停止并删除旧容器
echo "停止旧容器..."
docker stop lugang-ai-app || true
docker rm lugang-ai-app || true

# 启动新容器
echo "启动新容器..."
if [ -f docker-compose.prod.yml ]; then
    docker-compose -f docker-compose.prod.yml up -d
elif [ -f deploy-prod.sh ]; then
    ./deploy-prod.sh
else
    echo -e "${RED}错误: 未找到部署配置${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 新容器已启动${NC}"
echo ""

echo -e "${YELLOW}步骤 5/5: 验证部署${NC}"
sleep 5
docker ps | grep lugang-ai-app
echo ""
echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo "备份位置: ${BACKUP_DIR}"
echo "查看日志: docker logs lugang-ai-app -f"
echo ""

DEPLOY_SCRIPT

chmod +x /root/deploy_lugang_new.sh
echo "✅ 部署脚本已创建: /root/deploy_lugang_new.sh"
```

---

## 使用说明

### 快速部署（推荐）
```bash
# 1. 连接服务器
ssh root@156.225.30.134

# 2. 执行完整部署脚本
/root/deploy_lugang_new.sh
```

### 手动部署（分步执行）
按照上面的步骤 1-5 依次执行命令

---

## 注意事项

1. **替换 GitHub 用户名**: 将 `YOUR_GITHUB_USERNAME` 替换为你的实际 GitHub 用户名
2. **检查容器名称**: 确认容器名称是否为 `lugang-ai-app`
3. **检查网络配置**: 确认 Docker 网络名称
4. **环境变量**: 确保所有必要的环境变量都已配置
5. **备份保留**: 建议保留至少 3 个最近的备份

---

## 部署历史

### 2026-03-02 - 修复商业版 API 错误提示

**问题描述**:
- 网站访问时出现大量"未配置商业版链接"的红色错误提示
- 错误涉及的 API：
  - `support,user,inform,getSystemMsgModal`
  - `support,user,inform,countUnread`
  - `support,user,inform,getOperationalAd`
  - `support,user,team,list`
  - `support,user,team,member,count`
  - `support,user,team,member,list`
  - `core,app,evaluation,list`
- 点击门户时出现客户端错误并跳回后台

**根本原因**:
- 鲁港通基于 FastGPT 开源版开发，代码中保留了商业版功能调用
- 这些功能需要连接 FastGPT 商业版服务器（通过 `PRO_URL` 环境变量配置）
- 由于鲁港通不需要商业版功能，未配置 `PRO_URL`
- `proApi/[...path].ts` 路由在检测到未配置时直接抛出错误，显示给用户

**解决方案**:
修改 `lugang-ai/projects/app/src/pages/api/proApi/[...path].ts` 文件：
1. 添加 `getEmptyResponse()` 函数，根据不同 API 路径返回合适的空数据
2. 将错误抛出改为返回空数据（优雅降级）
3. 支持的 API 类型：
   - 通知相关：返回空通知列表
   - 团队相关：返回空团队数据
   - 应用评估：返回空评估列表
   - 使用记录：返回空使用记录
   - 自定义域名：返回空域名列表
   - 审计日志：返回空日志列表

**修改文件**:
- `lugang-ai/projects/app/src/pages/api/proApi/[...path].ts`

**部署步骤**:
1. 提交代码到 GitHub
2. 等待 GitHub Actions 构建新镜像
3. 在服务器上拉取并部署新镜像

**预期效果**:
- 不再显示"未配置商业版链接"错误
- 商业版功能静默失败，返回空数据
- 网站正常访问，不影响核心功能

---

**创建时间**: 2026-03-01  
**版本**: 1.0  
**状态**: ✅ 已测试
