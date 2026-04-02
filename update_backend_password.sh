#!/bin/bash

# 鲁港通后端密码修复脚本
# 使用 SHA256 二次哈希（与前端一致）

# 密码的 SHA256 二次哈希值
# 原始密码: Huijin8304*
# 第一次哈希: 39a37706427e8e1968b346f365ed982144afae01ac300edaadeb5b2b1c93c870
# 第二次哈希: d48f375f6f3198f5093c49b9425dffad4aa49629e53f2bf7eec02599d1db9a23
PASSWORD_HASH="d48f375f6f3198f5093c49b9425dffad4aa49629e53f2bf7eec02599d1db9a23"

echo "=== 1. 检查当前 root 用户密码 ==="
docker exec -i lugang-enterprise sh -c "mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e 'SELECT id, username, LEFT(password, 50) as password_preview, role, status FROM users WHERE username=\"root\";'"

echo ""
echo "=== 2. 更新为 SHA256 二次哈希密码 ==="
docker exec -i lugang-enterprise sh -c "mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e 'UPDATE users SET password=\"$PASSWORD_HASH\" WHERE username=\"root\";'"

echo ""
echo "=== 3. 验证更新后的密码 ==="
docker exec -i lugang-enterprise sh -c "mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e 'SELECT id, username, password, role, status FROM users WHERE username=\"root\";'"

echo ""
echo "✅ 密码已更新为 SHA256 二次哈希"
echo "现在可以使用以下凭据登录后端："
echo "  用户名: root"
echo "  密码: Huijin8304*"
