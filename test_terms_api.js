// 测试前端 API 返回的使用条款内容
const https = require('https');

const options = {
  hostname: 'www.airscend.com',
  port: 443,
  path: '/api/system/content/terms_of_use',
  method: 'GET',
  rejectUnauthorized: false
};

const req = https.request(options, (res) => {
  console.log('状态码:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n完整响应:');
    console.log(data);
    console.log('\n响应长度:', data.length);
    
    try {
      const json = JSON.parse(data);
      console.log('\nJSON 解析成功:');
      
      // 数据在 data 字段中
      const content = json.data || json;
      
      console.log('标题:', content.title);
      console.log('内容长度:', content.content ? content.content.length : 0, '字符');
      console.log('内容类型:', content.contentType);
      console.log('更新时间:', content.updateTime);
      console.log('\n内容前100字符:');
      console.log(content.content ? content.content.substring(0, 100) : '无内容');
      
      if (content.content && content.content.length > 6000) {
        console.log('\n✅ API 返回完整内容！');
      } else {
        console.log('\n❌ API 返回内容不完整');
      }
    } catch (e) {
      console.log('\nJSON 解析失败:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e.message);
});

req.end();
