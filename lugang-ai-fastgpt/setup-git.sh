#!/bin/bash

# ========================================
# 鲁港通AI - Git仓库配置脚本
# 用于连接GitHub私有仓库
# ========================================

set -e

echo "=========================================="
echo "  鲁港通AI - Git仓库配置"
echo "=========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 错误: 请在 lugang-ai-fastgpt 目录下运行此脚本"
    exit 1
fi

# 检查是否已经是Git仓库
if [ -d ".git" ]; then
    echo "✓ 已经是Git仓库"
    echo ""
    echo "当前远程仓库:"
    git remote -v
    echo ""
    read -p "是否重新配置？(y/n): " RECONFIG
    if [ "$RECONFIG" != "y" ]; then
        exit 0
    fi
    echo ""
    echo "删除现有Git配置..."
    rm -rf .git
fi

echo "=========================================="
echo "  选择认证方式"
echo "=========================================="
echo ""
echo "1. Personal Access Token (推荐，简单)"
echo "2. SSH密钥 (更安全)"
echo "3. 退出"
echo ""
read -p "请选择 (1-3): " AUTH_METHOD

case $AUTH_METHOD in
    1)
        echo ""
        echo "=========================================="
        echo "  使用Personal Access Token"
        echo "=========================================="
        echo ""
        echo "📝 如何获取Token:"
        echo "1. 访问: https://github.com/settings/tokens"
        echo "2. 点击 'Generate new token (classic)'"
        echo "3. 勾选 'repo' 权限"
        echo "4. 生成并复制Token"
        echo ""
        echo "⚠️  重要提示:"
        echo "- Linux终端输入时不显示字符（这是正常的）"
        echo "- 直接粘贴Token后按Enter即可"
        echo ""
        read -sp "请输入您的GitHub Token: " GITHUB_TOKEN
        echo ""
        
        if [ -z "$GITHUB_TOKEN" ]; then
            echo "❌ Token不能为空"
            exit 1
        fi
        
        echo ""
        echo "初始化Git仓库..."
        git init
        
        echo "添加远程仓库..."
        git remote add origin "https://${GITHUB_TOKEN}@github.com/taotie8304/lu-gang-connect-project.git"
        
        echo "拉取代码..."
        git fetch origin main
        
        echo "重置到最新代码..."
        git reset --hard origin/main
        
        echo "设置默认分支..."
        git branch --set-upstream-to=origin/main main
        
        echo ""
        echo "✓ 配置完成！"
        ;;
        
    2)
        echo ""
        echo "=========================================="
        echo "  使用SSH密钥"
        echo "=========================================="
        echo ""
        
        # 检查是否已有SSH密钥
        if [ ! -f ~/.ssh/id_ed25519 ]; then
            echo "生成SSH密钥..."
            ssh-keygen -t ed25519 -C "lugang-server-deploy" -N "" -f ~/.ssh/id_ed25519
            echo ""
        fi
        
        echo "您的SSH公钥:"
        echo "=========================================="
        cat ~/.ssh/id_ed25519.pub
        echo "=========================================="
        echo ""
        echo "📝 请按以下步骤操作:"
        echo "1. 复制上面的公钥（从ssh-ed25519开始）"
        echo "2. 访问: https://github.com/settings/keys"
        echo "3. 点击 'New SSH key'"
        echo "4. 粘贴公钥并保存"
        echo ""
        read -p "完成后按Enter继续..."
        
        echo ""
        echo "测试SSH连接..."
        if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
            echo "✓ SSH连接成功"
        else
            echo "⚠️  SSH连接测试失败，但继续尝试..."
        fi
        
        echo ""
        echo "初始化Git仓库..."
        git init
        
        echo "添加远程仓库..."
        git remote add origin git@github.com:taotie8304/lu-gang-connect-project.git
        
        echo "拉取代码..."
        git fetch origin main
        
        echo "重置到最新代码..."
        git reset --hard origin/main
        
        echo "设置默认分支..."
        git branch --set-upstream-to=origin/main main
        
        echo ""
        echo "✓ 配置完成！"
        ;;
        
    3)
        echo "退出"
        exit 0
        ;;
        
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "  验证配置"
echo "=========================================="
echo ""

echo "Git状态:"
git status

echo ""
echo "最新提交:"
git log -1 --oneline

echo ""
echo "=========================================="
echo "  🎉 Git仓库配置成功！"
echo "=========================================="
echo ""
echo "现在可以运行更新脚本了:"
echo "  bash update-deployment.sh"
echo ""
echo "常用Git命令:"
echo "  git pull origin main    # 拉取最新代码"
echo "  git status              # 查看状态"
echo "  git log                 # 查看提交历史"
echo ""
echo "=========================================="
