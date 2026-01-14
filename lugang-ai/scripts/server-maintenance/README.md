# 鲁港通 - 服务器维护脚本

## 概述

这套脚本用于安全地维护鲁港通服务器，包括备份、清理、验证和部署。

## 脚本执行顺序

```
01-full-backup.sh      → 完整备份当前状态
        ↓
02-check-unused-resources.sh → 检查无用资源（只检查不删除）
        ↓
03-safe-cleanup.sh     → 安全清理无用资源（需确认）
        ↓
04-verify-services.sh  → 验证所有服务正常
        ↓
05-final-backup.sh     → 创建最终干净备份
        ↓
06-pull-new-image.sh   → 拉取并部署新镜像
        ↓
07-rollback.sh         → 如有问题，回滚到之前版本
```

## 使用方法

### 1. 上传脚本到服务器

```bash
# 在本地执行
scp -r lugang-ai/scripts/server-maintenance root@156.225.30.134:/www/wwwroot/lugang-ai/scripts/
```

### 2. 设置执行权限

```bash
# 在服务器上执行
cd /www/wwwroot/lugang-ai/scripts/server-maintenance
chmod +x *.sh
```

### 3. 按顺序执行脚本

```bash
# 步骤 1: 完整备份
./01-full-backup.sh

# 步骤 2: 检查无用资源
./02-check-unused-resources.sh

# 步骤 3: 安全清理（可选）
./03-safe-cleanup.sh

# 步骤 4: 验证服务
./04-verify-services.sh

# 步骤 5: 创建最终备份
./05-final-backup.sh

# 步骤 6: 拉取新镜像
./06-pull-new-image.sh

# 如有问题: 回滚
./07-rollback.sh
```

## 脚本说明

### 01-full-backup.sh
- 备份 MongoDB 数据库
- 备份 PostgreSQL 数据库
- 备份 Redis 数据
- 备份配置文件
- 备份 Docker 卷数据
- 保存 Docker 状态信息

### 02-check-unused-resources.sh
- 检查停止的容器
- 检查悬空镜像
- 检查未使用的卷
- 检查未使用的网络
- **只检查，不删除任何内容**

### 03-safe-cleanup.sh
- 逐项确认后删除无用资源
- 保护核心容器/镜像/卷/网络
- 需要手动确认每个删除操作

### 04-verify-services.sh
- 检查容器状态
- 检查数据库连接
- 检查端口监听
- 检查 HTTP 服务
- 检查外部域名访问
- 检查日志错误

### 05-final-backup.sh
- 在确认功能正常后创建干净备份
- 包含恢复脚本
- 可选保存 Docker 镜像
- 可选删除旧备份

### 06-pull-new-image.sh
- 保存当前镜像信息（用于回滚）
- 登录 GitHub Container Registry
- 拉取新镜像
- 部署新容器
- 创建回滚脚本

### 07-rollback.sh
- 回滚 Docker 镜像
- 从备份恢复数据库
- 完整回滚（镜像 + 数据库）
- 查看可用备份

## 核心资源（不能删除）

### 容器
- `lugang-ai-app` - 鲁港通前端
- `lugang-ai-mongo` - MongoDB
- `lugang-ai-pg` - PostgreSQL
- `lugang-ai-redis` - Redis
- `lugang-enterprise` - 鲁港通后端

### 网络
- `lugang-ai-network`

### 端口
- 3210 - 鲁港通前端
- 8080 - 鲁港通后端
- 27017 - MongoDB
- 5432 - PostgreSQL
- 6379/6380 - Redis

## 配置信息

### 数据库密码
- MongoDB: `LuGang2024Secure`
- PostgreSQL: `LuGang2024Secure`

### 登录信息
- 用户名: `root`
- 密码: `LuGang@2025`

### 域名
- 鲁港通前端: https://www.airscend.com
- 鲁港通后端: https://api.airscend.com

## 备份位置

```
/www/wwwroot/backups/
├── lugang-backup-YYYYMMDD_HHMMSS/   # 初始备份
│   ├── mongodb/
│   ├── postgresql/
│   ├── redis/
│   ├── configs/
│   ├── volumes/
│   ├── docker/
│   └── BACKUP_INFO.txt
│
└── lugang-final-YYYYMMDD_HHMMSS/    # 最终备份
    ├── mongodb/
    ├── postgresql/
    ├── configs/
    ├── docker-images/
    ├── restore.sh
    └── BACKUP_INFO.txt
```

## 紧急回滚

如果新版本有问题，立即执行：

```bash
./07-rollback.sh
# 选择 1 回滚镜像，或选择 3 完整回滚
```

## 注意事项

1. **执行前确保有足够磁盘空间**（至少 10GB）
2. **按顺序执行脚本**，不要跳过步骤
3. **仔细阅读每个确认提示**
4. **保留至少一个可用备份**
5. **测试回滚流程**确保可以恢复
