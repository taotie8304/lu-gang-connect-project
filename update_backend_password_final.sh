#!/bin/bash

# 最终的后端密码更新脚本
# 使用标准 bcrypt 哈希

PASSWORD_HASH='$2b$10$hML/kqD3MYazuxEM9apG5uycdzTWgGzGnXdpP8BUsybhXT6.x4XfK'

echo "=== 1. 检查当前 root 用户 ==="
mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "SELECT id, username, LEFT(password, 30) as password_preview, role, status FROM users WHERE username='root';"

echo ""
echo "=== 2. 更新密码为标准 bcrypt 哈希 ==="
mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "UPDATE users SET password = '${PASSWORD_HASH}' WHERE username='root';"

echo ""
echo "=== 3. 验证更新 ==="
mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "SELECT id, username, LEFT(password, 30) as password_preview, role, status FROM users WHERE username='root';"

echo ""
echo "✅ 密码已更新"
echo "用户名: root"
echo "密码: Huijin8304*"
echo "请访问 https://api.airscend.com 登录测试"
