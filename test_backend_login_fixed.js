// 测试后端登录
const https = require('https');

const loginData = JSON.stringify({
  username: 'root',
  password: 'Huijin8304*'
});

const options = {
  hostname: 'api.airscend.com',
  port: 443,
  path: '/api/user/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  },
  rejectUnauthorized: false // 忽略 SSL 证书验证
};

console.log('正在测试后端登录...');
console.log('用户名: root');
console.log('密码: Huijin8304*');
console.log('');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('HTTP 状态码:', res.statusCode);
    console.log('响应内容:', data);
    console.log('');
    
    if (res.statusCode === 200) {
      console.log('✅ 登录成功！');
      try {
        const response = JSON.parse(data);
        if (response.success) {
          console.log('Token:', response.data?.token || '未返回 token');
        }
      } catch (e) {
        console.log('响应解析失败');
      }
    } else {
      console.log('❌ 登录失败');
    }
  });
});

req.on('error', (error) => {
  console.error('请求错误:', error.message);
});

req.write(loginData);
req.end();
