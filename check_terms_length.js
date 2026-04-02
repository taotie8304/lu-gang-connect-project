// 检查数据库中使用条款的内容长度
const { MongoClient } = require('mongodb');

const uri = 'mongodb://root:LuGang2024Secure@156.225.30.134:27017/fastgpt?authSource=admin&directConnection=true';

async function checkTerms() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('fastgpt');
    const doc = await db.collection('system_contents').findOne({ key: 'terms_of_use' });
    
    if (doc) {
      console.log('找到使用条款记录：');
      console.log('- 标题:', doc.title);
      console.log('- 内容长度:', doc.content.length, '字符');
      console.log('- 更新时间:', doc.updateTime);
      console.log('- 内容前100字符:', doc.content.substring(0, 100));
    } else {
      console.log('未找到使用条款记录');
    }
  } finally {
    await client.close();
  }
}

checkTerms().catch(console.error);
