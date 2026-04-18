import React from 'react';
import { type ImageProps } from '@chakra-ui/react';
import type { AProps } from '../A';

// 鲁港通 - 禁用图片显示功能
// 根据需求 1.1, 1.2, 1.3：完全移除图片显示，避免显示带有第三方联系方式或不合规内容的图片
const MdImage = ({
  src,
  ...props
}: { src?: string } & ImageProps & { chatAuthData?: AProps['chatAuthData'] }) => {
  // 鲁港通 - 完全不显示任何图片内容，静默处理
  // 用户上传的图片功能不受影响（用户上传的图片通过其他组件处理，不经过 Markdown 渲染）
  return null;
};

export default MdImage;
