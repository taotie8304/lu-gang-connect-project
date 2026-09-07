import { MongoUser } from '@fastgpt/service/support/user/schema';
import { hashStr } from '@fastgpt/global/common/string/tools';
import { createDefaultTeam } from '@fastgpt/service/support/user/team/controller';
import { exit } from 'process';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { getLogger, LogCategories } from '@fastgpt/service/common/logger';
import { appEnv } from '@/env';

const logger = getLogger(LogCategories.SYSTEM);

export async function initRootUser(retry = 3): Promise<any> {
  try {
    const rootUser = await MongoUser.findOne({
      username: 'root'
    });
    const psw = appEnv.DEFAULT_ROOT_PSW;

    let rootId = rootUser?._id || '';

    await mongoSessionRun(async (session) => {
      // 鲁港通 - root 已存在时不重置密码（沿用 4.14.4 定制）：官方行为会在每次启动把 root 密码强制改回
      // DEFAULT_ROOT_PSW，导致升级后管理员密码失效、且以后改密一重启就被重置。此处仅在 root 不存在时创建。
      if (!rootUser) {
        // init root user
        const [{ _id }] = await MongoUser.create(
          [
            {
              username: 'root',
              password: hashStr(psw)
            }
          ],
          { session, ordered: true }
        );
        rootId = _id;
      }
      // init root team
      await createDefaultTeam({ userId: rootId, session });
    });

    logger.info('Root user initialized', {
      username: 'root',
      fromEnvPassword: appEnv.DEFAULT_ROOT_PSW !== '123456'
    });
  } catch (error) {
    if (retry > 0) {
      logger.warn('Retrying root user initialization', { retryLeft: retry - 1 });
      return initRootUser(retry - 1);
    } else {
      logger.error('Root user initialization failed', { error });
      exit(1);
    }
  }
}
