# 鲁港通AI部署指南

## 服务架构

### 核心服务（必需）
- **MongoDB** (端口 27017) - 主数据库
- **PostgreSQL** (端口 5432) - 向量数据库（pgvector）
- **Redis** (端口 6380) - 缓存服务
- **鲁港通AI应用** (端口 3210) - 主应用

### 可选服务（已禁用）
- **MinIO** - 对象存储（文件上传功能需要）
- **Sandbox** - 代码沙箱（代码执行功能需要）
- **Plugin** - 插件服务（扩展功能需要）

> 注：可选服务已禁用，不影响核心功能（对话、知识库、工作流）

## 部署步骤

### 1. 上传项目到服务器
```bash
# 上传到服务器目录
/www/wwwroot/lugang-ai-fastgpt/
```

### 2. 构建镜像
```bash
cd /www/wwwroot/lugang-ai-fastgpt
chmod +x build.sh
./build.sh
```

### 3. 启动服务
```bash
chmod +x deploy.sh
./deploy.sh
```

### 4. 重新部署（修改配置后）
```bash
chmod +x redeploy.sh
./redeploy.sh
```

## 访问系统

- **访问地址**: http://156.225.30.134:3210
- **默认账户**: root
- **默认密码**: LuGang@2025

> ⚠️ 首次登录后请立即修改密码！

## 配置One API

### 1. 登录系统
访问 http://156.225.30.134:3210，使用默认账户登录

### 2. 进入模型管理
点击右上角头像 → 账户设置 → 模型管理

### 3. 配置模型
- 只激活 DeepSeek 和 Qwen 模型
- 配置 One API Token（从 http://156.225.30.134:8080 获取）

### 4. 测试对话
创建一个应用，选择 DeepSeek 模型，测试对话功能

## 常用命令

### 查看容器状态
```bash
cd /www/wwwroot/lugang-ai-fastgpt
docker-compose ps
```

### 查看应用日志
```bash
docker logs lugang-ai-app -f
```

### 查看所有容器日志
```bash
docker-compose logs -f
```

### 重启服务
```bash
docker-compose restart
```

### 停止服务
```bash
docker-compose down
```

### 启动服务
```bash
docker-compose up -d
```

## 故障排查

### 1. 容器无法启动
```bash
# 查看容器日志
docker logs <容器名> --tail 50

# 检查端口占用
netstat -tulpn | grep <端口号>
```

### 2. 数据库连接失败
```bash
# 检查MongoDB
docker exec -it lugang-ai-mongo mongosh -u root -p password

# 检查PostgreSQL
docker exec -it lugang-ai-pg psql -U postgres
```

### 3. Redis连接失败
```bash
# 检查Redis
docker exec -it lugang-ai-redis redis-cli ping
```

### 4. 应用无法访问
```bash
# 检查防火墙
firewall-cmd --list-ports

# 开放端口
firewall-cmd --zone=public --add-port=3210/tcp --permanent
firewall-cmd --reload
```

## 品牌定制说明

已完成以下品牌定制：

1. **系统标题**: FastGPT → 鲁港通AI助手
2. **默认Slogan**: 你好，我是鲁港通AI助手
3. **隐藏功能**: GitHub链接、应用商店
4. **模型限制**: 只显示国产模型（DeepSeek、Qwen）

## 配置文件说明

### docker-compose.yml
Docker编排配置，定义所有服务

### projects/app/.env.local
应用环境变量配置

### projects/app/data/config.json
系统配置（品牌定制）

### packages/web/i18n/zh-CN/*.json
中文语言包（品牌定制）

## 数据备份

### 备份数据
```bash
# 备份MongoDB
docker exec lugang-ai-mongo mongodump -u root -p password -o /backup

# 备份PostgreSQL
docker exec lugang-ai-pg pg_dump -U postgres postgres > backup.sql

# 备份Redis
docker exec lugang-ai-redis redis-cli --rdb /data/dump.rdb
```

### 恢复数据
```bash
# 恢复MongoDB
docker exec lugang-ai-mongo mongorestore -u root -p password /backup

# 恢复PostgreSQL
docker exec -i lugang-ai-pg psql -U postgres postgres < backup.sql
```

## 性能优化

### 1. 调整数据库连接池
编辑 `projects/app/.env.local`：
```bash
DB_MAX_LINK=20  # 根据服务器性能调整
```

### 2. 调整嵌入模型并发
```bash
EMBEDDING_CHUNK_SIZE=20  # 根据服务器性能调整
```

### 3. 监控资源使用
```bash
# 查看容器资源使用
docker stats

# 查看系统资源
free -h
df -h
```

## 安全建议

1. **修改默认密码**: 首次登录后立即修改
2. **修改密钥**: 修改 `.env.local` 中的所有密钥
3. **配置防火墙**: 只开放必要端口（3210）
4. **定期备份**: 每天备份数据库
5. **更新系统**: 定期更新Docker镜像

## 技术支持

如遇问题，请提供以下信息：
1. 容器状态：`docker-compose ps`
2. 应用日志：`docker logs lugang-ai-app --tail 100`
3. 系统资源：`free -h` 和 `df -h`
