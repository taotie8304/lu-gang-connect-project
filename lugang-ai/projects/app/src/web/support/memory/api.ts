// 鲁港通 - 智能体记忆前端请求封装
import { GET, POST } from '@/web/common/api/request';
import type {
  UserMemoryItemType,
  UserMemoryListResponseType,
  UserMemorySavePropsType
} from '@fastgpt/global/support/memory/type';

export const getUserMemoryList = () =>
  GET<UserMemoryListResponseType>(`/proApi/memory/list`);

export const postSaveUserMemory = (data: UserMemorySavePropsType) =>
  POST<UserMemoryItemType>(`/proApi/memory/save`, data);

export const postToggleUserMemory = (data: { id: string; enabled: boolean }) =>
  POST<UserMemoryItemType>(`/proApi/memory/toggle`, data);

export const postDeleteUserMemory = (id: string) =>
  POST<void>(`/proApi/memory/delete`, { id });

export const postClearUserMemories = () => POST<void>(`/proApi/memory/clear`);

export const postUpdateUserMemorySetting = (enabled: boolean) =>
  POST<void>(`/proApi/memory/settings`, { enabled });
