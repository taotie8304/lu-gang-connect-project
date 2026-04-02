// 测试后端登录（使用 SHA256 哈希）
const crypto = require('crypto');
const https = require('https');

function hashStr(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

const password = 'Huijin8304*';
const hashedPassword = hashStr(password); // 前端会哈希一次

console.log('测试登录后端...');
console.log('用户名: root');
console.log('密码: Huijin8304*');
console.log('发送的哈希值:', hashedPassword);

const postData = JSON.stringify({
  username: 'root',
  password: hashedPassword
});

const options = {
  hostname: 'api.airscend.com',
  port: 443,
  path: '/api/user/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  },
  rejectUnauthorized: false // 忽略 SSL 证书验证（仅用于测试）
};

const req = https.request(options, (res) => {
  console.log('\n状态码:', res.statusCode);
  console.log('响应头:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n响应内容:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      
      if (res.statusCode === 200 && json.success) {
        console.log('\n✅ 登录成功！');
      } else {
        console.log('\n❌ 登录失败');
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e.message);
});

req.write(postData);
req.end();
