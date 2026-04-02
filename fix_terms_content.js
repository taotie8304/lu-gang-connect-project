// 修复使用条款内容 - 完整更新到数据库
const { MongoClient } = require('mongodb');
const fs = require('fs');

// 从 constant.ts 文件中提取完整的使用条款内容
const constantFile = fs.readFileSync('./lugang-ai/packages/global/support/systemContent/constant.ts', 'utf8');

// 提取 defaultContent 的内容（在反引号之间）
const match = constantFile.match(/defaultContent: `([\s\S]*?)`\s*}/);
if (!match) {
  console.error('无法从文件中提取使用条款内容');
  process.exit(1);
}

const termsContent = match[1];
console.log('提取的内容长度:', termsContent.length, '字符');
console.log('内容前100字符:', termsContent.substring(0, 100));

const uri = 'mongodb://root:LuGang2024Secure@156.225.30.134:27017/lugang_ai?authSource=admin&directConnection=true';

async function updateTerms() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('\n已连接到 MongoDB');
    
    const db = client.db('lugang_ai');
    const collection = db.collection('system_contents');
    
    // 更新使用条款
    const result = await collection.updateOne(
      { key: 'terms_of_use' },
      {
        $set: {
          title: '鲁港通 (LuGangTong) 使用條款',
          content: termsContent,
          contentType: 'markdown',
          updateTime: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log('\n更新结果:', result);
    
    // 验证更新
    const doc = await collection.findOne({ key: 'terms_of_use' });
    console.log('\n验证：');
    console.log('- 标题:', doc.title);
    console.log('- 内容长度:', doc.content.length, '字符');
    console.log('- 更新时间:', doc.updateTime);
    
    if (doc.content.length === termsContent.length) {
      console.log('\n✅ 使用条款已成功更新！');
    } else {
      console.log('\n❌ 内容长度不匹配');
    }
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await client.close();
  }
}

updateTerms();
