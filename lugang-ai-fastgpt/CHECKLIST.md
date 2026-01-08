# 鲁港通AI部署检查清单

## 📋 部署前检查

### 服务器环境
- [ ] 服务器IP: 156.225.30.134
- [ ] 内存: 7.6G (可用 4.3G+)
- [ ] 磁盘: /www 分区 33G+ 可用空间
- [ ] Docker已安装
- [ ] Docker Compose已安装

### 端口检查
- [ ] 3210 (鲁港通AI前端) - 未被占用
- [ ] 27017 (MongoDB) - 未被占用
- [ ] 5432 (PostgreSQL) - 未被占用
- [ ] 6380 (Redis) - 未被占用
- [ ] 8080 (One API) - 已运行

### 项目文件
- [ ] 项目已上传到 `/www/wwwroot/lugang-ai-fastgpt/`
- [ ] `docker-compose.yml` 存在
- [ ] `projects/app/.env.local` 存在
- [ ] `build.sh` 存在且可执行
- [ ] `deploy.sh` 存在且可执行

## 🔧 配置检查

### docker-compose.yml
- [ ] MongoDB配置正确
- [ ] PostgreSQL配置正确
- [ ] Redis端口改为6380（避免冲突）
- [ ] 可选服务已注释（minio、sandbox、plugin）
- [ ] lugang-ai依赖项已更新（移除minio）

### .env.local
- [ ] 数据库连接配置正确
- [ ] Redis URL正确
- [ ] One API配置正确（AIPROXY_API_ENDPOINT、AIPROXY_API_TOKEN）
- [ ] 可选服务配置已注释（PLUGIN_BASE_URL、SANDBOX_URL、S3_*）
- [ ] 默认密码已设置（DEFAULT_ROOT_PSW=LuGang@2025）

### 品牌定制文件
- [ ] `projects/app/data/config.json` - 系统标题改为"鲁港通AI助手"
- [ ] `packages/web/i18n/zh-CN/common.json` - 品牌文本替换
- [ ] `packages/web/i18n/zh-CN/chat.json` - 默认Slogan修改
- [ ] `packages/web/i18n/zh-CN/app.json` - 插件市场名称
- [ ] `packages/web/i18n/zh-CN/account_model.json` - 模型映射提示

## 🚀 部署步骤

### 1. 构建镜像
```bash
cd /www/wwwroot/lugang-ai-fastgpt
chmod +x build.sh
./build.sh
```
- [ ] 构建成功
- [ ] 镜像名称: lugang-ai:v1
- [ ] 镜像大小: ~600MB

### 2. 启动服务
```bash
chmod +x deploy.sh
./deploy.sh
```
- [ ] MongoDB容器启动成功
- [ ] PostgreSQL容器启动成功
- [ ] Redis容器启动成功
- [ ] lugang-ai-app容器启动成功

### 3. 验证服务
```bash
docker-compose ps
```
- [ ] 所有核心容器状态为 "Up"
- [ ] 没有错误日志

## ✅ 功能测试

### 1. 访问系统
- [ ] 访问 http://156.225.30.134:3210
- [ ] 页面正常加载
- [ ] 显示"鲁港通AI助手"品牌

### 2. 登录系统
- [ ] 使用账户 `root` 登录
- [ ] 使用密码 `LuGang@2025` 登录
- [ ] 登录成功

### 3. 修改密码
- [ ] 进入账户设置
- [ ] 修改默认密码
- [ ] 使用新密码重新登录

### 4. 配置模型
- [ ] 进入"模型管理"
- [ ] 只激活DeepSeek模型
- [ ] 只激活Qwen模型
- [ ] 配置One API Token
- [ ] 保存配置

### 5. 创建应用
- [ ] 点击"创建应用"
- [ ] 选择"简单应用"
- [ ] 配置应用名称
- [ ] 选择DeepSeek模型
- [ ] 保存应用

### 6. 测试对话
- [ ] 进入应用对话界面
- [ ] 发送测试消息："你好"
- [ ] 收到AI回复
- [ ] 对话功能正常

### 7. 测试知识库（可选）
- [ ] 创建知识库
- [ ] 上传测试文档
- [ ] 文档解析成功
- [ ] 知识库搜索正常

### 8. 测试工作流（可选）
- [ ] 创建工作流应用
- [ ] 添加节点
- [ ] 连接节点
- [ ] 测试运行

## 🔍 问题排查

### 如果容器无法启动
```bash
# 查看容器日志
docker logs <容器名> --tail 50

# 检查端口占用
netstat -tulpn | grep <端口号>

# 重启容器
docker-compose restart <服务名>
```

### 如果应用报错
```bash
# 查看应用日志
docker logs lugang-ai-app -f

# 检查环境变量
docker exec lugang-ai-app env | grep MONGODB
docker exec lugang-ai-app env | grep REDIS
```

### 如果数据库连接失败
```bash
# 测试MongoDB
docker exec -it lugang-ai-mongo mongosh -u root -p password

# 测试PostgreSQL
docker exec -it lugang-ai-pg psql -U postgres

# 测试Redis
docker exec -it lugang-ai-redis redis-cli ping
```

## 📝 部署后任务

### 安全配置
- [ ] 修改所有默认密码
- [ ] 修改 `.env.local` 中的密钥
- [ ] 配置防火墙规则
- [ ] 配置SSL证书（如需要）

### 性能优化
- [ ] 监控资源使用（`docker stats`）
- [ ] 调整数据库连接池
- [ ] 配置日志轮转

### 备份配置
- [ ] 配置数据库自动备份
- [ ] 测试备份恢复流程
- [ ] 配置备份存储位置

### 监控配置
- [ ] 配置服务监控
- [ ] 配置告警通知
- [ ] 配置日志收集

## 🎯 验收标准

### 功能完整性
- [x] 核心对话功能正常
- [x] 知识库功能正常
- [x] 工作流功能正常
- [x] 用户管理功能正常
- [x] 模型管理功能正常

### 品牌定制
- [x] 系统标题显示"鲁港通AI助手"
- [x] 默认Slogan正确
- [x] 隐藏GitHub链接
- [x] 隐藏应用商店
- [x] 只显示国产模型

### 性能要求
- [ ] 页面加载时间 < 3秒
- [ ] 对话响应时间 < 5秒
- [ ] 系统稳定运行 24小时+
- [ ] 内存使用 < 6GB
- [ ] CPU使用 < 80%

### 安全要求
- [ ] 所有默认密码已修改
- [ ] 防火墙已配置
- [ ] 只开放必要端口
- [ ] 数据库访问受限
- [ ] 日志记录完整

## 📞 技术支持

如遇问题，请提供：
1. 容器状态：`docker-compose ps`
2. 应用日志：`docker logs lugang-ai-app --tail 100`
3. 系统资源：`free -h` 和 `df -h`
4. 错误截图

---

**部署日期**: ___________
**部署人员**: ___________
**验收人员**: ___________
**验收日期**: ___________
