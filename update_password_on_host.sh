#!/bin/bash

# 鲁港通后端密码更新脚本
# 使用双重 SHA256 哈希（与前端一致）

PASSWORD_HASH="d48f375f6f3198f5093c49b9425dffad4aa49629e53f2bf7eec02599d1db9a23"

echo "=== 1. 检查当前 root 用户信息 ==="
mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "SELECT id, username, password, role, status FROM users WHERE username='root';"

echo ""
echo "=== 2. 更新密码为双重 SHA256 哈希 ==="
mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "UPDATE users SET password = '${PASSWORD_HASH}' WHERE username='root';"

echo ""
echo "=== 3. 验证更新后的密码 ==="
mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "SELECT id, username, password, role, status FROM users WHERE username='root';"

echo ""
echo "密码已更新为: Huijin8304*"
echo "请尝试登录后端: https://api.airscend.com"
