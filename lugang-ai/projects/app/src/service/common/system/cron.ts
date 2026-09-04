import { setCron } from '@fastgpt/service/common/system/cron';
import { startTrainingQueue } from '@/service/core/dataset/training/utils';
import { clearTmpUploadFiles } from '@fastgpt/service/common/file/utils';
import { checkInvalidDatasetData, checkInvalidVector } from './cronTask';
import { checkTimerLock } from '@fastgpt/service/common/system/timerLock/utils';
import { TimerIdEnum } from '@fastgpt/service/common/system/timerLock/constants';
import { addHours } from 'date-fns';
import { getScheduleTriggerApp } from '@/service/core/app/utils';
import { cronRefreshModels } from '@fastgpt/service/core/ai/config/utils';
import { runSandboxArchiveCron as sandboxCronJob } from '@fastgpt/service/core/ai/sandbox/interface/admin';
import { clearExpiredS3FilesCron } from '@fastgpt/service/common/s3/lifecycle/cleanup';
import { cleanStaleGeneratingChats } from '@fastgpt/service/core/chat/cleanStaleGeneratingChats';
// 鲁港通 - 知识库自动更新调度入口（复用官方 setCron + checkTimerLock 分布式锁，不用 node-cron）
import { runAutoUpdateTask } from '@fastgpt/service/core/dataset/autoUpdate';

// Try to run train every minute
const setTrainingQueueCron = () => {
  setCron('*/1 * * * *', () => {
    startTrainingQueue();
  });
};

// Clear tmp upload files every ten minutes
const setClearTmpUploadFilesCron = () => {
  // Clear tmp upload files every ten minutes
  setCron('*/10 * * * *', () => {
    clearTmpUploadFiles();
  });
};

const clearInvalidDataCron = () => {
  setCron('10 */1 * * *', async () => {
    if (
      await checkTimerLock({
        timerId: TimerIdEnum.checkInvalidDatasetData,
        lockMinuted: 59
      })
    ) {
      checkInvalidDatasetData(addHours(new Date(), -6), addHours(new Date(), -2));
    }
  });

  setCron('30 */1 * * *', async () => {
    if (
      await checkTimerLock({
        timerId: TimerIdEnum.checkInvalidVector,
        lockMinuted: 59
      })
    ) {
      checkInvalidVector(addHours(new Date(), -6), addHours(new Date(), -2));
    }
  });
};

// Run app timer trigger every hour
const scheduleTriggerAppCron = () => {
  setCron('0 */1 * * *', async () => {
    if (
      await checkTimerLock({
        timerId: TimerIdEnum.scheduleTriggerApp,
        lockMinuted: 59
      })
    ) {
      getScheduleTriggerApp();
    }
  });
  getScheduleTriggerApp();
};

/** 鲁港通 - 知识库自动更新：每月 1 号凌晨 2 点执行，遍历启用自动更新的集合重新入库 */
const setDatasetAutoUpdateCron = () => {
  setCron('0 2 1 * *', async () => {
    if (
      await checkTimerLock({
        timerId: TimerIdEnum.datasetAutoUpdate,
        lockMinuted: 60
      })
    ) {
      await runAutoUpdateTask();
    }
  });
};

/** 基于 Redis stream activity 快速纠正异常中断的 generating 会话，保留 30 分钟兜底 */
const cleanStaleGeneratingChatCron = () => {
  setCron('*/1 * * * *', async () => {
    if (
      await checkTimerLock({
        timerId: TimerIdEnum.cleanStaleGeneratingChat,
        lockMinuted: 1
      })
    ) {
      await cleanStaleGeneratingChats();
    }
  });
};

export const startCron = () => {
  setTrainingQueueCron();
  setClearTmpUploadFilesCron();
  clearInvalidDataCron();
  scheduleTriggerAppCron();
  cronRefreshModels();
  clearExpiredS3FilesCron();
  sandboxCronJob();
  cleanStaleGeneratingChatCron();
  setDatasetAutoUpdateCron();
};
