/**
 * 鲁港通 - 引用权限控制单元测试
 * Task 12.1: 修改引用显示组件
 */

import { describe, it, expect } from 'vitest';
import {
  isAdminUser,
  isCitationUrl,
  canNormalUserViewCitation,
  canUserViewCitationSource,
  filterCitationsByUserRole
} from './citation';
import { DatasetCollectionTypeEnum } from '../../core/dataset/constants';
import type { SearchDataResponseItemType } from '../../core/dataset/type';

describe('Task 12.1: 引用权限控制', () => {
  describe('isAdminUser - 管理员判断', () => {
    it('should return true for root user', () => {
      expect(isAdminUser('root')).toBe(true);
    });

    it('should return false for normal user', () => {
      expect(isAdminUser('user123')).toBe(false);
    });

    it('should return false for undefined username', () => {
      expect(isAdminUser(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isAdminUser('')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(isAdminUser('Root')).toBe(false);
      expect(isAdminUser('ROOT')).toBe(false);
    });
  });

  describe('isCitationUrl - URL 类型判断', () => {
    it('should return true for link collection type', () => {
      expect(isCitationUrl(DatasetCollectionTypeEnum.link, undefined)).toBe(true);
    });

    it('should return true for http URL in sourceId', () => {
      expect(isCitationUrl(undefined, 'http://example.com')).toBe(true);
    });

    it('should return true for https URL in sourceId', () => {
      expect(isCitationUrl(undefined, 'https://example.com')).toBe(true);
    });

    it('should return false for file collection type', () => {
      expect(isCitationUrl(DatasetCollectionTypeEnum.file, 'file.pdf')).toBe(false);
    });

    it('should return false for non-URL sourceId', () => {
      expect(isCitationUrl(undefined, 'file123')).toBe(false);
    });

    it('should return false for undefined values', () => {
      expect(isCitationUrl(undefined, undefined)).toBe(false);
    });

    it('should handle URL with query parameters', () => {
      expect(isCitationUrl(undefined, 'https://example.com?param=value')).toBe(true);
    });

    it('should handle URL with hash', () => {
      expect(isCitationUrl(undefined, 'https://example.com#section')).toBe(true);
    });
  });

  describe('canNormalUserViewCitation - 普通用户查看权限', () => {
    it('should allow viewing URL citations', () => {
      expect(canNormalUserViewCitation(DatasetCollectionTypeEnum.link, undefined)).toBe(true);
    });

    it('should allow viewing citations with URL sourceId', () => {
      expect(canNormalUserViewCitation(undefined, 'https://example.com')).toBe(true);
    });

    it('should not allow viewing file citations', () => {
      expect(canNormalUserViewCitation(DatasetCollectionTypeEnum.file, 'file.pdf')).toBe(false);
    });

    it('should not allow viewing image citations', () => {
      expect(canNormalUserViewCitation(DatasetCollectionTypeEnum.images, 'image.jpg')).toBe(false);
    });

    it('should not allow viewing external file citations', () => {
      expect(canNormalUserViewCitation(DatasetCollectionTypeEnum.externalFile, 'external.doc')).toBe(false);
    });
  });

  describe('canUserViewCitationSource - 用户查看来源权限', () => {
    it('should allow admin to view all citation types', () => {
      expect(canUserViewCitationSource('root', DatasetCollectionTypeEnum.file, 'file.pdf')).toBe(true);
      expect(canUserViewCitationSource('root', DatasetCollectionTypeEnum.images, 'image.jpg')).toBe(true);
      expect(canUserViewCitationSource('root', DatasetCollectionTypeEnum.link, 'https://example.com')).toBe(true);
    });

    it('should allow normal user to view URL citations only', () => {
      expect(canUserViewCitationSource('user123', DatasetCollectionTypeEnum.link, undefined)).toBe(true);
      expect(canUserViewCitationSource('user123', undefined, 'https://example.com')).toBe(true);
    });

    it('should not allow normal user to view file citations', () => {
      expect(canUserViewCitationSource('user123', DatasetCollectionTypeEnum.file, 'file.pdf')).toBe(false);
    });

    it('should not allow normal user to view image citations', () => {
      expect(canUserViewCitationSource('user123', DatasetCollectionTypeEnum.images, 'image.jpg')).toBe(false);
    });
  });

  describe('filterCitationsByUserRole - 按角色过滤引用列表', () => {
    const mockCitations: SearchDataResponseItemType[] = [
      {
        id: '1',
        q: 'Question 1',
        a: 'Answer 1',
        sourceId: 'https://example.com/page1',
        sourceName: 'Example Page 1',
        collectionId: 'col1',
        datasetId: 'ds1',
        score: []
      },
      {
        id: '2',
        q: 'Question 2',
        a: 'Answer 2',
        sourceId: 'file123',
        sourceName: 'Document.pdf',
        collectionId: 'col2',
        datasetId: 'ds1',
        score: []
      },
      {
        id: '3',
        q: 'Question 3',
        a: 'Answer 3',
        sourceId: 'http://example.com/page2',
        sourceName: 'Example Page 2',
        collectionId: 'col3',
        datasetId: 'ds1',
        score: []
      }
    ];

    it('should return all citations for admin user', () => {
      const filtered = filterCitationsByUserRole(mockCitations, 'root');
      expect(filtered).toHaveLength(3);
      expect(filtered).toEqual(mockCitations);
    });

    it('should return only URL citations for normal user', () => {
      const filtered = filterCitationsByUserRole(mockCitations, 'user123');
      expect(filtered).toHaveLength(2);
      expect(filtered[0].sourceId).toBe('https://example.com/page1');
      expect(filtered[1].sourceId).toBe('http://example.com/page2');
    });

    it('should return empty array when no URL citations for normal user', () => {
      const fileCitations: SearchDataResponseItemType[] = [
        {
          id: '1',
          q: 'Question',
          a: 'Answer',
          sourceId: 'file123',
          sourceName: 'Document.pdf',
          collectionId: 'col1',
          datasetId: 'ds1',
          score: []
        }
      ];
      const filtered = filterCitationsByUserRole(fileCitations, 'user123');
      expect(filtered).toHaveLength(0);
    });

    it('should handle empty citation list', () => {
      const filtered = filterCitationsByUserRole([], 'user123');
      expect(filtered).toHaveLength(0);
    });

    it('should handle undefined username as normal user', () => {
      const filtered = filterCitationsByUserRole(mockCitations, undefined);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Requirement 4.2: 普通用户只显示 URL 引用', () => {
    it('should filter out non-URL citations for normal users', () => {
      const citations: SearchDataResponseItemType[] = [
        {
          id: '1',
          q: 'Q1',
          a: 'A1',
          sourceId: 'https://example.com',
          sourceName: 'URL Source',
          collectionId: 'col1',
          datasetId: 'ds1',
          score: []
        },
        {
          id: '2',
          q: 'Q2',
          a: 'A2',
          sourceId: 'file.pdf',
          sourceName: 'PDF File',
          collectionId: 'col2',
          datasetId: 'ds1',
          score: []
        }
      ];

      const filtered = filterCitationsByUserRole(citations, 'normalUser');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sourceId).toBe('https://example.com');
    });
  });

  describe('Requirement 4.3: 普通用户不显示知识库文件名', () => {
    it('should not allow normal users to view file citations', () => {
      expect(canNormalUserViewCitation(DatasetCollectionTypeEnum.file, 'document.pdf')).toBe(false);
      expect(canNormalUserViewCitation(DatasetCollectionTypeEnum.externalFile, 'external.doc')).toBe(false);
      expect(canNormalUserViewCitation(DatasetCollectionTypeEnum.apiFile, 'api-file.txt')).toBe(false);
    });
  });

  describe('Requirement 4.4: 普通用户不能下载知识库文件', () => {
    it('should not allow normal users to view/download file sources', () => {
      expect(canUserViewCitationSource('user123', DatasetCollectionTypeEnum.file, 'file.pdf')).toBe(false);
      expect(canUserViewCitationSource('user123', DatasetCollectionTypeEnum.images, 'image.jpg')).toBe(false);
    });
  });

  describe('Requirement 4.5: 管理员显示所有引用', () => {
    it('should allow admin to view all citation types', () => {
      const allTypes = [
        DatasetCollectionTypeEnum.file,
        DatasetCollectionTypeEnum.link,
        DatasetCollectionTypeEnum.externalFile,
        DatasetCollectionTypeEnum.apiFile,
        DatasetCollectionTypeEnum.images,
        DatasetCollectionTypeEnum.folder,
        DatasetCollectionTypeEnum.virtual
      ];

      allTypes.forEach((type) => {
        expect(canUserViewCitationSource('root', type, 'any-source')).toBe(true);
      });
    });
  });

  describe('Requirement 4.6: 管理员可以查看和下载', () => {
    it('should allow admin to view and download all sources', () => {
      expect(canUserViewCitationSource('root', DatasetCollectionTypeEnum.file, 'file.pdf')).toBe(true);
      expect(canUserViewCitationSource('root', DatasetCollectionTypeEnum.images, 'image.jpg')).toBe(true);
      expect(canUserViewCitationSource('root', DatasetCollectionTypeEnum.externalFile, 'external.doc')).toBe(true);
    });
  });
});
