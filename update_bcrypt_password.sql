-- 使用 bcrypt 哈希更新 root 用户密码
-- 密码: Huijin8304*
UPDATE users SET password = '$2b$10$qbCpu7WH18Z7pHMwLxzfc.5i199cETFzoyq7aNaIwcUi5BB6RQGs.' WHERE username='root';

-- 验证更新
SELECT id, username, LEFT(password, 30) as password_start, role, status FROM users WHERE username='root';
