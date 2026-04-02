#!/bin/bash

# 鲁港通后端密码修复脚本 - 使用 Bcrypt
# 新生成的 bcrypt 哈希
PASSWORD_HASH='$2b$10$VbnryJ9kdmQA1pi1J0.KPuphhWzhiNhHADAuun8tz0hDxhnf7TVk.'

echo "=== 1. 检查当前 root 用户密码 ==="
mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "SELECT id, username, LEFT(password, 50) as password_preview, role, status FROM users WHERE username='root';"

echo ""
echo "=== 2. 更新为新的 Bcrypt 哈希密码 ==="
mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "UPDATE users SET password='$PASSWORD_HASH' WHERE username='root';"

echo ""
echo "=== 3. 验证更新后的密码 ==="
mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "SELECT id, username, password, role, status FROM users WHERE username='root';"

echo ""
echo "✅ 密码已更新为新的 Bcrypt 哈希"
echo "现在可以使用以下凭据登录后端："
echo "  用户名: root"
echo "  密码: Huijin8304*"
