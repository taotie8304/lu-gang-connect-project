# GitHub 仓库连接指南

## 问题说明

您的服务器上 `/www/wwwroot/lugang-ai-fastgpt` 目录不是Git仓库，导致更新脚本跳过了代码更新步骤。

由于您的GitHub仓库是**私有仓库**，需要配置认证才能拉取代码。

---

## 解决方案（3种方法）

### 🔥 方案A: 使用Personal Access Token（推荐，最简单）

#### 1. 生成GitHub Token

访问: https://github.com/settings/tokens

点击 "Generate new token" → "Generate new token (classic)"

配置:
- Note: `lugang-server-deploy`
- Expiration: `No expiration` 或 `90 days`
- 勾选权限: `repo` (完整仓库访问权限)

点击 "Generate token"，**立即复制Token**（只显示一次！）

#### 2. 在服务器上配置

```bash
# 进入项目目录
cd /www/wwwroot/lugang-ai-fastgpt

# 初始化Git仓库
git init

# 添加远程仓库（将 YOUR_TOKEN 替换为刚才复制的Token）
git remote add origin https://YOUR_TOKEN@github.com/taotie8304/lu-gang-connect-project.git

# 拉取代码
git fetch origin main

# 重置到最新代码（会覆盖本地修改）
git reset --hard origin/main

# 设置默认分支
git branch --set-upstream-to=origin/main main
```

#### 3. 验证

```bash
git status
git log -1
```

---

### 🔐 方案B: 使用SSH密钥（最安全）

#### 1. 生成SSH密钥

```bash
# 生成密钥（一路按Enter）
ssh-keygen -t ed25519 -C "lugang-server-deploy"

# 查看公钥
cat ~/.ssh/id_ed25519.pub
```

复制输出的公钥内容（以 `ssh-ed25519` 开头）

#### 2. 添加到GitHub

访问: https://github.com/settings/keys

点击 "New SSH key"
- Title: `lugang-server`
- Key: 粘贴刚才复制的公钥

点击 "Add SSH key"

#### 3. 测试连接

```bash
ssh -T git@github.com
```

看到 "Hi taotie8304!" 表示成功

#### 4. 配置仓库

```bash
cd /www/wwwroot/lugang-ai-fastgpt
git init
git remote add origin git@github.com:taotie8304/lu-gang-connect-project.git
git fetch origin main
git reset --hard origin/main
git branch --set-upstream-to=origin/main main
```

---

### 📦 方案C: 重新克隆（最彻底）

如果上面两种方法都有问题，可以重新克隆：

```bash
# 备份当前目录
cd /www/wwwroot
mv lugang-ai-fastgpt lugang-ai-fastgpt.backup

# 使用Token克隆（替换YOUR_TOKEN）
git clone https://YOUR_TOKEN@github.com/taotie8304/lu-gang-connect-project.git lugang-ai-fastgpt

# 或使用SSH克隆（需要先配置SSH密钥）
git clone git@github.com:taotie8304/lu-gang-connect-project.git lugang-ai-fastgpt

# 恢复环境变量
cp lugang-ai-fastgpt.backup/projects/app/.env.local lugang-ai-fastgpt/projects/app/.env.local

# 恢复数据（如果有）
cp -r lugang-ai-fastgpt.backup/data lugang-ai-fastgpt/
```

---

## 重要提示

### 关于密码输入

Linux终端输入密码时**不会显示任何字符**（包括星号），这是正常的安全设计！

- 直接粘贴Token
- 按Enter
- 不要怀疑，它确实输入进去了

### Token安全

- Token相当于密码，不要分享给他人
- 不要提交到代码仓库
- 定期更换Token

### 验证成功

配置完成后，运行：

```bash
cd /www/wwwroot/lugang-ai-fastgpt
git pull origin main
```

如果没有报错，说明配置成功！

---

## 配置完成后

重新运行更新脚本：

```bash
cd /www/wwwroot/lugang-ai-fastgpt
bash update-deployment.sh
```

这次步骤3就不会跳过了！

---

## 常见错误

### 错误1: Authentication failed

**原因**: Token无效或权限不足

**解决**: 重新生成Token，确保勾选了 `repo` 权限

### 错误2: 403 error

**原因**: Token过期或仓库权限问题

**解决**: 检查Token是否过期，重新生成

### 错误3: Could not resolve host

**原因**: 网络问题

**解决**: 检查服务器网络连接

---

## 需要帮助？

如果遇到问题，请提供：
1. 具体的错误信息
2. 使用的是哪种方案
3. 执行的命令和输出
