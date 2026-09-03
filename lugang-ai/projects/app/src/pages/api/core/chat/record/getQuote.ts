import { NextAPI } from '@/service/middleware/entry';
import { authCollectionInChat } from '@/service/support/permission/auth/chat';
import { authChatTargetCrud, isRootChatViewer } from '@/service/support/permission/auth/chat';
import { MongoDatasetData } from '@fastgpt/service/core/dataset/data/schema';
import { type ApiRequestProps } from '@fastgpt/next/type';
import { quoteDataFieldSelector } from '@/service/core/chat/constants';
import { processChatTimeFilter } from '@/service/core/chat/utils';
import { ChatErrEnum } from '@fastgpt/global/common/error/code/chat';
import { getFormatDatasetCiteList } from '@fastgpt/service/core/dataset/data/controller';
import { MongoChatItem } from '@fastgpt/service/core/chat/chatItemSchema';
import {
  GetQuoteBodySchema,
  GetQuoteResponseSchema,
  type GetQuoteResponseType
} from '@fastgpt/global/openapi/core/chat/record/api';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import { buildChatSourceQuery } from '@fastgpt/service/core/chat/source';

async function handler(req: ApiRequestProps): Promise<GetQuoteResponseType> {
  const {
    sourceType,
    sourceId,
    chatId,
    chatItemDataId,
    outLinkAuthData,
    collectionIdList,
    datasetDataIdList
  } = parseApiInput({ req, bodySchema: GetQuoteBodySchema }).body;

  const authRes = await authChatTargetCrud({
    req,
    authToken: true,
    authApiKey: true,
    sourceType,
    sourceId,
    chatId,
    outLinkAuthData
  });
  const resolvedSourceId = authRes.sourceId;

  const [chatItem] = await Promise.all([
    MongoChatItem.findOne(
      {
        ...buildChatSourceQuery({ sourceType, sourceId: resolvedSourceId }),
        chatId,
        dataId: chatItemDataId
      },
      'time'
    ).lean(),
    authCollectionInChat({
      sourceType,
      sourceId: resolvedSourceId,
      chatId: chatId!,
      collectionIds: collectionIdList
    })
  ]);
  if (!authRes.chat || !chatItem || !authRes.showCite) {
    return Promise.reject(ChatErrEnum.unAuthChat);
  }

  const list = await MongoDatasetData.find(
    { _id: { $in: datasetDataIdList }, collectionId: { $in: collectionIdList } },
    quoteDataFieldSelector
  ).lean();

  const formatPreviewUrlList = await getFormatDatasetCiteList(list);
  const quoteList = processChatTimeFilter(formatPreviewUrlList, chatItem.time);

  // 鲁港通 - 引用内容权限：仅 root 管理员可查看知识库分块正文；
  // 普通用户/外链访客剥离 q/a 等正文，仅保留来源标识，确保无法查看与下载内容。
  const isRoot = await isRootChatViewer(req);
  const safeQuoteList = isRoot
    ? quoteList
    : quoteList.map((item) => ({
        ...item,
        q: '',
        a: undefined,
        imagePreivewUrl: undefined,
        history: undefined
      }));

  return GetQuoteResponseSchema.parse(safeQuoteList);
}

export default NextAPI(handler);
