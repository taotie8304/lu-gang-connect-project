/**
 * 测试鲁港通后端登录
 */

const https = require('https');
const crypto = require('crypto');

const API_BASE = 'api.airscend.com';
const USERNAME = 'root';
const PASSWORD = 'Huijin8304*';

// 尝试不同的密码哈希方式
const passwords = {
  'plain': PASSWORD,
  'md5': crypto.createHash('md5').update(PASSWORD).digest('hex'),
  'sha256': crypto.createHash('sha256').update(PASSWORD).digest('hex')
};

console.log('='.repeat(60));
console.log('测试鲁港通后端登录');
console.log('='.repeat(60));
console.log('\n尝试的密码格式：');
Object.entries(passwords).forEach(([type, hash]) => {
  console.log(`  ${type}: ${hash}`);
});
console.log('');

// HTTP 请求函数
function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// 测试登录
async function testLogin(passwordType, password) {
  console.log(`\n尝试使用 ${passwordType} 格式登录...`);
  
  const postData = JSON.stringify({
    username: USERNAME,
    password: password
  });

  const options = {
    hostname: API_BASE,
    port: 443,
    path: '/api/user/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    rejectUnauthorized: false // 忽略 SSL 证书验证
  };

  try {
    const result = await makeRequest(options, postData);
    console.log(`  状态码: ${result.statusCode}`);
    console.log(`  响应:`, JSON.stringify(result.data, null, 2));
    
    if (result.statusCode === 200 && result.data.success) {
      console.log(`  ✓ 登录成功！`);
      return true;
    } else {
      console.log(`  ✗ 登录失败`);
      return false;
    }
  } catch (error) {
    console.log(`  ✗ 请求失败:`, error.message);
    return false;
  }
}

// 主函数
async function main() {
  for (const [type, password] of Object.entries(passwords)) {
    const success = await testLogin(type, password);
    if (success) {
      console.log('\n' + '='.repeat(60));
      console.log(`✓ 找到正确的密码格式: ${type}`);
      console.log('='.repeat(60));
      return;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✗ 所有密码格式都失败了');
  console.log('可能需要检查：');
  console.log('  1. 后端登录 API 路径是否正确');
  console.log('  2. 密码加密方式是否正确');
  console.log('  3. 是否需要其他参数（如验证码）');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('\n✗ 发生错误:', err.message);
  process.exit(1);
});
