// 鲁港通 - 引用权限控制：普通用户不可查看/下载管理员上传的知识库文件内容，仅可见文件名；URL 类来源仍可点击打开。

import { DatasetCollectionTypeEnum } from '../../core/dataset/constants';

/**
 * 判断用户是否为 root 管理员。
 * 与深度思考（D5）门控口径一致：username === 'root'。
 * @param username 用户名
 * @returns 是否为 root 管理员
 */
export const isAdminUser = (username?: string): boolean => username === 'root';

/**
 * 判断引用来源是否为 URL 类型（可对外点击打开，不涉及知识库正文）。
 * @param collectionType 集合类型（可选，引用精简项可能不含此字段）
 * @param sourceId 来源 ID，链接类集合其为 http(s) 网址
 * @returns 是否为 URL 类型来源
 */
export const isCitationUrl = (
  collectionType?: DatasetCollectionTypeEnum,
  sourceId?: string
): boolean => {
  if (collectionType === DatasetCollectionTypeEnum.link) return true;
  if (sourceId && /^https?:\/\//i.test(sourceId)) return true;
  return false;
};

/**
 * 判断用户是否可查看/打开某引用来源：
 * - root 管理员：可查看全部（含知识库分块正文）；
 * - 普通用户：仅可打开 URL 类来源（外链网址），不可查看知识库文件内容。
 * @param username 用户名
 * @param collectionType 集合类型（可选）
 * @param sourceId 来源 ID
 * @returns 是否可查看/打开该来源
 */
export const canUserViewCitationSource = (
  username?: string,
  collectionType?: DatasetCollectionTypeEnum,
  sourceId?: string
): boolean => {
  if (isAdminUser(username)) return true;
  return isCitationUrl(collectionType, sourceId);
};
