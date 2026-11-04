// 鲁港通 - 智能体记忆前端请求封装
import { GET, POST } from '@/web/common/api/request';
import type {
  UserMemoryCandidateType,
  UserMemoryItemType,
  UserMemoryListResponseType,
  UserMemorySavePropsType
} from '@fastgpt/global/support/memory/type';

export const getUserMemoryList = () => GET<UserMemoryListResponseType>(`/proApi/memory/list`);

export const postSaveUserMemory = (data: UserMemorySavePropsType) =>
  POST<UserMemoryItemType>(`/proApi/memory/save`, data);

export const postToggleUserMemory = (data: { id: string; enabled: boolean }) =>
  POST<UserMemoryItemType>(`/proApi/memory/toggle`, data);

export const postDeleteUserMemory = (id: string) => POST<void>(`/proApi/memory/delete`, { id });

export const postClearUserMemories = () => POST<void>(`/proApi/memory/clear`);

export const postUpdateUserMemorySetting = (data: {
  enabled?: boolean;
  autoExtractEnabled?: boolean;
}) => POST<void>(`/proApi/memory/settings`, data);

export const getChatMemoryCandidates = (chatId: string) =>
  POST<{ list: UserMemoryCandidateType[] }>(`/proApi/memory/candidate/chat`, { chatId });

export const postAdoptMemoryCandidate = (data: { id: string; content?: string }) =>
  POST<UserMemoryItemType>(`/proApi/memory/candidate/adopt`, data);

export const postIgnoreMemoryCandidate = (id: string) =>
  POST<void>(`/proApi/memory/candidate/ignore`, { id });
