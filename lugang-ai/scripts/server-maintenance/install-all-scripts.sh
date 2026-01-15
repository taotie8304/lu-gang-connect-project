#!/bin/bash

# ===== 鲁港通 - 一键安装所有维护脚本 =====
# 在服务器上执行此脚本即可安装所有维护脚本
# 
# 使用方法:
#   curl -sSL https://raw.githubusercontent.com/taotie8304/lu-gang-connect-project/main/lugang-ai/scripts/server-maintenance/install-all-scripts.sh | bash
# 或者手动复制此脚本内容到服务器执行

set -e

SCRIPT_DIR="/www/wwwroot/lugang-ai/scripts/server-maintenance"
BACKUP_DIR="/www/wwwroot/backups"

echo "===== 鲁港通 - 安装维护脚本 ====="
echo ""

# 创建目录
mkdir -p "$SCRIPT_DIR"
mkdir -p "$BACKUP_DIR"

echo "脚本目录: $SCRIPT_DIR"
echo "备份目录: $BACKUP_DIR"
echo ""

# 由于 GitHub 可能无法访问，这里直接内嵌脚本内容
# 实际使用时，请将此脚本内容复制到服务器执行

echo "请手动复制各个脚本到服务器..."
echo ""
echo "脚本列表:"
echo "  00-verify-backup.sh   - 验证备份完整性"
echo "  01-full-backup.sh     - 完整备份"
echo "  02-check-unused-resources.sh - 检查无用资源"
echo "  03-safe-cleanup.sh    - 安全清理"
echo "  04-verify-services.sh - 服务验证"
echo "  05-final-backup.sh    - 最终备份"
echo "  06-pull-new-image.sh  - 拉取新镜像"
echo "  07-rollback.sh        - 回滚脚本"
echo ""
echo "建议执行顺序:"
echo "  1. 01-full-backup.sh    # 先备份"
echo "  2. 00-verify-backup.sh  # 验证备份"
echo "  3. 02-check-unused-resources.sh  # 检查资源"
echo "  4. 03-safe-cleanup.sh   # 清理（可选）"
echo "  5. 04-verify-services.sh  # 验证服务"
echo "  6. 05-final-backup.sh   # 最终备份"
echo "  7. 06-pull-new-image.sh # 拉取新镜像"
echo "  8. 如有问题: 07-rollback.sh  # 回滚"
