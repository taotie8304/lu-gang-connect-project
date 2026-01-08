# 鲁港通AI助手 - 部署与配置指南

基于 FastGPT 4.14.4 深度定制

---

## 📋 目录

1. [系统概述](#系统概述)
2. [品牌定制说明](#品牌定制说明)
3. [环境要求](#环境要求)
4. [快速部署](#快速部署)
5. [配置说明](#配置说明)
6. [模型管理](#模型管理)
7. [常见问题](#常见问题)

---

## 系统概述

**鲁港通AI助手**是基于开源项目 FastGPT 4.14.4 进行品牌定制的AI知识库问答系统，专为鲁港经贸教育科技文旅方向打造。

### 核心特性

- ✅ **完整的RAG知识库**：支持PDF、Word、Excel等多种格式文档
- ✅ **可视化工作流编排**：拖拽式设计复杂业务流程
- ✅ **API对外发布**：兼容OpenAI API格式，可直接对接App/小程序
- ✅ **国产模型支持**：集成DeepSeek、Qwen等国产大模型
- ✅ **品牌完全定制**：无任何第三方品牌标识

### 技术架构

```
前端: Next.js 14 + Chakra UI + TypeScript
后端: Next.js API Routes
数据库: MongoDB 5.0 + PostgreSQL 15 (pgvector)
缓存: Redis 7.2
对象存储: MinIO
模型接入: One API
```

---

## 品牌定制说明

### 已完成的定制项

| 定制项 | 原始值 | 定制值 | 文件位置 |
|--------|--------|--------|----------|
| 系统标题 | FastGPT | 鲁港通AI助手 | `config.json` |
| 默认Slogan | 你好，我是FastGPT | 你好，我是鲁港通AI助手 | `i18n/zh-CN/chat.json` |
| GitHub链接 | 显示 | 隐藏 | `config.json` |
| 应用商店 | 显示 | 隐藏 | `config.json` |
| 文档链接 | doc.fastgpt.io | lugangconnect.com/docs | `config.json` |
| 联系方式 | FastGPT社区 | 鲁港通科技 | `config.json` |
| 插件市场 | FastGPT插件市场 | 插件市场 | `i18n/zh-CN/app.json` |

### 品牌资源位置

```
静态资源目录: projects/app/public/
├── icon/
│   ├── logo.svg          # 主Logo（需替换）
│   └── login-bg.svg      # 登录背景（可选替换）
├── favicon.ico           # 浏览器图标（需替换）
└── imgs/
    └── chat/
        └── lugang_chat_diagram.png  # 聊天流程图（可选）
```

---

## 环境要求

### 硬件要求

- CPU: 4核心以上
- 内存: 8GB以上（推荐16GB）
- 磁盘: 50GB以上可用空间
- 网络: 稳定的互联网连接

### 软件要求

- Docker 20.10+
- Docker Compose 2.0+
- 操作系统: Linux / macOS / Windows (with WSL2)

### 端口要求

确保以下端口未被占用：

- `3210` - 鲁港通AI主应用
- `27017` - MongoDB
- `5432` - PostgreSQL
- `6379` - Redis
- `9000` - MinIO API
- `9001` - MinIO Console

---

## 快速部署

### 步骤1: 构建镜像

```bash
cd lugang-ai-fastgpt
chmod +x build.sh
./build.sh
```

构建时间约 10-20 分钟，取决于网络速度。

### 步骤2: 配置环境变量

编辑 `projects/app/.env.local` 文件：

```bash
# 重点配置项
DEFAULT_ROOT_PSW=LuGang@2025          # root密码（首次登录后请修改）
AIPROXY_API_ENDPOINT=http://your-oneapi:8080  # One API地址
AIPROXY_API_TOKEN=sk-xxxxx            # One API Token
FE_DOMAIN=http://156.225.30.134:3210  # 前端访问地址
```

### 步骤3: 启动服务

```bash
chmod +x deploy.sh
./deploy.sh start
```

### 步骤4: 访问系统

打开浏览器访问: `http://156.225.30.134:3210`

- 默认账户: `root`
- 默认密码: `LuGang@2025`

**⚠️ 首次登录后请立即修改密码！**

---

## 配置说明

### One API集成配置

鲁港通AI通过One API统一管理所有AI模型。

#### 1. 在One API中配置模型

登录你的One API管理后台，添加以下渠道：

```
渠道1: DeepSeek
- 模型: deepseek-chat, deepseek-coder
- API Key: sk-xxxxx

渠道2: 阿里云Qwen
- 模型: qwen-max, qwen-plus, qwen-vl-plus
- API Key: sk-xxxxx
```

#### 2. 在鲁港通AI中配置

编辑 `.env.local`:

```bash
AIPROXY_API_ENDPOINT=http://156.225.30.134:8080
AIPROXY_API_TOKEN=sk-your-oneapi-token
```

重启服务:

```bash
./deploy.sh restart
```

### 数据库配置

#### MongoDB连接

```bash
MONGODB_URI=mongodb://root:password@mongo:27017/lugang_ai?authSource=admin
```

#### PostgreSQL连接（向量库）

```bash
PG_URL=postgresql://postgres:password@pg:5432/postgres
```

#### Redis连接

```bash
REDIS_URL=redis://redis:6379
```

### 对象存储配置

使用内置的MinIO服务：

```bash
S3_ENDPOINT=minio
S3_PORT=9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_PUBLIC_BUCKET=lugang-public
S3_PRIVATE_BUCKET=lugang-private
```

---

## 模型管理

### Root用户模型配置流程

#### 1. 登录Root账户

使用 `root` 账户登录系统。

#### 2. 进入模型管理

导航路径: `账户设置` → `模型管理`

#### 3. 激活模型

在"激活模型"标签页中，只勾选你需要的模型：

- ✅ deepseek-chat
- ✅ deepseek-coder
- ✅ qwen-max
- ✅ qwen-plus
- ✅ qwen-vl-plus

**不要勾选任何境外模型（如GPT-4、Claude等）**

#### 4. 配置模型参数

在"配置模型"标签页中，为每个模型设置：

- 最大Token数
- 温度参数
- 价格（可选）

#### 5. 保存配置

点击"保存"按钮，配置立即生效。

### 普通用户视角

普通用户登录后，在模型选择器中**只能看到root用户激活的模型**。

这确保了：
- ❌ 不会出现任何境外模型
- ✅ 只显示国产模型（DeepSeek、Qwen）
- ✅ 品牌完全统一

---

## 常见问题

### Q1: 构建镜像失败怎么办？

**A:** 检查以下几点：
1. Docker是否正常运行: `docker ps`
2. 磁盘空间是否充足: `df -h`
3. 网络是否正常: `ping registry.npmmirror.com`
4. 查看详细错误日志

### Q2: 启动后无法访问怎么办？

**A:** 检查步骤：
1. 查看容器状态: `docker-compose ps`
2. 查看应用日志: `./deploy.sh logs`
3. 检查端口占用: `netstat -tulpn | grep 3210`
4. 检查防火墙设置

### Q3: 如何连接到已有的One API？

**A:** 修改 `.env.local` 文件：

```bash
AIPROXY_API_ENDPOINT=http://your-oneapi-host:port
AIPROXY_API_TOKEN=sk-your-token
```

然后重启服务: `./deploy.sh restart`

### Q4: 如何备份数据？

**A:** 备份数据目录：

```bash
# 停止服务
./deploy.sh stop

# 备份数据
tar -czf lugang-ai-backup-$(date +%Y%m%d).tar.gz data/

# 启动服务
./deploy.sh start
```

### Q5: 如何升级系统？

**A:** 升级流程：

```bash
# 1. 备份数据
./deploy.sh stop
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 2. 拉取新代码
git pull

# 3. 重新构建
./build.sh

# 4. 启动服务
./deploy.sh start
```

### Q6: 忘记root密码怎么办？

**A:** 重置密码：

```bash
# 1. 停止服务
./deploy.sh stop

# 2. 修改 .env.local 中的 DEFAULT_ROOT_PSW
# 3. 启动服务（会自动重置密码）
./deploy.sh start
```

### Q7: 如何查看系统日志？

**A:** 查看日志命令：

```bash
# 查看主应用日志
./deploy.sh logs

# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f mongo
docker-compose logs -f pg
```

---

## 技术支持

如有问题，请联系：

- 📧 邮箱: support@lugangconnect.com
- 🌐 官网: https://lugangconnect.com
- 📱 电话: [待补充]

---

## 版本信息

- **当前版本**: v1.0.0
- **基于**: FastGPT 4.14.4
- **构建日期**: 2025-01-02
- **维护团队**: 鲁港通科技

---

## 许可证

本项目基于 Apache 2.0 协议开源的 FastGPT 进行定制开发。

原项目地址: https://github.com/labring/FastGPT
