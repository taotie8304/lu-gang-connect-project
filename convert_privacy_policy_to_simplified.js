/**
 * 鲁港通 - 将繁体隐私政策转换为简体
 * 
 * 使用方法：node convert_privacy_policy_to_simplified.js
 */

const { MongoClient } = require('mongodb');
const OpenCC = require('opencc-js');

// 数据库配置
const MONGODB_URI = 'mongodb://root:password@localhost:27017/lugang_ai?authSource=admin';
const DATABASE_NAME = 'lugang_ai';

// 初始化繁简转换器（繁体转简体）
const converter = OpenCC.Converter({ from: 'hk', to: 'cn' });

async function convertPrivacyPolicyToSimplified() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到 MongoDB');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection('system_contents');

    // 获取繁体版本
    const traditionalDoc = await collection.findOne({ key: 'privacy_policy' });
    
    if (!traditionalDoc) {
      console.error('❌ 未找到繁体版隐私政策');
      process.exit(1);
    }

    console.log('📝 找到繁体版隐私政策');
    console.log(`   - 标题：${traditionalDoc.title}`);
    console.log(`   - 内容长度：${traditionalDoc.content.length} 字符`);

    // 转换为简体
    console.log('\n🔄 正在转换为简体...');
    const simplifiedTitle = converter(traditionalDoc.title);
    const simplifiedContent = converter(traditionalDoc.content);

    console.log('✅ 转换完成');
    console.log(`   - 简体标题：${simplifiedTitle}`);
    console.log(`   - 简体内容长度：${simplifiedContent.length} 字符`);

    // 检查简体版本是否已存在
    const existing = await collection.findOne({ key: 'privacy_policy_zh-CN' });
    
    if (existing) {
      console.log('\n⚠️  简体版隐私政策已存在，将更新内容...');
      
      const result = await collection.updateOne(
        { key: 'privacy_policy_zh-CN' },
        {
          $set: {
            content: simplifiedContent,
            title: simplifiedTitle,
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`✅ 已更新简体版隐私政策 (匹配: ${result.matchedCount}, 修改: ${result.modifiedCount})`);
    } else {
      console.log('\n📝 简体版隐私政策不存在，将创建新记录...');
      
      const result = await collection.insertOne({
        key: 'privacy_policy_zh-CN',
        title: simplifiedTitle,
        content: simplifiedContent,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ 已创建简体版隐私政策 (ID: ${result.insertedId})`);
    }

    // 验证内容
    const doc = await collection.findOne({ key: 'privacy_policy_zh-CN' });
    console.log(`\n📊 内容统计：`);
    console.log(`   - 字符数：${doc.content.length}`);
    console.log(`   - 标题：${doc.title}`);
    console.log(`   - 更新时间：${doc.updatedAt}`);

    // 显示转换示例（前 200 字符）
    console.log(`\n📄 内容预览（前 200 字符）：`);
    console.log(doc.content.substring(0, 200) + '...');

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ 数据库连接已关闭');
  }
}

convertPrivacyPolicyToSimplified();
