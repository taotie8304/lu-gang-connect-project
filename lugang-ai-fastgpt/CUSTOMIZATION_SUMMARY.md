# 鲁港通AI定制化总结

## 项目信息

- **项目名称**: 鲁港通AI助手
- **基础框架**: FastGPT 4.14.4
- **部署服务器**: 156.225.30.134
- **前端端口**: 3210
- **后端服务**: One API (端口 8080)

## 定制化内容

### 1. 品牌替换（5个文件）

#### 1.1 系统配置
**文件**: `projects/app/data/config.json`

修改内容：
- `systemTitle`: "FastGPT" → "鲁港通AI助手"
- `show_git`: true → false（隐藏GitHub链接）
- `show_appStore`: true → false（隐藏应用商店）

#### 1.2 通用文本
**文件**: `packages/web/i18n/zh-CN/common.json`

修改内容：
- 所有 "FastGPT" → "鲁港通AI助手"
- 所有 "fastgpt" → "lugang-ai"

#### 1.3 对话界面
**文件**: `packages/web/i18n/zh-CN/chat.json`

修改内容：
- `chat_box_default_slogan`: "你好，我是鲁港通AI助手"

#### 1.4 应用市场
**文件**: `packages/web/i18n/zh-CN/app.json`

修改内容：
- `plugin_store`: "FastGPT插件市场" → "鲁港通插件市场"

#### 1.5 模型管理
**文件**: `packages/web/i18n/zh-CN/account_model.json`

修改内容：
- 模型映射提示文本中的品牌名称

### 2. 环境配置

#### 2.1 数据库配置
```bash
# MongoDB
MONGODB_URI=mongodb://root:password@mongo:27017/lugang_ai?authSource=admin

# PostgreSQL (向量数据库)
PG_URL=postgresql://postgres:password@pg:5432/postgres

# Redis (端口改为6380避免冲突)
REDIS_URL=redis://redis:6379
```

#### 2.2 One API集成
```bash
AIPROXY_API_ENDPOINT=http://156.225.30.134:8080
AIPROXY_API_TOKEN=sk-your-oneapi-token
```

#### 2.3 功能开关
```bash
# 隐藏版权信息
HIDE_CHAT_COPYRIGHT_SETTING=true

# 关闭IP限流
USE_IP_LIMIT=false

# 不展示兑换码和优惠券
SHOW_COUPON=false
SHOW_DISCOUNT_COUPON=false
```

#### 2.4 可选服务（已禁用）
```bash
# 插件服务 - 已注释
# PLUGIN_BASE_URL=http://plugin:3003

# 代码沙箱 - 已注释
# SANDBOX_URL=http://sandbox:3002

# MinIO对象存储 - 已注释
# S3_ENDPOINT=minio
```

### 3. Docker配置

#### 3.1 核心服务
- **MongoDB** 5.0.18 (端口 27017)
- **PostgreSQL** pgvector:pg15 (端口 5432)
- **Redis** 7.2-alpine (端口 6380)
- **鲁港通AI应用** lugang-ai:v1 (端口 3210)

#### 3.2 禁用的可选服务
- **MinIO** - 对象存储（文件上传功能）
- **Sandbox** - 代码沙箱（代码执行功能）
- **Plugin** - 插件服务（扩展功能）

> 注：可选服务已禁用，不影响核心功能（对话、知识库、工作流）

### 4. 部署脚本

#### 4.1 构建脚本 (build.sh)
- 构建Docker镜像
- 镜像名称: lugang-ai:v1
- 镜像大小: ~600MB

#### 4.2 部署脚本 (deploy.sh)
- 停止旧容器
- 清理资源
- 启动新容器
- 显示状态和日志

#### 4.3 重新部署脚本 (redeploy.sh)
- 用于配置修改后重启
- 保留数据
- 快速重启

## 技术架构

### 服务架构
```
用户浏览器
    ↓
鲁港通AI前端 (:3210)
    ↓
One API后端 (:8080)
    ↓
DeepSeek/Qwen API
```

### 数据流
```
用户输入 → FastGPT处理 → One API转发 → 国产模型 → 返回结果
```

### 存储架构
```
MongoDB: 业务数据（用户、应用、对话等）
PostgreSQL: 向量数据（知识库嵌入）
Redis: 缓存数据（会话、临时数据）
```

## 功能特性

### 已实现功能
✅ AI对话（支持DeepSeek、Qwen）
✅ 知识库管理（RAG）
✅ 工作流编排
✅ 用户管理
✅ 模型管理
✅ 应用管理
✅ 团队协作

### 禁用功能
❌ 文件上传（需要MinIO）
❌ 代码执行（需要Sandbox）
❌ 插件扩展（需要Plugin）

### 品牌定制
✅ 系统标题替换
✅ 默认Slogan修改
✅ 隐藏GitHub链接
✅ 隐藏应用商店
✅ 只显示国产模型

## 模型配置

### 支持的模型
- **DeepSeek系列**
  - deepseek-chat
  - deepseek-coder
  
- **Qwen系列**
  - qwen-turbo
  - qwen-plus
  - qwen-max

### 模型管理
- 通过One API统一管理
- 在FastGPT中只显示激活的模型
- 可以自定义模型名称和参数

## 安全配置

### 默认密码
- **系统管理员**: root / LuGang@2025
- **MongoDB**: root / password
- **PostgreSQL**: postgres / password
- **MinIO**: minioadmin / minioadmin (已禁用)

> ⚠️ 生产环境请立即修改所有默认密码！

### 密钥配置
```bash
TOKEN_KEY=lugangai2025
FILE_TOKEN_KEY=lugangfile2025
AES256_SECRET_KEY=lugangaisecret2025
ROOT_KEY=lugangroot2025
```

> ⚠️ 生产环境请修改为随机字符串！

### 网络安全
- 只开放必要端口（3210）
- 数据库端口不对外暴露
- 使用Docker内部网络通信

## 性能优化

### 数据库连接
```bash
DB_MAX_LINK=10  # 最大连接数
```

### 嵌入模型
```bash
EMBEDDING_CHUNK_SIZE=10  # 单次并发量
```

### 工作流限制
```bash
WORKFLOW_MAX_RUN_TIMES=500  # 最大运行次数
WORKFLOW_MAX_LOOP_TIMES=50   # 最大循环次数
```

## 部署要求

### 服务器配置
- **CPU**: 2核+
- **内存**: 8GB+ (推荐)
- **磁盘**: 50GB+
- **系统**: Linux (CentOS/Ubuntu)

### 软件要求
- Docker 20.10+
- Docker Compose 2.0+
- 宝塔面板（可选）

### 网络要求
- 可访问DeepSeek API
- 可访问Qwen API
- 端口3210、8080可访问

## 维护指南

### 日常维护
```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker logs lugang-ai-app -f

# 重启服务
docker-compose restart

# 查看资源使用
docker stats
```

### 数据备份
```bash
# 备份MongoDB
docker exec lugang-ai-mongo mongodump -u root -p password -o /backup

# 备份PostgreSQL
docker exec lugang-ai-pg pg_dump -U postgres postgres > backup.sql
```

### 更新升级
```bash
# 重新构建镜像
./build.sh

# 重新部署
./redeploy.sh
```

## 已知问题

### 1. 可选服务无法启动
**问题**: MinIO、Sandbox、Plugin容器无法启动
**解决**: 已禁用这些可选服务，不影响核心功能

### 2. Redis端口冲突
**问题**: 宝塔面板已占用6379端口
**解决**: 将容器Redis端口改为6380

### 3. MinIO版本错误
**问题**: 2025-09-07版本不存在
**解决**: 已注释MinIO服务（可选功能）

## 下一步计划

### 短期计划
1. ✅ 完成核心服务部署
2. ⏳ 配置One API Token
3. ⏳ 测试对话功能
4. ⏳ 创建测试应用
5. ⏳ 验证知识库功能

### 中期计划
1. 配置SSL证书
2. 优化性能参数
3. 配置自动备份
4. 添加监控告警

### 长期计划
1. 启用MinIO（文件上传）
2. 启用Sandbox（代码执行）
3. 开发自定义插件
4. 集成更多国产模型

## 技术支持

### 文档
- `DEPLOY_GUIDE.md` - 部署指南
- `CHECKLIST.md` - 检查清单
- `README.md` - 项目说明

### 脚本
- `build.sh` - 构建镜像
- `deploy.sh` - 部署服务
- `redeploy.sh` - 重新部署

### 日志
```bash
# 应用日志
docker logs lugang-ai-app

# 数据库日志
docker logs lugang-ai-mongo
docker logs lugang-ai-pg

# 所有日志
docker-compose logs
```

---

**定制完成日期**: 2025-01-02
**版本**: v1.0
**基础框架**: FastGPT 4.14.4
