/**
 * 鲁港通 - 测试 MongoDB 连接
 * 
 * 使用方法：node test_mongodb_connection.js
 */

const { MongoClient } = require('mongodb');

// 数据库配置
const MONGODB_URI = 'mongodb://root:password@localhost:27017/lugang_ai?authSource=admin';
const DATABASE_NAME = 'lugang_ai';

async function testConnection() {
  const client = new MongoClient(MONGODB_URI);

  try {
    console.log('🔌 正在连接到 MongoDB...');
    console.log(`   URI: ${MONGODB_URI.replace(/password/, '****')}`);
    
    await client.connect();
    console.log('✅ 成功连接到 MongoDB\n');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection('system_contents');

    // 统计文档数量
    const count = await collection.countDocuments();
    console.log(`📊 system_contents 集合统计：`);
    console.log(`   - 文档总数：${count}\n`);

    // 列出所有系统内容
    const docs = await collection.find({}, { 
      projection: { key: 1, title: 1, updatedAt: 1 } 
    }).toArray();

    console.log('📝 现有系统内容：');
    if (docs.length === 0) {
      console.log('   （无）');
    } else {
      docs.forEach((doc, index) => {
        console.log(`   ${index + 1}. ${doc.key}`);
        console.log(`      标题：${doc.title}`);
        console.log(`      更新时间：${doc.updatedAt || '未知'}`);
      });
    }

    console.log('\n✅ 连接测试成功！可以运行更新脚本了。');

  } catch (error) {
    console.error('\n❌ 连接失败:', error.message);
    console.error('\n💡 可能的原因：');
    console.error('   1. MongoDB 容器未运行');
    console.error('   2. 端口 27017 未映射或被占用');
    console.error('   3. 密码不正确');
    console.error('\n🔧 解决方案：');
    console.error('   1. 检查容器状态：docker ps | grep mongo');
    console.error('   2. 启动容器：cd lugang-ai && docker-compose up -d mongo');
    console.error('   3. 如果在服务器上，请 SSH 到服务器后运行');
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

testConnection();
