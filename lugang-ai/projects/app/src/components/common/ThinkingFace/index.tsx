import React from 'react';
import { Box } from '@chakra-ui/react';

// 鲁港通 - 品牌思考动画：蓝色小圆脸（纯 SVG + CSS，无第三方依赖）。
// 眼睛每 4.2s 眨一次、整张脸轻微上下呼吸；系统开启「减少动态效果」时自动静止。
const ThinkingFace = ({ size = 48 }: { size?: number }) => (
  <Box
    flexShrink={0}
    display="inline-flex"
    w={`${size}px`}
    h={`${size}px`}
    sx={{
      '@keyframes lugangFaceBlink': {
        '0%, 90.5%, 100%': { transform: 'scaleY(1)' },
        '92.5%': { transform: 'scaleY(0.08)' },
        '94.5%': { transform: 'scaleY(1)' }
      },
      '@keyframes lugangFaceBob': {
        '0%, 100%': { transform: 'translateY(0)' },
        '50%': { transform: 'translateY(-2px)' }
      },
      '& svg': {
        display: 'block',
        w: '100%',
        h: '100%',
        animation: 'lugangFaceBob 4.6s ease-in-out infinite'
      },
      '& .lugang-face-eyes': {
        transformOrigin: '32px 41px',
        animation: 'lugangFaceBlink 4.2s infinite'
      },
      '@media (prefers-reduced-motion: reduce)': {
        '& svg, & .lugang-face-eyes': { animation: 'none' }
      }
    }}
  >
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="32" fill="url(#lugang-thinking-bg)" />
      <circle cx="32" cy="58" r="35" fill="url(#lugang-thinking-dome)" />
      <g className="lugang-face-eyes">
        <ellipse cx="24.5" cy="41" rx="4.4" ry="6.4" fill="#c9efff" />
        <ellipse cx="39.5" cy="40.2" rx="4.4" ry="6.4" fill="#c9efff" />
      </g>
      <defs>
        <linearGradient id="lugang-thinking-bg" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#1e7bff" />
          <stop offset="1" stopColor="#38a7ff" />
        </linearGradient>
        <radialGradient id="lugang-thinking-dome" cx="50%" cy="38%" r="66%">
          <stop stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#e7f7ff" />
          <stop offset="1" stopColor="#c3ecff" />
        </radialGradient>
      </defs>
    </svg>
  </Box>
);

export default React.memo(ThinkingFace);
