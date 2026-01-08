# 快速修复指南

## 问题
```
service "lugang-ai" depends on undefined service "minio": invalid compose project
```

## 原因
服务器上的 `docker-compose.yml` 文件中，`lugang-ai` 服务的 `depends_on` 仍然引用了 `minio`，但 `minio` 服务已被注释。

## 解决方案（3选1）

### 方案1：手动编辑（最快）

```bash
cd /www/wwwroot/lugang-ai-fastgpt

# 备份原文件
cp docker-compose.yml docker-compose.yml.backup

# 编辑文件
vi docker-compose.yml
```

找到这部分（大约在第60-67行）：
```yaml
  lugang-ai:
    image: lugang-ai:v1
    container_name: lugang-ai-app
    restart: always
    ports:
      - "3210:3000"
    depends_on:
      - mongo
      - pg
      - redis
      - minio    # ← 删除这一行！
```

改为：
```yaml
  lugang-ai:
    image: lugang-ai:v1
    container_name: lugang-ai-app
    restart: always
    ports:
      - "3210:3000"
    depends_on:
      - mongo
      - pg
      - redis
```

保存后执行：
```bash
docker-compose up -d
```

---

### 方案2：使用替换文件

```bash
cd /www/wwwroot/lugang-ai-fastgpt

# 备份原文件
cp docker-compose.yml docker-compose.yml.backup

# 使用修复好的文件（需要先上传 docker-compose-fixed.yml）
cp docker-compose-fixed.yml docker-compose.yml

# 启动服务
docker-compose up -d
```

---

### 方案3：使用 sed 命令

```bash
cd /www/wwwroot/lugang-ai-fastgpt

# 备份原文件
cp docker-compose.yml docker-compose.yml.backup

# 删除包含 "- minio" 的行
sed -i '/- minio/d' docker-compose.yml

# 启动服务
docker-compose up -d
```

---

## 验证修复

```bash
# 查看修改后的 depends_on 部分
grep -A 5 "depends_on:" docker-compose.yml

# 应该看到：
#     depends_on:
#       - mongo
#       - pg
#       - redis
#     env_file:
```

## 启动服务

```bash
cd /www/wwwroot/lugang-ai-fastgpt

# 启动服务
docker-compose up -d

# 查看容器状态
docker-compose ps

# 应该看到4个容器运行：
# - lugang-ai-mongo
# - lugang-ai-pg
# - lugang-ai-redis
# - lugang-ai-app
```

## 查看日志

```bash
# 查看应用日志
docker logs lugang-ai-app --tail 50

# 应该看到：
# Redis connected
# mongo connected
# MongoDB start connect
```

## 访问系统

访问: http://156.225.30.134:3210
账户: root
密码: LuGang@2025
