/**
 * 鲁港通 - 引用权限控制属性测试
 * Task 12.4: 编写引用权限过滤属性测试
 * Property 2: Citation Permission Filtering
 * Validates: Requirements 4.2, 4.3, 4.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isAdminUser,
  isCitationUrl,
  canNormalUserViewCitation,
  canUserViewCitationSource,
  filterCitationsByUserRole
} from './citation';
import { DatasetCollectionTypeEnum } from '../../core/dataset/constants';
import type { SearchDataResponseItemType } from '../../core/dataset/type';

describe('Task 12.4: 引用权限过滤属性测试', () => {
  describe('Property 2: Citation Permission Filtering - Validates Requirements 4.2, 4.3, 4.4', () => {
    it('Property: 对于任意用户名，root 用户总是被识别为管理员', () => {
      fc.assert(
        fc.property(fc.constant('root'), (username) => {
          return isAdminUser(username) === true;
        }),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意非 root 用户名，都不应该被识别为管理员', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => s !== 'root'),
          (username) => {
            return isAdminUser(username) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意 URL 格式的 sourceId，应该被识别为 URL 类型', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            return isCitationUrl(undefined, url) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意 link 类型的集合，应该被识别为 URL 类型', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (sourceId) => {
            return isCitationUrl(DatasetCollectionTypeEnum.link, sourceId) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意文件类型的集合，普通用户不应该能查看', () => {
      const fileTypes = [
        DatasetCollectionTypeEnum.file,
        DatasetCollectionTypeEnum.externalFile,
        DatasetCollectionTypeEnum.apiFile,
        DatasetCollectionTypeEnum.images
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...fileTypes),
          fc.string().filter((s) => s !== 'root'),
          fc.string().filter((s) => !/^https?:\/\//i.test(s)),
          (collectionType, username, sourceId) => {
            return canUserViewCitationSource(username, collectionType, sourceId) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意引用类型，管理员总是可以查看', () => {
      const allTypes = Object.values(DatasetCollectionTypeEnum);

      fc.assert(
        fc.property(
          fc.constantFrom(...allTypes),
          fc.string(),
          (collectionType, sourceId) => {
            return canUserViewCitationSource('root', collectionType, sourceId) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意引用列表，管理员过滤后的结果应该等于原列表', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              q: fc.string(),
              a: fc.string(),
              sourceId: fc.string(),
              sourceName: fc.string(),
              collectionId: fc.string(),
              datasetId: fc.string(),
              score: fc.constant([])
            })
          ),
          (citations) => {
            const filtered = filterCitationsByUserRole(citations, 'root');
            return filtered.length === citations.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意引用列表，普通用户过滤后的结果应该小于等于原列表', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              q: fc.string(),
              a: fc.string(),
              sourceId: fc.string(),
              sourceName: fc.string(),
              collectionId: fc.string(),
              datasetId: fc.string(),
              score: fc.constant([])
            })
          ),
          fc.string().filter((s) => s !== 'root'),
          (citations, username) => {
            const filtered = filterCitationsByUserRole(citations, username);
            return filtered.length <= citations.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意引用列表，普通用户过滤后的结果都应该是 URL 类型', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              q: fc.string(),
              a: fc.string(),
              sourceId: fc.oneof(fc.webUrl(), fc.string()),
              sourceName: fc.string(),
              collectionId: fc.string(),
              datasetId: fc.string(),
              score: fc.constant([])
            })
          ),
          fc.string().filter((s) => s !== 'root'),
          (citations, username) => {
            const filtered = filterCitationsByUserRole(citations, username);
            return filtered.every((citation) => /^https?:\/\//i.test(citation.sourceId || ''));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意 URL 引用，普通用户应该可以查看', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.string().filter((s) => s !== 'root'),
          (url, username) => {
            return canUserViewCitationSource(username, undefined, url) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 权限检查应该是幂等的（多次检查结果相同）', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom(...Object.values(DatasetCollectionTypeEnum)),
          fc.string(),
          (username, collectionType, sourceId) => {
            const result1 = canUserViewCitationSource(username, collectionType, sourceId);
            const result2 = canUserViewCitationSource(username, collectionType, sourceId);
            return result1 === result2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 过滤操作应该保持引用的顺序', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string().filter((s) => s.length > 0), // 确保 id 不为空
              q: fc.string(),
              a: fc.string(),
              sourceId: fc.webUrl(),
              sourceName: fc.string(),
              collectionId: fc.string(),
              datasetId: fc.string(),
              score: fc.constant([])
            }),
            { minLength: 2 }
          ).chain((citations) => {
            // 确保所有 id 都是唯一的
            const uniqueIds = new Set<string>();
            const uniqueCitations = citations.filter((c) => {
              if (uniqueIds.has(c.id)) {
                return false;
              }
              uniqueIds.add(c.id);
              return true;
            });
            return fc.constant(uniqueCitations);
          }),
          fc.string().filter((s) => s !== 'root'),
          (citations, username) => {
            if (citations.length < 2) return true; // 跳过长度小于 2 的情况
            
            const filtered = filterCitationsByUserRole(citations, username);
            // 检查过滤后的引用顺序是否与原列表中的顺序一致
            let lastIndex = -1;
            for (const filteredCitation of filtered) {
              const currentIndex = citations.findIndex((c) => c.id === filteredCitation.id);
              if (currentIndex <= lastIndex) {
                return false;
              }
              lastIndex = currentIndex;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 空引用列表过滤后仍然是空列表', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (username) => {
            const filtered = filterCitationsByUserRole([], username);
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Requirement 4.2: 普通用户只显示 URL 引用', () => {
    it('Property: 对于任意普通用户，过滤后的引用都应该是 URL 类型', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              q: fc.string(),
              a: fc.string(),
              sourceId: fc.oneof(
                fc.webUrl(),
                fc.string().filter((s) => !/^https?:\/\//i.test(s))
              ),
              sourceName: fc.string(),
              collectionId: fc.string(),
              datasetId: fc.string(),
              score: fc.constant([])
            })
          ),
          fc.string().filter((s) => s !== 'root' && s.length > 0),
          (citations, username) => {
            const filtered = filterCitationsByUserRole(citations, username);
            // 所有过滤后的引用都应该是 URL 类型
            return filtered.every((citation) => /^https?:\/\//i.test(citation.sourceId || ''));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Requirement 4.3: 普通用户不显示知识库文件名', () => {
    it('Property: 对于任意文件类型的引用，普通用户不应该能查看', () => {
      const fileTypes = [
        DatasetCollectionTypeEnum.file,
        DatasetCollectionTypeEnum.externalFile,
        DatasetCollectionTypeEnum.apiFile
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...fileTypes),
          fc.string().filter((s) => s !== 'root' && s.length > 0),
          fc.string().filter((s) => !/^https?:\/\//i.test(s)),
          (collectionType, username, sourceId) => {
            return canNormalUserViewCitation(collectionType, sourceId) === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Requirement 4.4: 普通用户不能下载知识库文件', () => {
    it('Property: 对于任意文件类型，普通用户的 canPreview 应该为 false', () => {
      const fileTypes = [
        DatasetCollectionTypeEnum.file,
        DatasetCollectionTypeEnum.externalFile,
        DatasetCollectionTypeEnum.apiFile,
        DatasetCollectionTypeEnum.images
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...fileTypes),
          fc.string().filter((s) => s !== 'root' && s.length > 0),
          fc.string().filter((s) => !/^https?:\/\//i.test(s)),
          (collectionType, username, sourceId) => {
            // 普通用户不能查看/下载文件来源
            return canUserViewCitationSource(username, collectionType, sourceId) === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
