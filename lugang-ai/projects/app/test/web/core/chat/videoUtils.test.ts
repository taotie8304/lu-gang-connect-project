import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectVideoPlatform,
  getVideoThumbnail
} from '@fastgpt/global/common/string/videoUtils';

// Feature: citation-optimization, Property 3: 视频平台识别与缩略图生成
// Validates: Requirements 3.1, 3.5

const ytChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
const alnumChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const lowerAlnumChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
const digitChars = '0123456789';

function arbStringFrom(chars: string, min: number, max: number): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...chars.split('')), { minLength: min, maxLength: max })
    .map((arr) => arr.join(''));
}

// YouTube video ID（11位）
const arbYoutubeId = arbStringFrom(ytChars, 11, 11);

// B站 BV 号
const arbBvId = arbStringFrom(alnumChars, 10, 10).map((s) => `BV${s}`);

// 抖音视频 ID（纯数字）
const arbDouyinId = arbStringFrom(digitChars, 10, 19);

// 小红书笔记 ID
const arbXhsId = arbStringFrom(lowerAlnumChars, 10, 24);

// YouTube URL 生成器
const arbYoutubeUrl = fc.oneof(
  arbYoutubeId.map((id) => ({ url: `https://www.youtube.com/watch?v=${id}`, id })),
  arbYoutubeId.map((id) => ({ url: `https://youtu.be/${id}`, id }))
);

// B站 URL 生成器
const arbBilibiliUrl = arbBvId.map((id) => ({
  url: `https://www.bilibili.com/video/${id}`,
  id
}));

// 抖音 URL 生成器
const arbDouyinUrl = arbDouyinId.map((id) => ({
  url: `https://www.douyin.com/video/${id}`,
  id
}));

// 小红书 URL 生成器
const arbXhsUrl = fc.oneof(
  arbXhsId.map((id) => ({ url: `https://www.xiaohongshu.com/explore/${id}`, id })),
  arbXhsId.map((id) => ({ url: `https://www.xiaohongshu.com/discovery/item/${id}`, id }))
);

describe('detectVideoPlatform & getVideoThumbnail - Property 3: 视频平台识别与缩略图生成', () => {
  it('for all YouTube URLs, detectVideoPlatform returns youtube with correct videoId', () => {
    fc.assert(
      fc.property(arbYoutubeUrl, ({ url, id }) => {
        const result = detectVideoPlatform(url);
        expect(result).not.toBeNull();
        expect(result!.platform).toBe('youtube');
        expect(result!.videoId).toBe(id);
      }),
      { numRuns: 20 }
    );
  });

  it('for all YouTube URLs, getVideoThumbnail returns a URL containing the videoId', () => {
    fc.assert(
      fc.property(arbYoutubeUrl, ({ url, id }) => {
        const thumbnail = getVideoThumbnail(url);
        expect(thumbnail).not.toBeNull();
        expect(thumbnail).toContain(id);
        expect(thumbnail).toMatch(/^https:\/\/img\.youtube\.com\/vi\//);
      }),
      { numRuns: 20 }
    );
  });

  it('for all Bilibili URLs, detectVideoPlatform returns bilibili with correct BV id', () => {
    fc.assert(
      fc.property(arbBilibiliUrl, ({ url, id }) => {
        const result = detectVideoPlatform(url);
        expect(result).not.toBeNull();
        expect(result!.platform).toBe('bilibili');
        expect(result!.videoId).toBe(id);
      }),
      { numRuns: 20 }
    );
  });

  it('for all Douyin URLs, detectVideoPlatform returns douyin with correct video id', () => {
    fc.assert(
      fc.property(arbDouyinUrl, ({ url, id }) => {
        const result = detectVideoPlatform(url);
        expect(result).not.toBeNull();
        expect(result!.platform).toBe('douyin');
        expect(result!.videoId).toBe(id);
      }),
      { numRuns: 20 }
    );
  });

  it('for all Xiaohongshu URLs, detectVideoPlatform returns xiaohongshu with correct id', () => {
    fc.assert(
      fc.property(arbXhsUrl, ({ url, id }) => {
        const result = detectVideoPlatform(url);
        expect(result).not.toBeNull();
        expect(result!.platform).toBe('xiaohongshu');
        expect(result!.videoId).toBe(id);
      }),
      { numRuns: 20 }
    );
  });

  it('for all non-YouTube video platforms, getVideoThumbnail returns null (fallback)', () => {
    fc.assert(
      fc.property(
        fc.oneof(arbBilibiliUrl, arbDouyinUrl, arbXhsUrl),
        ({ url }) => {
          const thumbnail = getVideoThumbnail(url);
          expect(thumbnail).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });
});
