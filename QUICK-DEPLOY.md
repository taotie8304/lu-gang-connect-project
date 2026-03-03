# 鲁港通 - 快速部署命令清单

## 前提条件
- 已成功推送代码到 GitHub
- GitHub Actions 已成功构建镜像
- 替换 `YOUR_GITHUB_USERNAME` 为你的实际 GitHub 用户名

---

## 一、检查现有环境（5 分钟）

```bash
# 连接服务器
ssh root@156.225.30.134

# 查看所有容器
docker ps -a

# 查看正在运行的容器
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

# 查看 MongoDB 容器
docker ps | grep mongo

# 查看磁盘空间
df -h
docker system df
```

---

## 二、完整备份（10 分钟）

```bash
# 设置备份变量
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups/lugang_backup_${BACKUP_DATE}"
mkdir -p ${BACKUP_DIR}

echo "备份目录: ${BACKUP_DIR}"

# 1. 备份 MongoDB
MONGO_CONTAINER=$(docker ps --filter "ancestor=mongo" --format "{{.Names}}" | head -1)
echo "MongoDB 容器: ${MONGO_CONTAINER}"

docker exec ${MONGO_CONTAINER} mongodump --out=/tmp/backup
docker cp ${MONGO_CONTAINER}:/tmp/backup ${BACKUP_DIR}/mongodb_backup
docker exec ${MONGO_CONTAINER} rm -rf /tmp/backup

echo "✅ MongoDB 备份完成"

# 2. 备份当前镜像
CURRENT_IMAGE=$(docker ps --filter "name=lugang-ai-app" --format "{{.Image}}")
echo "当前镜像: ${CURRENT_IMAGE}"

docker commit lugang-ai-app lugang-ai-app:backup-${BACKUP_DATE}
docker save ${CURRENT_IMAGE} -o ${BACKUP_DIR}/lugang-ai-image.tar

echo "✅ 镜像备份完成"

# 3. 备份配置文件
cp /www/wwwroot/lugang-ai/docker-compose.prod.yml ${BACKUP_DIR}/ 2>/dev/null || true
cp /www/wwwroot/lugang-ai/.env ${BACKUP_DIR}/ 2>/dev/null || true
cp /www/wwwroot/lugang-ai/deploy-prod.sh ${BACKUP_DIR}/ 2>/dev/null || true

echo "✅ 配置文件备份完成"

# 4. 创建备份清单
cat > ${BACKUP_DIR}/backup_info.txt << EOF
备份时间: ${BACKUP_DATE}
备份路径: ${BACKUP_DIR}
MongoDB 容器: ${MONGO_CONTAINER}
当前镜像: ${CURRENT_IMAGE}
EOF

cat ${BACKUP_DIR}/backup_info.txt

echo ""
echo "=========================================="
echo "✅ 备份完成！"
echo "备份位置: ${BACKUP_DIR}"
echo "=========================================="
```

---

## 三、部署新镜像（5 分钟）

### 方法一：使用 docker-compose（推荐）

```bash
# 进入项目目录
cd /www/wwwroot/lugang-ai

# 拉取最新镜像（替换 YOUR_GITHUB_USERNAME）
docker pull ghcr.io/YOUR_GITHUB_USERNAME/lugang-ai:latest

# 停止并重启服务
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f --tail 100
```

### 方法二：使用部署脚本

```bash
cd /www/wwwroot/lugang-ai

# 拉取最新镜像
docker pull ghcr.io/YOUR_GITHUB_USERNAME/lugang-ai:latest

# 执行部署脚本
./deploy-prod.sh

# 查看日志
docker logs lugang-ai-app -f --tail 100
```

### 方法三：手动部署

```bash
# 拉取最新镜像
docker pull ghcr.io/YOUR_GITHUB_USERNAME/lugang-ai:latest

# 停止并删除旧容器
docker stop lugang-ai-app
docker rm lugang-ai-app

# 启动新容器（根据实际配置调整）
docker run -d \
  --name lugang-ai-app \
  --restart always \
  -p 3210:3000 \
  -e MONGODB_URI="mongodb://mongo:27017/fastgpt" \
  -e ONE_API_URL="https://api.airscend.com" \
  -e ONE_API_TOKEN="your-token-here" \
  --network lugang-network \
  ghcr.io/YOUR_GITHUB_USERNAME/lugang-ai:latest

# 查看日志
docker logs lugang-ai-app -f --tail 100
```

---

## 四、验证部署（3 分钟）

```bash
# 1. 检查容器状态
docker ps | grep lugang-ai-app

# 2. 查看容器日志（检查是否有错误）
docker logs lugang-ai-app --tail 50

# 3. 检查容器健康状态
docker inspect lugang-ai-app | grep -A 5 "Status"

# 4. 测试应用响应
curl -I http://localhost:3210

# 5. 从外部测试（如果配置了域名）
curl -I https://www.airscend.com

# 6. 测试 API 端点
curl https://www.airscend.com/api/recharge/packages

# 7. 检查资源使用
docker stats lugang-ai-app --no-stream
```

---

## 五、回滚（如果需要）

### 快速回滚到备份镜像

```bash
# 停止新容器
docker stop lugang-ai-app
docker rm lugang-ai-app

# 使用备份镜像启动（使用上面记录的 BACKUP_DATE）
docker run -d \
  --name lugang-ai-app \
  --restart always \
  -p 3210:3000 \
  -e MONGODB_URI="mongodb://mongo:27017/fastgpt" \
  -e ONE_API_URL="https://api.airscend.com" \
  -e ONE_API_TOKEN="your-token-here" \
  --network lugang-network \
  lugang-ai-app:backup-${BACKUP_DATE}

echo "✅ 已回滚到备份镜像"
```

### 恢复数据库（如果需要）

```bash
# 恢复 MongoDB
MONGO_CONTAINER=$(docker ps --filter "ancestor=mongo" --format "{{.Names}}" | head -1)

docker cp ${BACKUP_DIR}/mongodb_backup ${MONGO_CONTAINER}:/tmp/backup
docker exec ${MONGO_CONTAINER} mongorestore /tmp/backup
docker exec ${MONGO_CONTAINER} rm -rf /tmp/backup

echo "✅ 数据库已恢复"
```

---

## 六、清理旧镜像（可选）

```bash
# 查看所有镜像
docker images | grep lugang-ai

# 删除未使用的镜像（谨慎操作）
docker image prune -a

# 或者手动删除特定镜像
docker rmi <image-id>
```

---

## 常见问题排查

### 问题 1：容器无法启动
```bash
# 查看详细日志
docker logs lugang-ai-app --tail 200

# 检查容器配置
docker inspect lugang-ai-app

# 检查端口占用
netstat -tulpn | grep 3210
```

### 问题 2：数据库连接失败
```bash
# 检查 MongoDB 容器状态
docker ps | grep mongo

# 测试数据库连接
docker exec -it ${MONGO_CONTAINER} mongosh

# 检查网络连接
docker network inspect lugang-network
```

### 问题 3：镜像拉取失败
```bash
# 检查 GitHub 镜像仓库
# 访问: https://github.com/YOUR_GITHUB_USERNAME?tab=packages

# 手动登录 GitHub Container Registry
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# 重新拉取
docker pull ghcr.io/YOUR_GITHUB_USERNAME/lugang-ai:latest
```

---

## 监控命令

```bash
# 实时查看日志
docker logs lugang-ai-app -f

# 查看错误日志
docker logs lugang-ai-app 2>&1 | grep -i error

# 查看警告日志
docker logs lugang-ai-app 2>&1 | grep -i warn

# 监控资源使用
watch -n 2 'docker stats lugang-ai-app --no-stream'

# 查看容器进程
docker top lugang-ai-app
```

---

## 重要提示

1. ✅ **备份优先**: 始终先备份再部署
2. ✅ **验证镜像**: 确认 GitHub Actions 构建成功
3. ✅ **检查日志**: 部署后立即检查日志
4. ✅ **测试功能**: 验证关键功能是否正常
5. ✅ **保留备份**: 至少保留 3 个最近的备份

---

**创建时间**: 2026-03-01  
**适用版本**: 4.14.4  
**状态**: ✅ 已验证
