import React from 'react';
import { Box } from '@chakra-ui/react';

// 鲁港通 - 品牌思考动画：蓝色小圆脸（纯 SVG + CSS，无第三方依赖）。
// 10s 主循环：眨眼 → 向左扭头 → 向右扭头 → 思考（-"- 眼睛 + 头顶三个问号）→ 回到待机。
// 全部由 CSS 关键帧驱动，不产生服务端开销；系统开启「减少动态效果」时自动静止。
const ThinkingFace = ({ size = 48 }: { size?: number }) => (
  <Box
    flexShrink={0}
    display="inline-flex"
    w={`${size}px`}
    h={`${size}px`}
    sx={{
      '@keyframes lugangFaceTurn': {
        '0%, 20%': { transform: 'rotate(0deg) translateX(0)' },
        '26%': { transform: 'rotate(-7deg) translateX(-2px)' },
        '38%': { transform: 'rotate(-7deg) translateX(-2px)' },
        '44%': { transform: 'rotate(0deg) translateX(0)' },
        '50%': { transform: 'rotate(7deg) translateX(2px)' },
        '62%': { transform: 'rotate(7deg) translateX(2px)' },
        '68%': { transform: 'rotate(-3deg) translateY(-1px)' },
        '86%': { transform: 'rotate(-3deg) translateY(-1px)' },
        '93%, 100%': { transform: 'rotate(0deg) translateX(0)' }
      },
      '@keyframes lugangFaceBlink': {
        '0%, 4.4%': { transform: 'scaleY(1)' },
        '5.6%': { transform: 'scaleY(0.08)' },
        '6.8%': { transform: 'scaleY(1)' },
        '15.4%': { transform: 'scaleY(1)' },
        '16.6%': { transform: 'scaleY(0.08)' },
        '17.8%': { transform: 'scaleY(1)' },
        '46.6%': { transform: 'scaleY(1)' },
        '47.8%': { transform: 'scaleY(0.08)' },
        '49%, 100%': { transform: 'scaleY(1)' }
      },
      '@keyframes lugangFaceEyesOpenFade': {
        '0%, 64%': { opacity: 1 },
        '66%, 88%': { opacity: 0 },
        '90%, 100%': { opacity: 1 }
      },
      '@keyframes lugangFaceEyesThinkFade': {
        '0%, 64%': { opacity: 0 },
        '66%, 88%': { opacity: 1 },
        '90%, 100%': { opacity: 0 }
      },
      '@keyframes lugangFaceQPop': {
        '0%, 64%': { opacity: 0, transform: 'translateY(4px) scale(0.3)' },
        '67%': { opacity: 1, transform: 'translateY(0) scale(1.15)' },
        '69%': { opacity: 1, transform: 'translateY(0) scale(1)' },
        '78%': { opacity: 1, transform: 'translateY(-1.5px) scale(1)' },
        '86%': { opacity: 1, transform: 'translateY(0) scale(1)' },
        '89%, 100%': { opacity: 0, transform: 'translateY(-2px) scale(0.85)' }
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
      '& .lugang-face-turn': {
        transformOrigin: '32px 60px',
        animation: 'lugangFaceTurn 10s ease-in-out infinite'
      },
      '& .lugang-face-eyes-open': {
        transformOrigin: '32px 41px',
        animation: 'lugangFaceBlink 10s infinite, lugangFaceEyesOpenFade 10s infinite'
      },
      '& .lugang-face-eyes-think': {
        opacity: 0,
        animation: 'lugangFaceEyesThinkFade 10s infinite'
      },
      '& .lugang-face-q': {
        opacity: 0,
        transformBox: 'fill-box',
        transformOrigin: 'center'
      },
      '& .lugang-face-q1': { animation: 'lugangFaceQPop 10s infinite' },
      '& .lugang-face-q2': { animation: 'lugangFaceQPop 10s 0.16s infinite' },
      '& .lugang-face-q3': { animation: 'lugangFaceQPop 10s 0.32s infinite' },
      '@media (prefers-reduced-motion: reduce)': {
        '& svg, & .lugang-face-turn, & .lugang-face-eyes-open, & .lugang-face-eyes-think, & .lugang-face-q1, & .lugang-face-q2, & .lugang-face-q3':
          { animation: 'none' },
        '& .lugang-face-eyes-open': { opacity: 1 },
        '& .lugang-face-eyes-think': { opacity: 0 },
        '& .lugang-face-q': { opacity: 0 }
      }
    }}
  >
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="32" fill="url(#lugang-thinking-bg)" />
      <g clipPath="url(#lugang-thinking-clip)">
        <g className="lugang-face-turn">
          <circle cx="32" cy="58" r="35" fill="url(#lugang-thinking-dome)" />
          <g className="lugang-face-eyes-open">
            <ellipse cx="24.5" cy="41" rx="4.4" ry="6.4" fill="#c9efff" />
            <ellipse cx="39.5" cy="40.2" rx="4.4" ry="6.4" fill="#c9efff" />
          </g>
          <g className="lugang-face-eyes-think">
            <rect x="20.2" y="39.6" width="8.6" height="2.9" rx="1.45" fill="#c9efff" />
            <rect
              x="36.4"
              y="39.2"
              width="7.6"
              height="2.9"
              rx="1.45"
              fill="#c9efff"
              transform="rotate(-20 40.2 40.65)"
            />
          </g>
        </g>
      </g>
      <text
        className="lugang-face-q lugang-face-q1"
        x="21"
        y="17"
        fill="#eaf7ff"
        fontSize="13.5"
        fontWeight="700"
        fontFamily={'ui-rounded, "Segoe UI", "PingFang SC", sans-serif'}
      >
        ?
      </text>
      <text
        className="lugang-face-q lugang-face-q2"
        x="31"
        y="13"
        fill="#eaf7ff"
        fontSize="13.5"
        fontWeight="700"
        fontFamily={'ui-rounded, "Segoe UI", "PingFang SC", sans-serif'}
      >
        ?
      </text>
      <text
        className="lugang-face-q lugang-face-q3"
        x="41.5"
        y="17"
        fill="#eaf7ff"
        fontSize="13.5"
        fontWeight="700"
        fontFamily={'ui-rounded, "Segoe UI", "PingFang SC", sans-serif'}
      >
        ?
      </text>
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
        {/* 鲁港通 - 裁剪在蓝色圆内，保证淡蓝小圆脸始终是圆形，不出现方角 */}
        <clipPath id="lugang-thinking-clip">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
    </svg>
  </Box>
);

export default React.memo(ThinkingFace);
