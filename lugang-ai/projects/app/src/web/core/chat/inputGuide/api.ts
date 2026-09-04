import { GET, POST, PUT } from '@/web/common/api/request';
import type {
  ChatInputGuideListBodyType,
  ChatInputGuideListResponseType,
  CountChatInputGuideTotalQueryType,
  CountChatInputGuideTotalResponseType,
  CreateChatInputGuideBodyType,
  CreateChatInputGuideResponseType,
  UpdateChatInputGuideBodyType,
  DeleteChatInputGuideBodyType,
  QueryChatInputGuideBodyType,
  QueryChatInputGuideResponseType,
  DeleteAllChatInputGuideBodyType
} from '@fastgpt/global/openapi/core/chat/inputGuide/api';
import { toChatAuthQueryInput } from '@/web/core/chat/utils';

export const getCountChatInputGuideTotal = (data: CountChatInputGuideTotalQueryType) =>
  GET<CountChatInputGuideTotalResponseType>(`/core/chat/inputGuide/countTotal`, data);
/**
 * Get chat input guide list
 */
export const getChatInputGuideList = (data: ChatInputGuideListBodyType) =>
  POST<ChatInputGuideListResponseType>(`/core/chat/inputGuide/list`, data);

// 鲁港通 - 输入引导自定义地址协议白名单：仅允许 http/https（与官方配置入口 useInputGuideConfigForm 的 isHttpUrl 同口径）。
// ChatInputGuideConfigTypeSchema 的 customUrl 仅为 z.string()，经 OpenAPI 直改应用配置或旧版本数据迁移可绕过前端校验，
// 故在运行时再做一次纵深防御；不合法时静默回退官方默认接口，不向用户抛错。
const isSafeInputGuideUrl = (url: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

export const queryChatInputGuideList = (data: QueryChatInputGuideBodyType, url?: string) => {
  if (url && isSafeInputGuideUrl(url)) {
    return GET<QueryChatInputGuideResponseType>(url, toChatAuthQueryInput(data), {
      withCredentials: !url
    });
  }
  return POST<QueryChatInputGuideResponseType>(`/core/chat/inputGuide/query`, data, {
    maxQuantity: 1
  });
};

export const postChatInputGuides = (data: CreateChatInputGuideBodyType) =>
  POST<CreateChatInputGuideResponseType>(`/core/chat/inputGuide/create`, data);
export const putChatInputGuide = (data: UpdateChatInputGuideBodyType) =>
  PUT(`/core/chat/inputGuide/update`, data);
export const delChatInputGuide = (data: DeleteChatInputGuideBodyType) =>
  POST(`/core/chat/inputGuide/delete`, data);
export const delAllChatInputGuide = (data: DeleteAllChatInputGuideBodyType) =>
  POST(`/core/chat/inputGuide/deleteAll`, data);
