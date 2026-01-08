# 鲁港通企业版 - 堡塔面板v11 Docker部署指南

## ⚠️ 重要说明

**你有两种部署方式可选：**
- **方式A：使用Compose编排（推荐）** - 自动构建镜像，配置简单
- **方式B：手动创建容器** - 需要先构建镜像，配置复杂

---

## 方式A：使用Compose编排（推荐）

### 步骤1：上传项目
将 `lugang-connect-enterprise` 文件夹上传到 `/www/wwwroot/`

### 步骤2：创建Compose项目
1. 点击左侧 **Docker** → **Compose/编排**
2. 点击 **添加/新建编排**
3. 填写：
   - 项目名称：`lugang-enterprise`
   - 项目路径：`/www/wwwroot/lugang-connect-enterprise`
4. 点击确定，然后点击 **构建** 或 **启动**
5. 等待10-20分钟构建完成

**这种方式会自动读取 docker-compose.yml 和 Dockerfile，自动构建镜像并启动容器。**

---

## 方式B：手动创建容器（如果Compose不可用）

如果你的堡塔面板没有Compose功能，需要手动操作：

### 步骤1：先用命令行构建镜像

在堡塔终端或SSH中执行：

```bash
cd /www/wwwroot/lugang-connect-enterprise
docker build -t lugang-enterprise:latest .
```

等待构建完成（约10-20分钟）。

### 步骤2：在堡塔Docker界面创建容器

点击 **Docker** → **容器** → **创建容器**，按以下配置填写：

---

## 📋 容器配置详细说明

### 基本信息

| 字段 | 填写内容 |
|------|----------|
| 容器名称 | `lugang-enterprise` |
| 镜像 | `lugang-enterprise:latest` |

**⚠️ 注意：镜像不要填 `golang:1.21-alpine`！那是构建用的基础镜像，不是我们的应用镜像。必须先执行步骤1构建镜像后，才能填 `lugang-enterprise:latest`**

---

### 端口映射

点击 **暴露端口** → **添加**

| 主机端口 | 容器端口 | 协议 |
|----------|----------|------|
| 8080 | 8080 | tcp |

---

### 重启策略

选择：**停止后马上重启** （或 "always"）

---

### 网络

| 字段 | 填写内容 |
|------|----------|
| 网络名称 | `bridge` |
| IPV4地址 | 留空（自动分配） |

---

### 挂载/映射

点击 **本机目录** → **添加**

| 挂载目录（主机） | 权限 | 容器目录 |
|------------------|------|----------|
| `/www/wwwroot/lugang-connect-enterprise/data` | 读写 | `/app/data` |
| `/www/wwwroot/lugang-connect-enterprise/logs` | 读写 | `/app/logs` |

**⚠️ 注意：**
- 权限要选 **读写**，不是只读！
- 不要把整个项目目录挂载到 `/app`，那样会覆盖容器内的程序文件

---

### Command（启动命令）

**留空！** 或者删除现有内容。

不要填：
```
sh
-c
cd /app && go run main.go
```

**正确做法：留空**，因为Dockerfile已经定义了 `ENTRYPOINT ["./lugang-enterprise"]`

---

### Entrypoint（入口点）

**留空！** 使用镜像默认的入口点。

---

### 环境变量

在环境变量框中填写（每行一个）：

```
SQL_DSN=lugang_connect:huijin8304@tcp(172.17.0.1:3306)/lugang_connect?charset=utf8&parseTime=True&loc=Local&sql_mode=''
PORT=8080
GIN_MODE=release
THEME=berry
MEMORY_CACHE_ENABLED=true
SYNC_FREQUENCY=300
SESSION_SECRET=lugang_enterprise_2024_secure_key
TZ=Asia/Shanghai
```

**⚠️ 关键修改：**
- 数据库地址用 `172.17.0.1:3306`（Docker网桥访问宿主机）
- 不要用 `host.docker.internal`（某些Linux系统不支持）

---

### 其他选项

| 选项 | 设置 |
|------|------|
| 容器退出后自动删除容器 | ❌ 不勾选 |
| 伪终端 (-t) | ❌ 不勾选 |
| 标准输入 (-i) | ❌ 不勾选 |
| 特权模式 | ❌ 不勾选 |
| 最小分配内存 | 0（不限制） |
| CPU限制 | 0（不限制） |
| 内存限制 | 0（不限制） |

---

### 标签

可以留空，或填写：
```
app=lugang-enterprise
version=1.0.0
```

---

## 📋 完整配置截图对照

根据你的截图，需要修改的地方：

### 截图1（编辑容器-环境变量）

**环境变量** 修改为：
```
SQL_DSN=lugang_connect:huijin8304@tcp(172.17.0.1:3306)/lugang_connect?charset=utf8&parseTime=True&loc=Local&sql_mode=''
PORT=8080
GIN_MODE=release
THEME=berry
MEMORY_CACHE_ENABLED=true
SESSION_SECRET=lugang_enterprise_2024_secure_key
TZ=Asia/Shanghai
```

删除 `PATH=...` 那行，那是系统变量不需要手动设置。

---

### 截图2（挂载和Command）

**挂载目录** 修改：
- 挂载目录：`/www/wwwroot/lugang-connect-enterprise/data`
- 权限：**读写**（不是只读！）
- 容器目录：`/app/data`

再添加一个：
- 挂载目录：`/www/wwwroot/lugang-connect-enterprise/logs`
- 权限：**读写**
- 容器目录：`/app/logs`

**Command** 清空！删除：
```
sh
-c
cd /app && go run main.go
```

**Entrypoint** 留空！

---

### 截图3（基本信息）

**镜像** 修改：
- ❌ 错误：`golang:1.21-alpine`
- ✅ 正确：`lugang-enterprise:latest`（需要先构建镜像）

---

## 🔧 构建镜像命令

在创建容器之前，必须先构建镜像：

```bash
# SSH连接服务器或使用堡塔终端
cd /www/wwwroot/lugang-connect-enterprise

# 构建镜像（需要10-20分钟）
docker build -t lugang-enterprise:latest .

# 查看镜像是否构建成功
docker images | grep lugang
```

看到类似输出说明成功：
```
lugang-enterprise   latest   abc123def456   1 minute ago   50MB
```

---

## ✅ 验证部署

1. 容器状态显示"运行中"
2. 访问 `http://服务器IP:8080`
3. 使用 root/123456 登录

---

## 🔧 常见问题

### Q1: 容器启动后立即停止
查看日志：
```bash
docker logs lugang-enterprise
```

### Q2: 数据库连接失败
确保MySQL允许 `172.17.0.1` 访问：
1. 堡塔面板 → 数据库 → lugang_connect → 权限
2. 设置为"所有人"或添加 `172.17.0.1`

### Q3: 镜像不存在
先执行构建命令：
```bash
cd /www/wwwroot/lugang-connect-enterprise
docker build -t lugang-enterprise:latest .
```

---

## 📞 默认账号

- 用户名：`root`
- 密码：`123456`
- **首次登录后请立即修改密码！**
