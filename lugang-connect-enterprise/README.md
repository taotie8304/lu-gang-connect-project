# 鲁港通企业版

> 智能双语知识库系统 - 企业级AI管理平台

## 🌟 项目简介

鲁港通企业版是一个融合了AI模型管理和专业知识库的企业级智能系统，专门服务于香港与山东之间的经济文化交流。

### 核心特性

- 🤖 **多AI模型管理**：统一管理Deepseek、Qwen等多个AI模型
- 🌉 **专业知识库**：鲁港经济文化交流专业内容
- 💼 **企业级功能**：用户管理、权限控制、计费系统
- 🎯 **智能问答**：基于知识库和AI模型的智能回答
- 📊 **数据分析**：使用统计和业务分析
- 🔒 **安全可靠**：企业级安全和隐私保护

## 🚀 快速开始

### 方式一：使用预构建镜像（推荐）

```bash
# 拉取最新镜像
docker pull ghcr.io/taotie8304/lugang-enterprise:latest

# 运行容器
docker run -d \
  --name lugang-enterprise \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -e SQL_DSN="your_database_connection_string" \
  -e SESSION_SECRET="your_session_secret" \
  ghcr.io/taotie8304/lugang-enterprise:latest
```

### 方式二：Docker Compose 部署

```bash
# 1. 创建配置文件
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等

# 2. 启动服务
docker-compose up -d
```

### 环境要求

- Docker 20.0+
- Docker Compose 2.0+
- MySQL 5.6+ 或 8.0+
- 4GB+ 内存
- 10GB+ 磁盘空间

### 一键启动（本地构建）

**Linux/Mac:**
```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

**Windows:**
```cmd
scripts\\start.bat
```

### 配置API密钥

1. 编辑 `.env` 文件
2. 设置以下密钥：
   ```
   DEEPSEEK_API_KEY=sk-your-deepseek-key
   QWEN_API_KEY=sk-your-qwen-key
   ```
3. 重启服务：`docker-compose restart`

## 📋 功能模块

### 1. AI模型管理
- 支持多种主流AI模型
- 负载均衡和故障转移
- 使用统计和成本控制

### 2. 鲁港通知识库
- 香港商务、金融、投资信息
- 山东文化、教育、旅游资源
- 智能检索和推荐

### 3. 用户管理
- 多租户支持
- 角色权限控制
- 使用配额管理

### 4. 企业功能
- API密钥管理
- 计费和结算
- 监控和告警

## 🏗️ 技术架构

```
前端界面 (React)
    ↓
API网关 (Gin)
    ↓
业务逻辑层
├── AI模型管理
├── 知识库服务
├── 用户管理
└── 计费系统
    ↓
数据存储层
├── MySQL (业务数据)
└── Redis (缓存)
```

## 📊 商业价值

### 目标市场
- 政府机构：香港-山东合作项目
- 企业客户：跨境投资和贸易
- 教育机构：文化交流和学术合作
- 个人用户：投资咨询和文化了解

### 收入模式
- SaaS订阅服务
- 私有部署授权
- API调用计费
- 专业咨询服务

## 🔧 开发指南

### 项目结构
```
lugang-connect-enterprise/
├── cmd/                    # 主程序入口
├── internal/
│   ├── lugang/            # 鲁港通功能模块
│   ├── common/            # 共享组件
│   └── config/            # 配置管理
├── web/                   # 前端资源
├── docs/                  # 文档
├── deploy/                # 部署配置
└── scripts/               # 构建脚本
```

### 开发环境
```bash
# 安装依赖
go mod download

# 启动开发服务
go run main.go

# 构建生产版本
go build -o lugang-enterprise
```

## 📈 路线图

### v1.0 (当前版本)
- [x] 基础AI模型管理
- [x] 鲁港通知识库
- [x] 用户管理系统
- [x] 基础计费功能

### v1.1 (计划中)
- [ ] 移动端支持
- [ ] 更多AI模型接入
- [ ] 高级分析功能
- [ ] 多语言支持

### v2.0 (未来版本)
- [ ] 微信小程序
- [ ] 企业级SSO
- [ ] 高级权限管理
- [ ] 自定义知识库

## 📞 联系我们

- 项目主页：[待定]
- 技术支持：[待定]
- 商务合作：[待定]

## 📄 许可证

本项目采用商业许可证，未经授权不得用于商业用途。

---

© 2024 鲁港通团队. 保留所有权利.