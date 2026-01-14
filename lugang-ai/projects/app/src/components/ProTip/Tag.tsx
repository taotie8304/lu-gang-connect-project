import React from 'react';
import { useTranslation } from 'next-i18next';
import MyImage from '@fastgpt/web/components/common/Image/MyImage';
import { useSystemStore } from '@/web/common/system/useSystemStore';

const LangMap: Record<string, string> = {
  'zh-CN': '/imgs/proTag.svg',
  en: '/imgs/proTagEng.svg'
};

// 鲁港通 - 隐藏 Pro 标签
const ProTag = () => {
  return null;
};

export default ProTag;
