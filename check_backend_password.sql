-- 检查 root 用户的密码哈希
SELECT id, username, password, role, status FROM users WHERE username='root';
