SELECT id, username, LEFT(password, 50) as password_start FROM users WHERE password IS NOT NULL AND password != '' LIMIT 5;
