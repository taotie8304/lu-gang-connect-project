// 检查数据库中所有的使用条款记录
const { MongoClient } = require('mongodb');

const uri = 'mongodb://root:LuGang2024Secure@156.225.30.134:27017/fastgpt?authSource=admin&directConnection=true';

async function checkRecords() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('fastgpt');
    const collection = db.collection('system_contents');
    
    const docs = await collection.find({ key: 'terms_of_use' }).toArray();
    
    console.log('找到', docs.length, '条使用条款记录：\n');
    
    docs.forEach((doc, index) => {
      console.log(`记录 ${index + 1}:`);
      console.log('  _id:', doc._id);
      console.log('  key:', doc.key);
      console.log('  title:', doc.title);
      console.log('  内容长度:', doc.content.length);
      console.log('  createTime:', doc.createTime);
      console.log('  updateTime:', doc.updateTime);
      console.log('  内容前50字符:', doc.content.substring(0, 50));
      console.log('');
    });
    
    if (docs.length > 1) {
      console.log('⚠️  发现多条记录！需要删除旧记录。');
    }
  } finally {
    await client.close();
  }
}

checkRecords();
