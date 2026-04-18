# 鲁港通 - 聊天显示优化功能部署指南

## 前置条件
- SSH 连接到服务器：`ssh root@156.225.30.134`
- 确保有足够的磁盘空间（至少 10GB）

## 部署步骤

### 方式一：使用自动化脚本（推荐）

```bash
# 1. 上传脚本到服务器
scp deploy-chat-optimization.sh root@156.225.30.134:/tmp/

# 2. SSH 连接到服务器
ssh root@156.225.30.134

# 3. 赋予执行权限
chmod +x /tmp/deploy-chat-optimization.sh

# 4. 执行部署脚本
/tmp/deploy-chat-optimization.sh
```

### 方式二：手动执行（逐步操作）

#### 第一步：备份数据

```bash
# 创建备份目录
BACKUP_DIR="/www/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cd /www/wwwroot/lugang-ai

# 备份 MongoDB
docker exec lugang-ai-mongo-1 mongodump --out /tmp/mongodb_backup
docker cp lugang-ai-mongo-1:/tmp/mongodb_backup "$BACKUP_DIR/mongodb_backup"

# 备份 PostgreSQL
docker exec lugang-ai-pg-1 pg_dumpall -U username > "$BACKUP_DIR/postgresql_backup.sql"

# 备份 MySQL（后端）
docker exec lugang-connect-mysql mysqldump -u root -p'123456' --all-databases > "$BACKUP_DIR/mysql_backup.sql"

# 备份 Redis
docker exec lugang-ai-redis-1 redis-cli SAVE
docker cp lugang-ai-redis-1:/data/dump.rdb "$BACKUP_DIR/redis_dump.rdb"

# 备份配置文件
cp docker-compose.yml "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/" 2>/dev/null || true

# 备份容器列表
docker ps -a > "$BACKUP_DIR/containers_list.txt"
docker images > "$BACKUP_DIR/images_list.txt"

echo "备份完成: $BACKUP_DIR"
```

#### 第二步：清理旧备份

```bash
# 删除7天前的备份
find /www/backup -type d -name "20*" -mtime +7 -exec rm -rf {} + 2>/dev/null || true
```

#### 第三步：停止并清理容器

```bash
cd /www/wwwroot/lugang-ai

# 停止所有容器
docker-compose down

# 清理停止的容器
docker container prune -f

# 清理悬空镜像
docker image prune -f

# （可选）清理未使用的镜像
# docker image prune -a -f --filter "until=168h"
```

#### 第四步：拉取最新镜像

```bash
cd /www/wwwroot/lugang-ai

# 拉取前端镜像
docker pull ghcr.io/taotie8304/lugang-ai:latest

# 拉取后端镜像
docker pull ghcr.io/taotie8304/lugang-enterprise:latest
```

#### 第五步：启动新容器

```bash
cd /www/wwwroot/lugang-ai

# 启动前端服务
docker-compose up -d

# 等待服务启动
sleep 30

# 检查容器状态
docker-compose ps

# 查看前端日志
docker-compose logs --tail=50 lugang-ai

# 检查后端服务
docker ps | grep lugang-connect
```

#### 第六步：验证功能

访问以下地址测试：
- 前端：https://www.airscend.com
- 后端：https://api.airscend.com

验证清单：
- [ ] AI 回复中不显示图片
- [ ] 思考模式有灰色背景（#F7F8FA）
- [ ] 普通用户看不到引用标记 [1], [2] 等
- [ ] 表格渲染正确，没有 `<br>` 标签
- [ ] 移动端显示正常（用手机浏览器测试）

## 回滚步骤（如果需要）

```bash
cd /www/wwwroot/lugang-ai

# 停止当前容器
docker-compose down

# 恢复备份的配置文件
BACKUP_DIR="/www/backup/最新的备份目录"
cp "$BACKUP_DIR/docker-compose.yml" .
cp "$BACKUP_DIR/.env" .

# 使用旧镜像（需要指定具体的 tag）
# 或者从备份中恢复镜像
docker-compose up -d
```

## 故障排查

### 容器无法启动
```bash
# 查看容器日志
docker-compose logs lugang-ai

# 查看所有容器状态
docker ps -a

# 检查端口占用
netstat -tulpn | grep 3210
```

### 数据库连接失败
```bash
# 检查数据库容器状态
docker ps | grep mongo
docker ps | grep postgres
docker ps | grep mysql

# 查看数据库日志
docker logs lugang-ai-mongo-1
docker logs lugang-ai-pg-1
docker logs lugang-connect-mysql
```

### 镜像拉取失败
```bash
# 检查网络连接
ping ghcr.io

# 手动登录 GitHub Container Registry（如果需要）
docker login ghcr.io -u taotie8304

# 重试拉取
docker pull ghcr.io/taotie8304/lugang-ai:latest
```

## 注意事项

1. **备份重要性**：每次部署前必须备份，备份是恢复的唯一保障
2. **磁盘空间**：确保 `/www/backup` 有足够空间（建议至少 10GB）
3. **服务中断**：部署过程中服务会短暂中断（约1-2分钟）
4. **数据库密码**：脚本中的数据库密码需要根据实际情况修改
5. **后端服务**：后端服务不在 docker-compose 中，需要单独管理

## 联系方式

如有问题，请联系技术支持。
