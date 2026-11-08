// 鲁港通 - 首页品牌标识：复用思考小圆脸，导航与页脚两种尺寸
import React from 'react';
import ThinkingFace from '@/components/common/ThinkingFace';
import { HOME_ANCHORS, HOME_BRAND_NAME } from './homeData';

export const HomeNavBrand = ({ sub, ariaLabel }: { sub: string; ariaLabel: string }) => (
  <a className="h5-brand" href={`#${HOME_ANCHORS.top}`} aria-label={ariaLabel}>
    <ThinkingFace size={32} />
    <span className="h5-brand-name">
      {HOME_BRAND_NAME}
      <small>{sub}</small>
    </span>
  </a>
);

export const HomeFootBrand = () => (
  <div className="h5-foot-brand">
    <ThinkingFace size={30} />
    <b>{HOME_BRAND_NAME}</b>
  </div>
);
