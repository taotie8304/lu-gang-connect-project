// 鲁港通 - 视频平台识别与缩略图生成工具函数

export type VideoPlatform = 'youtube' | 'bilibili' | 'douyin' | 'xiaohongshu';

export type VideoDetectResult = {
  platform: VideoPlatform;
  videoId: string;
};

const VIDEO_PLATFORMS: {
  platform: VideoPlatform;
  pattern: RegExp;
}[] = [
  {
    platform: 'youtube',
    pattern: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
  },
  {
    platform: 'bilibili',
    pattern: /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/
  },
  {
    platform: 'douyin',
    pattern: /douyin\.com\/video\/(\d+)/
  },
  {
    platform: 'xiaohongshu',
    pattern: /xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/
  }
];

/**
 * 识别 URL 是否属于已知视频平台
 * 返回平台名称和视频 ID，未匹配返回 null
 */
export function detectVideoPlatform(url: string): VideoDetectResult | null {
  if (!url) return null;

  for (const { platform, pattern } of VIDEO_PLATFORMS) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return { platform, videoId: match[1] };
    }
  }
  return null;
}

/**
 * 获取视频缩略图 URL
 * - YouTube：直接通过 videoId 构造缩略图地址
 * - 其他平台：返回 null，由调用方降级为平台图标
 */
export function getVideoThumbnail(url: string): string | null {
  const result = detectVideoPlatform(url);
  if (!result) return null;

  if (result.platform === 'youtube') {
    return `https://img.youtube.com/vi/${result.videoId}/mqdefault.jpg`;
  }

  // B站、抖音、小红书需要 API 调用获取缩略图，降级处理
  return null;
}
