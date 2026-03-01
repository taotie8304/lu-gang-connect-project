/**
 * 鲁港通 - 引用权限控制
 * 根据用户角色过滤引用显示
 */

import { DatasetCollectionTypeEnum } from '../../core/dataset/constants';
import type { SearchDataResponseItemType } from '../../core/dataset/type';

/**
 * 判断用户是否为管理员
 * @param username 用户名
 * @returns 是否为管理员
 */
export const isAdminUser = (username?: string): boolean => {
  return username === 'root';
};

/**
 * 判断引用是否为 URL 类型
 * @param collectionType 集合类型
 * @param sourceId 来源 ID
 * @returns 是否为 URL 类型
 */
export const isCitationUrl = (
  collectionType?: DatasetCollectionTypeEnum,
  sourceId?: string
): boolean => {
  // link 类型是 URL
  if (collectionType === DatasetCollectionTypeEnum.link) {
    return true;
  }
  
  // 如果 sourceId 是 URL 格式，也认为是 URL 类型
  if (sourceId && /^https?:\/\//i.test(sourceId)) {
    return true;
  }
  
  return false;
};

/**
 * 判断普通用户是否可以查看该引用
 * @param collectionType 集合类型
 * @param sourceId 来源 ID
 * @returns 是否可以查看
 */
export const canNormalUserViewCitation = (
  collectionType?: DatasetCollectionTypeEnum,
  sourceId?: string
): boolean => {
  return isCitationUrl(collectionType, sourceId);
};

/**
 * 过滤引用列表，根据用户角色
 * @param citations 引用列表
 * @param username 用户名
 * @returns 过滤后的引用列表
 */
export const filterCitationsByUserRole = (
  citations: SearchDataResponseItemType[],
  username?: string
): SearchDataResponseItemType[] => {
  // 管理员可以看到所有引用
  if (isAdminUser(username)) {
    return citations;
  }
  
  // 普通用户只能看到 URL 类型的引用
  return citations.filter((citation) => {
    // 从 citation 中获取 collectionType
    // 注意：SearchDataResponseItemType 可能没有直接的 collectionType 字段
    // 我们需要通过 sourceId 来判断
    return canNormalUserViewCitation(undefined, citation.sourceId);
  });
};

/**
 * 判断用户是否可以查看/下载引用来源
 * @param username 用户名
 * @param collectionType 集合类型
 * @param sourceId 来源 ID
 * @returns 是否可以查看/下载
 */
export const canUserViewCitationSource = (
  username?: string,
  collectionType?: DatasetCollectionTypeEnum,
  sourceId?: string
): boolean => {
  // 管理员可以查看所有来源
  if (isAdminUser(username)) {
    return true;
  }
  
  // 普通用户只能查看 URL 类型的来源
  return canNormalUserViewCitation(collectionType, sourceId);
};
