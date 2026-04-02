#!/bin/bash

echo "=== 1. 检查当前 root 用户密码哈希 ==="
docker exec -i lugang-enterprise sh -c 'mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "SELECT id, username, password, role, status FROM users WHERE username=\"root\";"'

echo ""
echo "=== 2. 更新为 bcrypt 哈希密码 ==="
docker exec -i lugang-enterprise sh -c 'mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "UPDATE users SET password=\"\$2b\$10\$qbCpu7WH18Z7pHMwLxzfc.5i199cETFzoyq7aNaIwcUi5BB6RQGs.\" WHERE username=\"root\";"'

echo ""
echo "=== 3. 验证更新后的密码 ==="
docker exec -i lugang-enterprise sh -c 'mysql -h 172.17.0.1 -u lugang_connect -phuijin8304 lugang_connect -e "SELECT id, username, password, role, status FROM users WHERE username=\"root\";"'
