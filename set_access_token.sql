-- 为 root 用户设置 access_token
UPDATE users SET access_token = '302c9696bd38955fc367a34a056c4a93' WHERE username='root';

-- 验证更新
SELECT id, username, access_token, role, status FROM users WHERE username='root';
