-- 为鲁港通后端 root 用户设置密码
-- 密码: Huijin8304*
-- MD5 哈希: 8a4d1b759f007fdb1e07276e96cc1189

UPDATE users SET password = '8a4d1b759f007fdb1e07276e96cc1189' WHERE username='root';

-- 验证更新
SELECT id, username, password, role, status FROM users WHERE username='root';
