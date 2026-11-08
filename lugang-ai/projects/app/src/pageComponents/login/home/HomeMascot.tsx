// 鲁港通 - 史莱姆吉祥物：原版圆滚滚形象 + 可动眼睛（眨眼 / 左右看 / 眯眼 / 圆眼）
import React from 'react';

const HomeMascot = ({ className }: { className?: string }) => (
  <span className={`h5-mascot-figure${className ? ` ${className}` : ''}`}>
    <img
      className="h5-mascot-img"
      src="/imgs/home-mascot-base.webp"
      alt=""
      draggable={false}
    />
    <span className="h5-eyes" data-face="idle" aria-hidden="true">
      <i className="h5-eye left" />
      <i className="h5-eye right" />
    </span>
  </span>
);

export default HomeMascot;
