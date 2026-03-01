// 鲁港通 - 外链工具模块
import axios from 'axios';
import { MongoOutLink } from './schema';
import { FastGPTProUrl } from '../../common/system/constants';
import { type ChatHistoryItemResType } from '@fastgpt/global/core/chat/type';

// 鲁港通 - 添加外链使用记录
export const addOutLinkUsage = ({
  shareId,
  totalPoints
}: {
  shareId: string;
  totalPoints: number;
}) => {
  return MongoOutLink.findOneAndUpdate(
    { shareId },
    {
      $inc: { usagePoints: totalPoints },
      lastTime: new Date()
    }
  ).catch((err) => {
    console.log('鲁港通 - 更新分享聊天记录失败', err);
  });
};

// 鲁港通 - 推送结果到远程服务
export const pushResult2Remote = async ({
  outLinkUid,
  shareId,
  appName,
  flowResponses
}: {
  outLinkUid?: string; // raw id, not parse
  shareId?: string;
  appName: string;
  flowResponses?: ChatHistoryItemResType[];
}) => {
  // 鲁港通 - 未配置商业版或缺少必要参数时直接返回
  if (!shareId || !outLinkUid || !FastGPTProUrl) return;
  try {
    const outLink = await MongoOutLink.findOne({
      shareId
    });
    if (!outLink?.limit?.hookUrl) return;

    axios({
      method: 'post',
      baseURL: outLink.limit.hookUrl,
      url: '/shareAuth/finish',
      data: {
        token: outLinkUid,
        appName,
        responseData: flowResponses
      }
    });
  } catch (error) {
    // 鲁港通 - 静默处理错误
  }
};
