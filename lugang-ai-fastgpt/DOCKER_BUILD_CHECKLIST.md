# Docker 构建检查清单

## GitHub Actions 构建失败排查

### 1. 检查 GitHub 仓库设置

- [ ] **Actions 权限**: Settings → Actions → General → Workflow permissions
  - 选择 "Read and write permissions"
  - 勾选 "Allow GitHub Actions to create and approve pull requests"

- [ ] **Packages 权限**: Settings → Actions → General
  - 确保 workflow 有权限推送到 GitHub Packages

### 2. 检查 Workflow 文件

当前配置文件: `.github/workflows/docker-build.yml`

```yaml
# 关键配置项
permissions:
  contents: read
  packages: write  # 必须有这个权限才能推送镜像
```

### 3. 常见构建错误

#### 错误: "denied: permission_denied"
**原因**: 没有推送镜像的权限
**解决**: 
1. 检查 workflow permissions 设置
2. 确保 `packages: write` 权限已添加

#### 错误: "Lockfile not found"
**原因**: `pnpm-lock.yaml` 文件不存在或路径错误
**解决**: 
1. 确保 `lugang-ai-fastgpt/pnpm-lock.yaml` 存在
2. 检查 `.gitignore` 没有忽略此文件

#### 错误: "COPY failed: file not found"
**原因**: Dockerfile 中引用的文件不存在
**解决**: 
1. 检查 `context` 路径是否正确
2. 确保所有必需文件已提交到 Git

#### 错误: "npm ERR! network timeout"
**原因**: 网络问题，无法下载依赖
**解决**: 
1. 手动触发 workflow，选择 "使用国内镜像加速"
2. 或者在 Dockerfile 中添加 `proxy` 参数

#### 错误: "JavaScript heap out of memory"
**原因**: 构建时内存不足
**解决**: 
1. Dockerfile 已设置 `NODE_OPTIONS="--max-old-space-size=4096"`
2. 如果仍然不足，考虑减少并行构建

### 4. 手动触发构建

1. 进入 GitHub 仓库 → Actions
2. 选择 "Build and Push Docker Image"
3. 点击 "Run workflow"
4. 选择是否使用国内镜像加速
5. 点击 "Run workflow" 按钮

### 5. 查看构建日志

1. 进入 GitHub 仓库 → Actions
2. 点击最近的 workflow run
3. 展开失败的 step 查看详细日志

### 6. 本地测试构建

```bash
# 进入项目目录
cd lugang-ai-fastgpt

# 本地构建测试
docker build -t lugang-ai:test -f projects/app/Dockerfile .

# 使用国内镜像加速
docker build -t lugang-ai:test -f projects/app/Dockerfile --build-arg proxy=true .
```

## 部署到服务器

### 1. 创建配置文件

```bash
cd /www/wwwroot/lugang-ai-fastgpt

# 创建部署配置
cat > .env.deploy << 'EOF'
GITHUB_USERNAME=your-github-username
IMAGE_TAG=latest
GHCR_TOKEN=your-token-if-private
MONGO_PASSWORD=your-secure-password
PG_PASSWORD=your-secure-password
EOF
```

### 2. 运行部署脚本

```bash
chmod +x deploy-prod.sh
./deploy-prod.sh
```

### 3. 验证部署

```bash
# 检查容器状态
docker-compose -f docker-compose.prod.yml ps

# 检查健康状态
curl http://localhost:3210/api/health

# 查看日志
docker logs -f lugang-ai-app
```

## 镜像地址

构建成功后，镜像会推送到:
```
ghcr.io/<your-username>/lugang-ai:latest
ghcr.io/<your-username>/lugang-ai:<commit-sha>
```

## 联系支持

如果以上步骤都无法解决问题，请提供:
1. GitHub Actions 的完整错误日志
2. 仓库的 Settings → Actions 截图
3. workflow 文件内容
