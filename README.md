# 鲁港通企业版 - Lu-Gang Connect Enterprise

## 🌉 项目简介

鲁港通企业版是一个基于Go语言开发的企业级AI管理平台，融合了One API v0.6.10的完整功能，专门为香港与山东之间的商务、文化、教育交流提供智能咨询服务。

### ✨ 核心特性

- 🏢 **企业级AI管理平台** - 完整的用户管理、API密钥管理、计费系统
- 🌉 **鲁港通专业知识库** - 香港⇄山东双向信息服务
- 🤖 **多AI模型支持** - 集成Deepseek、Qwen等主流AI模型
- 💼 **商业化就绪** - 适合政府演示、融资展示、商业部署
- 🔐 **企业级安全** - 完整的权限控制和数据保护
- 📊 **监控和日志** - 全面的系统监控和操作日志
- 🎯 **智能路由** - 自动根据问题类型选择最适合的AI模型

## 🏗️ 系统架构

```
鲁港通企业版
├── One API v0.6.10 核心          # AI模型管理和API代理
├── 鲁港通智能知识库              # 专业领域知识服务
├── 企业级用户管理                # 多租户、权限控制
├── API密钥和计费系统             # 商业化功能
└── 监控和日志系统                # 运维管理
```

## 🚀 快速开始

### 环境要求

- **Go 1.20+** (已验证兼容)
- **MySQL 8.0+** (推荐) 或 SQLite (开发环境)
- **Redis 6.0+** (可选，用于缓存)
- **Windows/Linux/macOS** 支持

### 编译和运行

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd lu-gang-connect-project
   ```

2. **编译企业版**
   ```bash
   cd lugang-connect-enterprise
   go mod tidy
   go build -o lugang-enterprise.exe main.go
   ```

3. **配置环境变量**
   ```bash
   # 复制环境变量模板
   cp .env.example .env
   
   # 编辑配置文件
   # 配置数据库连接、AI API密钥等
   ```

4. **启动服务**
   ```bash
   ./lugang-enterprise.exe
   ```

5. **访问系统**
   - 主页: http://localhost:3000
   - 管理后台: http://localhost:3000/admin
   - API文档: http://localhost:3000/docs

### 测试版本快速验证

如果您想快速验证系统功能，可以使用测试版本：

```bash
cd lugang-connect-enterprise
go build -o lugang-test.exe test_main.go
./lugang-test.exe
```

测试版本提供基本的API接口，无需数据库配置。

## 🎯 核心功能

### 1. 鲁港通智能问答
- **北向知识库**: 香港商务、金融、投资、物流信息
- **南向知识库**: 山东商务、文化、教育、旅游信息
- **智能路由**: 自动选择Deepseek(商务)或Qwen(文化)模型
- **多语言支持**: 简体中文、繁体中文、英语

### 2. 企业级管理
- **用户管理**: 多租户、角色权限、用户组织
- **API密钥管理**: 密钥生成、额度控制、使用统计
- **渠道管理**: 多AI模型渠道配置和负载均衡
- **计费系统**: 使用量统计、配额管理、账单生成

### 3. 系统监控
- **实时监控**: 系统状态、API调用、错误率
- **日志管理**: 操作日志、错误日志、审计日志
- **性能分析**: 响应时间、吞吐量、资源使用

## 📋 API接口

### 鲁港通专用接口

```bash
# 智能问答
POST /api/lugang/query
{
  "question": "香港股票交易时间是什么？",
  "language": "zh",
  "user_type": "business",
  "knowledge_base": "northbound"
}

# 演示接口
GET /api/lugang/demo

# 知识库查询
GET /api/lugang/knowledge/{type}
```

### 标准One API接口

```bash
# OpenAI兼容接口
POST /v1/chat/completions

# 模型列表
GET /v1/models

# 用户管理
GET /api/user
POST /api/user

# 渠道管理
GET /api/channel
POST /api/channel
```

## 🔧 配置说明

### 环境变量配置

```bash
# 数据库配置
SQL_DSN=mysql://user:password@localhost:3306/lugang_enterprise

# Redis配置
REDIS_CONN_STRING=localhost:6379

# AI模型API密钥
DEEPSEEK_API_KEY=sk-your-deepseek-key
QWEN_API_KEY=sk-your-qwen-key

# 系统配置
PORT=3000
SESSION_SECRET=your-secret-key
THEME=lugang

# 鲁港通专用配置
LUGANG_KNOWLEDGE_BASE_ENABLED=true
LUGANG_ENTERPRISE_MODE=true
```

### 数据库初始化

系统首次启动时会自动创建必要的数据表，包括：
- One API标准表结构
- 鲁港通扩展表结构
- 用户和权限表
- 日志和监控表

## 🚀 部署指南

### 堡塔面板部署

详细的部署指南请参考：[lugang-ai/DEPLOYMENT-GUIDE.md](lugang-ai/DEPLOYMENT-GUIDE.md)

### Docker部署

```bash
# 使用企业版内置的Docker配置
cd lugang-connect-enterprise
docker-compose up -d
```

### 生产环境部署

1. **系统要求**
   - 2核4G内存（最低配置）
   - 4核8G内存（推荐配置）
   - 20GB磁盘空间

2. **安全配置**
   - 配置HTTPS证书
   - 设置防火墙规则
   - 配置反向代理

3. **性能优化**
   - 数据库连接池优化
   - Redis缓存配置
   - 负载均衡设置

## 📊 商业价值

### 政府和企业应用
- **政府演示**: 展示智能政务服务能力
- **企业服务**: 提供专业的商务咨询服务
- **教育机构**: 文化教育信息查询服务
- **投资机构**: 投资政策和市场信息服务

### 技术优势
- **独立知识产权**: 基于开源项目的深度定制
- **企业级架构**: 支持大规模商业部署
- **专业领域**: 专注鲁港两地信息服务
- **AI技术**: 集成最新的AI模型和技术

## 🛠️ 开发指南

### 项目结构

```
lugang-connect-enterprise/
├── main.go                    # 主程序入口
├── test_main.go              # 测试版本
├── internal/lugang/          # 鲁港通专用模块
│   ├── handler/              # API处理器
│   ├── model/                # 数据模型
│   └── service/              # 业务逻辑
├── common/                   # 通用组件
├── controller/               # 控制器
├── middleware/               # 中间件
├── model/                    # 数据模型
├── relay/                    # AI模型代理
├── router/                   # 路由配置
└── web/                      # 前端资源
```

### 扩展开发

1. **添加新的AI模型**
   - 在 `relay/adaptor/` 目录添加适配器
   - 更新路由配置
   - 添加模型配置

2. **扩展知识库**
   - 修改 `internal/lugang/model/` 数据结构
   - 更新API处理逻辑
   - 添加新的查询接口

3. **自定义界面**
   - 修改 `web/` 目录下的前端资源
   - 更新主题配置
   - 添加新的页面组件

## 📞 技术支持

### 常见问题

1. **编译问题**
   - 确保Go版本 >= 1.20
   - 检查网络连接，确保能下载依赖包
   - 如遇CGO问题，安装C编译器或使用MySQL

2. **运行问题**
   - 检查端口是否被占用
   - 验证数据库连接配置
   - 查看日志文件排查错误

3. **性能问题**
   - 优化数据库查询
   - 启用Redis缓存
   - 调整并发参数

### 联系方式

- **项目地址**: [GitHub Repository]
- **技术文档**: [Documentation]
- **问题反馈**: [Issues]

## 📄 许可证

本项目基于开源项目进行深度定制和集成，适用于商业使用。

## 🎉 更新日志

### v1.0.0 (2024-12-30)
- ✅ 完成One API v0.6.10集成
- ✅ 实现鲁港通专业知识库
- ✅ 添加企业级用户管理
- ✅ 集成Deepseek和Qwen AI模型
- ✅ 完成基本功能测试
- ✅ 提供堡塔面板部署支持

---

**鲁港通企业版 - 连接香港与山东的智能信息桥梁** 🌉