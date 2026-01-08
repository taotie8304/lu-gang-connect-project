# 鲁港通AI - 部署检查清单

## 📋 部署前检查

### 环境准备
- [ ] 服务器可访问 (156.225.30.134)
- [ ] 已安装宝塔面板
- [ ] 已安装Docker (版本 ≥ 20.10)
- [ ] 已安装Docker Compose (版本 ≥ 2.0)
- [ ] One API服务运行正常 (端口8080)
- [ ] 服务器磁盘空间 ≥ 20GB

### 端口检查
```bash
# 检查端口是否被占用
netstat -tulpn | grep -E '27017|5432|6380|3210'
```

- [ ] 27017 (MongoDB) - 未占用或可修改
- [ ] 5432 (PostgreSQL) - 未占用或可修改
- [ ] 6380 (Redis) - 未占用或可修改
- [ ] 3210 (FastGPT) - 未占用或可修改

---

## 🔐 安全配置检查

### 密码配置
- [ ] MongoDB密码已修改（不使用`password`）
- [ ] PostgreSQL密码已修改（不使用`password`）
- [ ] TOKEN_KEY已生成随机值（32位）
- [ ] FILE_TOKEN_KEY已生成随机值（32位）
- [ ] AES256_SECRET_KEY已生成随机值（32位）
- [ ] ROOT_KEY已生成随机值（32位）
- [ ] DEFAULT_ROOT_PSW已设置强密码

### 密码一致性检查
- [ ] `.env.local`中的MongoDB密码 = `docker-compose.yml`中的密码
- [ ] `.env.local`中的PostgreSQL密码 = `docker-compose.yml`中的密码

### One API配置
- [ ] AIPROXY_API_TOKEN已替换为真实Token（不是`sk-your-oneapi-token`）
- [ ] AIPROXY_API_ENDPOINT正确（http://156.225.30.134:8080）
- [ ] One API中已配置DeepSeek模型
- [ ] One API中已配置Qwen模型

---

## 📦 代码准备检查

### GitHub仓库
- [ ] 代码已推送到GitHub
- [ ] `.gitignore`已配置（排除.env.local和data/）
- [ ] `.env.local.example`模板文件已创建
- [ ] `docker-compose.yml.example`模板文件已创建
- [ ] README.md已更新

### 文件完整性
- [ ] `projects/app/public/icon/logo.png` 存在
- [ ] `projects/app/public/favicon.png` 存在
- [ ] `projects/app/public/imgs/chat/lugang_chat_diagram.png` 存在
- [ ] `projects/app/data/config.json` 配置正确
- [ ] `packages/web/i18n/zh-CN/chat.json` Slogan正确

---

## 🚀 部署执行检查

### 步骤1: 克隆代码
```bash
cd /www/wwwroot
git clone https://github.com/taotie8304/lu-gang-connect-project.git
cd lu-gang-connect-project/lugang-ai-fastgpt
```
- [ ] 代码克隆成功
- [ ] 进入正确目录

### 步骤2: 配置环境
```bash
cp projects/app/.env.local.example projects/app/.env.local
vim projects/app/.env.local
```
- [ ] 环境变量文件已创建
- [ ] 所有必填项已配置
- [ ] 密码已修改

### 步骤3: 修改docker-compose.yml
```bash
vim docker-compose.yml
```
- [ ] MongoDB密码已修改
- [ ] PostgreSQL密码已修改
- [ ] 端口映射已确认（无冲突）

### 步骤4: 构建镜像
```bash
docker build --no-cache -t lugang-ai:v1 -f projects/app/Dockerfile .
```
- [ ] 构建开始
- [ ] 无错误信息
- [ ] 镜像创建成功

**预计时间**: 15-30分钟

### 步骤5: 启动服务
```bash
docker-compose up -d
```
- [ ] 所有容器启动成功
- [ ] 无错误日志

### 步骤6: 查看日志
```bash
docker-compose logs -f lugang-ai
```
- [ ] 看到 "Server listening on port 3000"
- [ ] 看到 "Load models success"
- [ ] 无错误信息

---

## ✅ 部署验证检查

### 服务状态检查
```bash
docker-compose ps
```
- [ ] lugang-ai-app: Up (healthy)
- [ ] lugang-ai-mongo: Up
- [ ] lugang-ai-pg: Up
- [ ] lugang-ai-redis: Up

### 健康检查
```bash
curl -I http://localhost:3210/api/health
```
- [ ] 返回 HTTP/1.1 200 OK

### 前端访问检查
浏览器访问: `http://156.225.30.134:3210`

- [ ] 页面正常加载
- [ ] 看到"鲁港通AI助手"标题
- [ ] 看到鲁港通Logo
- [ ] 看到Slogan: "你好👋，我是鲁港通AI助手！"
- [ ] 无GitHub链接
- [ ] 无应用商店链接

### 登录测试
- [ ] 可以打开登录页面
- [ ] 使用root账号登录成功
- [ ] 进入管理后台

### 功能测试
- [ ] 可以创建新应用
- [ ] 可以看到模型列表
- [ ] 可以发起对话
- [ ] 对话功能正常（连接One API成功）

---

## 🔧 宝塔配置检查

### 防火墙规则
在宝塔面板 → 安全

- [ ] 已添加端口3210
- [ ] 端口状态: 开放
- [ ] 可以从外网访问

### 可选: 反向代理配置
如果需要使用域名访问:

- [ ] 已添加网站
- [ ] 已配置反向代理到3210端口
- [ ] 已配置SSL证书（可选）

---

## 📊 性能检查

### 资源使用
```bash
docker stats
```
- [ ] CPU使用率 < 80%
- [ ] 内存使用 < 4GB
- [ ] 磁盘IO正常

### 响应时间
```bash
time curl http://localhost:3210/api/health
```
- [ ] 响应时间 < 2秒

---

## 🔒 安全加固检查

### 数据库端口限制（可选但推荐）
修改`docker-compose.yml`:
```yaml
mongo:
  ports:
    - "127.0.0.1:27017:27017"  # 仅本地访问

pg:
  ports:
    - "127.0.0.1:5432:5432"  # 仅本地访问

redis:
  ports:
    - "127.0.0.1:6380:6379"  # 仅本地访问
```
- [ ] 已限制数据库端口为本地访问

### 防火墙规则
```bash
# 仅开放必要端口
firewall-cmd --list-ports
```
- [ ] 仅开放3210端口（FastGPT）
- [ ] 未开放27017（MongoDB）
- [ ] 未开放5432（PostgreSQL）
- [ ] 未开放6380（Redis）

---

## 📝 部署后任务

### 立即执行
- [ ] 修改root默认密码
- [ ] 创建普通用户账号
- [ ] 测试完整对话流程
- [ ] 配置One API中的模型

### 24小时内
- [ ] 设置数据备份计划
- [ ] 配置日志轮转
- [ ] 设置监控告警
- [ ] 记录管理员密码（安全存储）

### 一周内
- [ ] 性能调优
- [ ] 压力测试
- [ ] 用户培训
- [ ] 编写操作手册

---

## 🐛 故障排查检查

### 如果服务无法启动
- [ ] 检查端口占用: `netstat -tulpn | grep 3210`
- [ ] 检查日志: `docker-compose logs lugang-ai`
- [ ] 检查磁盘空间: `df -h`
- [ ] 检查Docker状态: `systemctl status docker`

### 如果数据库连接失败
- [ ] 检查密码是否一致
- [ ] 检查容器状态: `docker-compose ps`
- [ ] 检查网络: `docker network inspect lugang-ai-network`
- [ ] 重新初始化: `docker-compose down -v && docker-compose up -d`

### 如果One API连接失败
- [ ] 检查One API状态: `curl http://156.225.30.134:8080`
- [ ] 检查Token是否正确
- [ ] 检查网络连通性
- [ ] 查看FastGPT日志中的错误信息

---

## 📞 支持联系方式

### 技术支持
- 邮箱: support@lugangconnect.com
- GitHub: https://github.com/taotie8304/lu-gang-connect-project

### 文档资源
- 快速开始: `QUICK_START.md`
- 详细部署: `DEPLOYMENT_GUIDE_GITHUB.md`
- 代码Review: `CODE_REVIEW_REPORT.md`
- FastGPT官方: https://doc.fastgpt.in/

---

## ✅ 最终确认

部署完成后，请确认以下所有项目:

- [ ] 所有服务运行正常
- [ ] 前端可以正常访问
- [ ] 登录功能正常
- [ ] 对话功能正常
- [ ] 品牌定制正确显示
- [ ] 默认密码已修改
- [ ] 防火墙已配置
- [ ] 数据备份计划已设置

**签名**: ________________  
**日期**: ________________  
**部署人员**: ________________

---

**恭喜！鲁港通AI部署完成！** 🎉
