// 鲁港通 - 首页品牌标识：导航用史莱姆小头像（保留眨眼），页脚沿用思考小圆脸
import React from 'react';
import ThinkingFace from '@/components/common/ThinkingFace';
import { HOME_ANCHORS, HOME_BRAND_NAME } from './homeData';

export const HomeNavBrand = ({ sub, ariaLabel }: { sub: string; ariaLabel: string }) => (
  <a className="h5-brand" href={`#${HOME_ANCHORS.top}`} aria-label={ariaLabel}>
    <span className="h5-brand-face" aria-hidden="true">
      <img src="/imgs/home-mascot-base.webp" alt="" draggable={false} />
      <span className="h5-brand-eyes">
        <i className="h5-brand-eye left" />
        <i className="h5-brand-eye right" />
      </span>
    </span>
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
