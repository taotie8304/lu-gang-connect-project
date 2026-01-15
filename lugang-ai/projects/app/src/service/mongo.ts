import { hashStr } from '@fastgpt/global/common/string/tools';
import { createDefaultTeam } from '@fastgpt/service/support/user/team/controller';
import { exit } from 'process';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { connectionMongo } from '@fastgpt/service/common/mongo';

/**
 * 鲁港通 - 初始化 root 用户
 * 只在 root 用户不存在时创建，不会重置已存在用户的密码
 * 使用原生 MongoDB 操作，避免 Mongoose Schema 的 set/get 函数干扰
 */
export async function initRootUser(retry = 3): Promise<any> {
  try {
    // 鲁港通：使用原生 MongoDB 查询，避免 Mongoose Schema 干扰
    const usersCollection = connectionMongo.connection.db.collection('users');
    const rootUser = await usersCollection.findOne({ username: 'root' });

    // 鲁港通：如果 root 用户已存在，不重置密码
    if (rootUser) {
      console.log('root user already exists, skipping password reset');
      // 只确保团队存在
      await mongoSessionRun(async (session) => {
        await createDefaultTeam({ userId: rootUser._id, session });
      });
      return;
    }

    // root 用户不存在，创建新用户
    const psw = process.env.DEFAULT_ROOT_PSW || '123456';
    
    await mongoSessionRun(async (session) => {
      // 鲁港通：使用原生 MongoDB 操作，手动控制哈希
      // 前端发送一次哈希，后端再哈希一次，所以这里需要哈希两次
      const passwordHash = hashStr(hashStr(psw));
      
      const result = await usersCollection.insertOne({
        username: 'root',
        password: passwordHash,
        status: 'active',
        createTime: new Date(),
        timezone: 'Asia/Shanghai',
        language: 'zh-CN',
        promotionRate: 0
      });
      
      const rootId = result.insertedId;
      
      // init root team
      await createDefaultTeam({ userId: rootId, session });
      
      console.log(`root user created:`, {
        username: 'root',
        password: psw
      });
    });
  } catch (error) {
    if (retry > 0) {
      console.log('retry init root user');
      return initRootUser(retry - 1);
    } else {
      console.error('init root user error', error);
      exit(1);
    }
  }
}
