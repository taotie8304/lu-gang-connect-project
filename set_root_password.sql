-- 为 root 用户设置密码为 Huijin8304*
-- One API 使用 bcrypt 加密，但我们先设置明文，然后通过 API 修改
UPDATE users SET password = '$2a$10$YourBcryptHashHere' WHERE username='root';
SELECT id, username, password FROM users WHERE username='root';
