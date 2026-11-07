/**
 * 鲁港通 - 关于页（视差介绍版）
 * 深色全屏视差介绍：品牌小圆脸 Hero / 南下 / 北上 / 使命宣言 / 发展历程 / 创始人 / 生态伙伴 / 联系我们。
 * 全局 body 禁用滚动，因此本页自带滚动容器；滚动进度、导航毛玻璃、卡片入场与视差全部由本页驱动。
 */
import { useEffect, useRef } from 'react';
import NextLink from 'next/link';
import { useTranslation } from 'next-i18next';
import I18nLngSelector from '@/components/Select/I18nLngSelector';
import { calcParallaxOffset, calcScrollProgress, shouldRevealImmediately } from './scrollFx';

// 鲁港通 - 品牌小圆脸（导航与 Hero 共用，id 前缀必须唯一）
const BrandFace = ({ idPrefix }: { idPrefix: string }) => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <clipPath id={`${idPrefix}-clip`}>
        <rect width="64" height="64" rx="15" />
      </clipPath>
      <linearGradient id={`${idPrefix}-bg`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#1e7bff" />
        <stop offset="1" stopColor="#38a7ff" />
      </linearGradient>
      <radialGradient id={`${idPrefix}-dome`} cx="50%" cy="38%" r="66%">
        <stop offset="0" stopColor="#fff" />
        <stop offset=".55" stopColor="#e7f7ff" />
        <stop offset="1" stopColor="#c3ecff" />
      </radialGradient>
    </defs>
    <g clipPath={`url(#${idPrefix}-clip)`}>
      <rect width="64" height="64" fill={`url(#${idPrefix}-bg)`} />
      <circle cx="32" cy="58" r="35" fill={`url(#${idPrefix}-dome)`} />
    </g>
    <ellipse className="lg-eye" cx="24.5" cy="41" rx="4.4" ry="6.4" fill="#c9efff" />
    <ellipse className="lg-eye lg-eye-b" cx="39.5" cy="40.2" rx="4.4" ry="6.4" fill="#c9efff" />
  </svg>
);

// 鲁港通 - Hero 三大定位
const HERO_CHIPS = [
  'login:about_hero_card1',
  'login:about_hero_card2',
  'login:about_hero_card3'
] as const;

type ChapterCard = { no: string; title: string; text: string };
type Chapter = {
  id: string;
  index: string;
  watermark: string;
  parallax: string;
  bgClass: string;
  titleLead: string;
  titleAccent: string;
  mission: string;
  cards: ChapterCard[];
};

// 鲁港通 - 南下 / 北上双章节（190vh 滚动驱动 sticky 停留）
const CHAPTERS: Chapter[] = [
  {
    id: 'south',
    index: '01 / SOUTHBOUND',
    watermark: '01',
    parallax: '-0.06',
    bgClass: 'lg-bg-south',
    titleLead: 'login:about_south_title_lead',
    titleAccent: 'login:about_south_title_accent',
    mission: 'login:about_south_mission',
    cards: [
      {
        no: '01 — COMPLIANCE',
        title: 'login:about_south_card1_title',
        text: 'login:about_south_card1_text'
      },
      {
        no: '02 — IDENTITY',
        title: 'login:about_south_card2_title',
        text: 'login:about_south_card2_text'
      },
      {
        no: '03 — CAPITAL',
        title: 'login:about_south_card3_title',
        text: 'login:about_south_card3_text'
      }
    ]
  },
  {
    id: 'north',
    index: '02 / NORTHBOUND',
    watermark: '02',
    parallax: '0.05',
    bgClass: 'lg-bg-north',
    titleLead: 'login:about_north_title_lead',
    titleAccent: 'login:about_north_title_accent',
    mission: 'login:about_north_mission',
    cards: [
      {
        no: '01 — INVESTMENT',
        title: 'login:about_north_card1_title',
        text: 'login:about_north_card1_text'
      },
      {
        no: '02 — INNOVATION',
        title: 'login:about_north_card2_title',
        text: 'login:about_north_card2_text'
      },
      {
        no: '03 — YOUTH',
        title: 'login:about_north_card3_title',
        text: 'login:about_north_card3_text'
      }
    ]
  }
];

// 鲁港通 - 创始人社会职务
const FOUNDER_POSTS = [
  'login:about_founder_post1',
  'login:about_founder_post2',
  'login:about_founder_post3',
  'login:about_founder_post4',
  'login:about_founder_post5',
  'login:about_founder_post6'
] as const;

// 鲁港通 - 核心社团（单字徽记 + 名称）
const COMMUNITIES = [
  { mark: '鲁', name: 'login:about_partners_c1' },
  { mark: '侨', name: 'login:about_partners_c2' },
  { mark: '青', name: 'login:about_partners_c3' },
  { mark: '湾', name: 'login:about_partners_c4' }
] as const;

// 鲁港通 - 政府及官方机构（英文缩写徽记，避免外链 Logo 失效与视觉噪声）
const GOV_PARTNERS = [
  { mark: 'INV', name: 'login:about_partners_gov1_name', desc: 'login:about_partners_gov1_desc' },
  { mark: 'EDU', name: 'login:about_partners_gov2_name', desc: 'login:about_partners_gov2_desc' },
  { mark: 'HYAB', name: 'login:about_partners_gov3_name', desc: 'login:about_partners_gov3_desc' },
  { mark: 'HKTB', name: 'login:about_partners_gov4_name', desc: 'login:about_partners_gov4_desc' }
] as const;

// 鲁港通 - 页面级样式：所有选择器带 lg- 前缀，避免影响语言切换器等全局组件
const ABOUT_CSS = `
.lg-about {
  --lg-ink: #071426;
  --lg-ink-2: #0b1e33;
  --lg-blue: #1e7bff;
  --lg-blue-2: #38a7ff;
  --lg-gold: #e8c98a;
  --lg-paper: #f4f7fb;
  --lg-muted: rgba(233, 241, 250, 0.68);
  --lg-line: rgba(255, 255, 255, 0.12);
  --lg-max: 1160px;
  --lg-sy: 0px;
  --lg-vh: calc(100vh - var(--lugang-titlebar-height, 0px));
  position: relative;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  background: var(--lg-ink);
  color: var(--lg-paper);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  -webkit-font-smoothing: antialiased;
  scrollbar-width: thin;
  scrollbar-color: rgba(56, 167, 255, 0.35) transparent;
}
@supports (height: 100svh) {
  .lg-about { --lg-vh: calc(100svh - var(--lugang-titlebar-height, 0px)); }
}
.lg-about * { box-sizing: border-box; }
.lg-about ::selection { background: rgba(56, 167, 255, 0.35); }
.lg-about a { color: inherit; text-decoration: none; }
.lg-about h1, .lg-about h2, .lg-about h3, .lg-about p, .lg-about blockquote { margin: 0; }
.lg-about::-webkit-scrollbar { width: 10px; }
.lg-about::-webkit-scrollbar-track { background: #050e1a; }
.lg-about::-webkit-scrollbar-thumb { background: rgba(56, 167, 255, 0.3); border-radius: 8px; }
.lg-about::-webkit-scrollbar-thumb:hover { background: rgba(56, 167, 255, 0.5); }

.lg-anchor { scroll-margin-top: 84px; }

.lg-progress {
  position: fixed; left: 0; right: 0; top: var(--lugang-titlebar-height, 0px);
  height: 2px; z-index: 60; pointer-events: none;
  background: linear-gradient(90deg, var(--lg-blue), var(--lg-blue-2), var(--lg-gold));
  transform: scaleX(0); transform-origin: 0 50%;
}

.lg-nav {
  position: fixed; left: 0; right: 0; top: var(--lugang-titlebar-height, 0px); z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px clamp(20px, 4vw, 56px);
  border-bottom: 1px solid transparent;
  transition: background .35s ease, padding .35s ease, border-color .35s ease;
}
.lg-nav.lg-scrolled {
  padding-top: 10px; padding-bottom: 10px;
  background: rgba(5, 14, 26, 0.72);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-bottom-color: var(--lg-line);
}
.lg-brand { display: flex; align-items: center; gap: 12px; font-weight: 600; letter-spacing: .04em; font-size: 16px; color: #fff; }
.lg-brand svg { width: 34px; height: 34px; border-radius: 10px; box-shadow: 0 8px 24px rgba(30, 123, 255, .35); flex: none; }
.lg-brand small { display: block; font-size: 10px; letter-spacing: .22em; color: var(--lg-muted); font-weight: 400; margin-top: 2px; }
.lg-nav-right { display: flex; align-items: center; gap: clamp(12px, 2vw, 26px); }
.lg-nav-links { display: flex; align-items: center; gap: clamp(14px, 2.4vw, 30px); font-size: 13px; color: var(--lg-muted); }
.lg-nav-links a { position: relative; transition: color .2s ease; }
.lg-nav-links a::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 1px;
  background: var(--lg-blue-2); transform: scaleX(0); transition: transform .25s ease;
}
.lg-nav-links a:hover { color: #fff; }
.lg-nav-links a:hover::after { transform: scaleX(1); }
.lg-nav-links a.lg-nav-cta {
  color: #fff; border: 1px solid rgba(120, 190, 255, .4); border-radius: 999px; padding: 8px 16px;
  transition: background .25s ease, border-color .25s;
}
.lg-nav-links a.lg-nav-cta::after { display: none; }
.lg-nav-links a.lg-nav-cta:hover { background: rgba(56, 167, 255, .16); border-color: rgba(120, 190, 255, .8); }
.lg-lang { display: flex; align-items: center; min-width: 96px; }

.lg-hero {
  position: relative; min-height: var(--lg-vh); display: flex; align-items: center;
  padding: 140px clamp(20px, 5vw, 64px) 90px; overflow: hidden;
  background:
    radial-gradient(1200px 700px at 78% 6%, rgba(30, 123, 255, .28), transparent 60%),
    radial-gradient(900px 600px at 8% 82%, rgba(56, 167, 255, .16), transparent 60%),
    linear-gradient(180deg, #06111f 0%, #071426 48%, #0a1b2e 100%);
}
.lg-hero::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px);
  background-size: 72px 72px;
  -webkit-mask-image: radial-gradient(circle at 50% 30%, #000 0%, transparent 72%);
  mask-image: radial-gradient(circle at 50% 30%, #000 0%, transparent 72%);
}
.lg-orb { position: absolute; border-radius: 50%; filter: blur(10px); pointer-events: none; will-change: transform; }
.lg-orb-a { width: 420px; height: 420px; right: -120px; top: -80px; background: radial-gradient(circle at 40% 40%, rgba(56,167,255,.34), transparent 66%); }
.lg-orb-b { width: 520px; height: 520px; left: -180px; bottom: -220px; background: radial-gradient(circle at 55% 45%, rgba(30,123,255,.22), transparent 66%); }
.lg-orb-c { width: 180px; height: 180px; right: 22%; bottom: 16%; background: radial-gradient(circle at 50% 50%, rgba(232,201,138,.16), transparent 66%); }

.lg-hero-inner {
  position: relative; z-index: 2; width: 100%; max-width: var(--lg-max); margin: 0 auto;
  display: grid; grid-template-columns: 1.25fr .75fr; gap: clamp(28px, 5vw, 70px); align-items: center;
}
.lg-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 12px; letter-spacing: .28em; color: var(--lg-blue-2); text-transform: uppercase;
  margin-bottom: 22px;
}
.lg-eyebrow::before { content: ''; width: 30px; height: 1px; background: linear-gradient(90deg, var(--lg-blue-2), transparent); }
.lg-hero h1 { font-size: clamp(38px, 5.4vw, 74px); line-height: 1.12; letter-spacing: -.02em; font-weight: 700; }
.lg-grad {
  background: linear-gradient(112deg, #fff 8%, #bfe3ff 46%, #6fc0ff 82%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.lg-slogan { margin-top: 26px; font-size: clamp(13px, 1.4vw, 16px); color: var(--lg-gold); letter-spacing: .1em; }
.lg-slogan-en { margin-top: 8px; font-size: 11px; letter-spacing: .28em; color: rgba(201, 239, 255, .45); }
.lg-lead { margin-top: 20px; max-width: 620px; color: var(--lg-muted); font-size: 15px; line-height: 1.95; }
.lg-lead + .lg-lead { margin-top: 8px; }
.lg-hero-commit { margin-top: 30px; font-size: 14px; color: rgba(240, 247, 255, .82); letter-spacing: .04em; }
.lg-hero-chips { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
.lg-chip {
  display: flex; align-items: center; gap: 9px; padding: 11px 16px; border-radius: 12px;
  border: 1px solid var(--lg-line); background: rgba(255, 255, 255, .045);
  font-size: 13px; color: rgba(240, 247, 255, .9); backdrop-filter: blur(6px);
  transition: transform .3s ease, border-color .3s ease, background .3s ease;
}
.lg-chip:hover { transform: translateY(-3px); border-color: rgba(56, 167, 255, .5); background: rgba(56, 167, 255, .1); }
.lg-chip i { width: 6px; height: 6px; border-radius: 50%; background: var(--lg-blue-2); box-shadow: 0 0 12px var(--lg-blue-2); flex: none; }

.lg-hero-mark { position: relative; display: grid; place-items: center; min-height: 320px; }
.lg-halo {
  position: absolute; width: min(400px, 84%); aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle, rgba(56,167,255,.28), transparent 62%);
  animation: lg-breathe 7s ease-in-out infinite;
}
.lg-ring {
  position: absolute; width: min(340px, 78%); aspect-ratio: 1; border-radius: 50%;
  border: 1px dashed rgba(140, 205, 255, .26); animation: lg-spin 26s linear infinite;
}
.lg-ring::after {
  content: ''; position: absolute; top: -3px; left: 50%; width: 6px; height: 6px; border-radius: 50%;
  background: var(--lg-gold); box-shadow: 0 0 12px rgba(232, 201, 138, .9);
}
.lg-face-wrap { position: relative; width: min(250px, 62%); filter: drop-shadow(0 30px 60px rgba(19, 104, 220, .38)); }
.lg-face-wrap svg { width: 100%; height: auto; display: block; }
.lg-eye { transform-box: fill-box; transform-origin: center; animation: lg-blink 5.2s infinite; }
.lg-eye-b { animation-delay: .06s; }
@keyframes lg-blink {
  0%, 92%, 100% { transform: scaleY(1); }
  94% { transform: scaleY(.12); }
  96% { transform: scaleY(1); }
}
@keyframes lg-breathe { 0%, 100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.07); opacity: 1; } }
@keyframes lg-spin { to { transform: rotate(360deg); } }
@keyframes lg-drop {
  0% { transform: scaleY(.2); transform-origin: top; opacity: .2; }
  50% { transform: scaleY(1); opacity: 1; }
  100% { transform: scaleY(.2); transform-origin: bottom; opacity: 0; }
}
.lg-scroll-hint {
  position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 2;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: .24em; color: rgba(255, 255, 255, .45);
}
.lg-scroll-hint span {
  width: 1px; height: 42px; background: linear-gradient(180deg, rgba(140, 205, 255, .8), transparent);
  animation: lg-drop 2.2s ease-in-out infinite;
}

.lg-wrap { max-width: var(--lg-max); margin: 0 auto; padding: 0 clamp(20px, 5vw, 64px); }
.lg-band { position: relative; padding: clamp(80px, 11vw, 150px) 0; }
.lg-band-dark { background: linear-gradient(180deg, #081726, #0a1c2f); }
.lg-band-deep { background: #06111f; }
.lg-kicker { font-size: 12px; letter-spacing: .3em; color: var(--lg-blue-2); text-transform: uppercase; }
.lg-h2 { margin: 14px 0 0; font-size: clamp(28px, 3.8vw, 52px); line-height: 1.2; letter-spacing: -.01em; font-weight: 700; }
.lg-h2 em { font-style: normal; color: var(--lg-gold); }
.lg-sub { margin: 16px 0 0; color: var(--lg-muted); font-size: 15px; line-height: 1.9; max-width: 720px; }
.lg-sub-label { margin: 22px 0 12px; font-size: 12px; letter-spacing: .18em; color: rgba(255, 255, 255, .5); }
.lg-reveal { opacity: 0; transform: translateY(28px); transition: opacity .8s cubic-bezier(.2,.7,.2,1), transform .8s cubic-bezier(.2,.7,.2,1); }
.lg-reveal.lg-in { opacity: 1; transform: none; }
.lg-d1 { transition-delay: .1s; }
.lg-d2 { transition-delay: .2s; }
.lg-d3 { transition-delay: .3s; }

.lg-chapter { position: relative; min-height: calc(var(--lg-vh) * 1.9); }
.lg-chapter-sticky {
  position: sticky; top: 0; min-height: var(--lg-vh);
  display: flex; align-items: center; overflow: hidden;
}
.lg-chapter-bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
.lg-bg-south { background: radial-gradient(900px 600px at 85% 25%, rgba(30, 123, 255, .18), transparent 62%), #081827; }
.lg-bg-north { background: radial-gradient(900px 600px at 12% 30%, rgba(232, 201, 138, .10), transparent 60%), #06111f; }
.lg-watermark {
  position: absolute; font-size: clamp(200px, 30vw, 460px); font-weight: 800; line-height: 1;
  color: transparent; -webkit-text-stroke: 1px rgba(140, 205, 255, .12);
  right: -2vw; top: 8vh; pointer-events: none; will-change: transform;
}
.lg-chapter-inner { position: relative; z-index: 1; width: 100%; max-width: var(--lg-max); margin: 0 auto; padding: 0 clamp(20px, 5vw, 64px); }
.lg-chapter-head { display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap; }
.lg-index { font-size: clamp(16px, 1.6vw, 20px); color: var(--lg-blue-2); letter-spacing: .18em; }
.lg-mission-tag {
  display: inline-block; margin-top: 18px; padding: 8px 14px; border-radius: 8px;
  background: rgba(232, 201, 138, .1); border-left: 3px solid var(--lg-gold);
  color: var(--lg-gold); font-size: 13px; letter-spacing: .04em;
}
.lg-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 38px; }
.lg-card {
  position: relative; height: 100%; padding: 26px 24px 28px; border-radius: 18px; overflow: hidden;
  background: linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.025));
  border: 1px solid var(--lg-line);
  transition: transform .45s cubic-bezier(.2,.7,.2,1), border-color .35s, box-shadow .45s;
  will-change: transform;
}
.lg-card::before {
  content: ''; position: absolute; inset: 0 0 auto; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(140,205,255,.55), transparent);
  opacity: 0; transition: opacity .35s;
}
.lg-card:hover { transform: translateY(-8px); border-color: rgba(56, 167, 255, .42); box-shadow: 0 26px 60px rgba(2, 12, 28, .5); }
.lg-card:hover::before { opacity: 1; }
.lg-no { font-size: 11px; letter-spacing: .22em; color: rgba(255, 255, 255, .38); }
.lg-card h3 { margin: 14px 0 10px; font-size: 18px; letter-spacing: .01em; font-weight: 600; }
.lg-card p { font-size: 13.5px; line-height: 1.85; color: var(--lg-muted); }

.lg-mission {
  position: relative; overflow: hidden; text-align: center;
  padding: clamp(90px, 12vw, 160px) clamp(20px, 5vw, 64px);
  background: linear-gradient(130deg, #0a2050 0%, #0d3a86 46%, #1266c8 100%);
}
.lg-mission-glow {
  position: absolute; inset: -20%; pointer-events: none; will-change: transform;
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, .18), transparent 42%),
    radial-gradient(circle at 76% 84%, rgba(59, 170, 255, .35), transparent 46%);
}
.lg-mission blockquote {
  position: relative; z-index: 1; margin: 0 auto; max-width: 900px;
  font-size: clamp(26px, 4vw, 54px); line-height: 1.32; font-weight: 700; letter-spacing: -.01em;
}
.lg-rule { position: relative; z-index: 1; width: 74px; height: 2px; margin: 30px auto; background: rgba(255, 255, 255, .5); }
.lg-mission-text {
  position: relative; z-index: 1; margin: 0 auto; max-width: 660px;
  color: rgba(255, 255, 255, .86); font-size: 15px; line-height: 1.95;
}
.lg-promise-label { position: relative; z-index: 1; margin-top: 22px; font-size: 15px; font-weight: 600; letter-spacing: .06em; }
.lg-promise {
  position: relative; z-index: 1; display: inline-block; margin-top: 34px; padding: 14px 26px;
  border-radius: 999px; border: 1px solid rgba(255, 255, 255, .3); background: rgba(255, 255, 255, .08);
  font-size: 14px; letter-spacing: .06em;
}

.lg-timeline { position: relative; margin-top: 54px; padding-left: 30px; border-left: 1px solid rgba(140, 205, 255, .25); }
.lg-dot {
  position: absolute; left: -6px; top: 8px; width: 11px; height: 11px; border-radius: 50%;
  background: var(--lg-blue-2); box-shadow: 0 0 0 6px rgba(56, 167, 255, .14), 0 0 20px rgba(56, 167, 255, .7);
}
.lg-year { font-size: 13px; letter-spacing: .2em; color: var(--lg-gold); }
.lg-timeline h3 { margin: 12px 0 14px; font-size: clamp(22px, 2.4vw, 30px); font-weight: 600; }
.lg-timeline p { margin: 0 0 12px; color: var(--lg-muted); font-size: 14.5px; line-height: 1.95; max-width: 780px; }
.lg-quote-line {
  margin-top: 18px; padding: 16px 20px; border-radius: 12px; font-size: 14.5px; line-height: 1.8;
  background: rgba(56, 167, 255, .1); border-left: 3px solid var(--lg-blue-2); color: #dbeeff;
}

.lg-founder-grid { display: grid; grid-template-columns: .9fr 1.4fr; gap: clamp(24px, 4vw, 56px); margin-top: 46px; }
.lg-portrait {
  position: relative; border-radius: 22px; overflow: hidden; min-height: 380px;
  background: linear-gradient(150deg, rgba(56, 167, 255, .2), rgba(7, 20, 38, .6) 62%);
  border: 1px solid var(--lg-line); display: grid; place-items: center;
}
.lg-mono {
  font-size: 96px; font-weight: 700; letter-spacing: .04em;
  background: linear-gradient(120deg, #fff, #7fc7ff); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.lg-portrait-name { position: absolute; left: 0; right: 0; bottom: 22px; text-align: center; font-size: 13px; letter-spacing: .2em; color: rgba(255, 255, 255, .6); }
.lg-founder-copy h3 { font-size: clamp(22px, 2.6vw, 32px); font-weight: 700; }
.lg-role { margin-top: 8px; color: var(--lg-gold); font-size: 13px; letter-spacing: .1em; }
.lg-posts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.lg-post {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px;
  border: 1px solid var(--lg-line); background: rgba(255, 255, 255, .04);
  font-size: 13px; color: rgba(240, 247, 255, .9);
  transition: background .25s, border-color .25s, transform .25s;
}
.lg-post:hover { background: rgba(56, 167, 255, .1); border-color: rgba(56, 167, 255, .4); transform: translateX(3px); }
.lg-post i { width: 5px; height: 5px; border-radius: 50%; background: var(--lg-gold); flex: none; }
.lg-founder-copy p { margin: 12px 0 0; color: var(--lg-muted); font-size: 14px; line-height: 1.95; }

.lg-eco-label { margin: 34px 0 16px; font-size: 12px; letter-spacing: .22em; color: rgba(255, 255, 255, .45); }
.lg-eco-label-first { margin-top: 40px; }
.lg-eco-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.lg-eco {
  padding: 22px 18px; border-radius: 16px; text-align: center;
  border: 1px solid var(--lg-line); background: rgba(255, 255, 255, .045);
  transition: transform .35s ease, border-color .3s, background .3s;
}
.lg-eco:hover { transform: translateY(-6px); border-color: rgba(232, 201, 138, .4); background: rgba(232, 201, 138, .06); }
.lg-mark {
  width: 46px; height: 46px; margin: 0 auto 12px; border-radius: 12px;
  display: grid; place-items: center; font-size: 15px; font-weight: 700; color: #dff1ff;
  background: linear-gradient(150deg, rgba(56, 167, 255, .28), rgba(56, 167, 255, .06));
  border: 1px solid rgba(140, 205, 255, .3);
}
.lg-eco b { display: block; font-size: 13.5px; font-weight: 600; }
.lg-eco small { display: block; margin-top: 6px; font-size: 12px; color: var(--lg-muted); line-height: 1.6; }

.lg-contact {
  position: relative; overflow: hidden; text-align: center;
  padding: clamp(90px, 11vw, 150px) 0 60px;
  background: radial-gradient(800px 500px at 50% 0%, rgba(30, 123, 255, .22), transparent 64%), #050e1a;
}
.lg-contact h2 { font-size: clamp(28px, 4vw, 54px); font-weight: 700; line-height: 1.2; }
.lg-addr { margin-top: 22px; color: rgba(255, 255, 255, .82); font-size: 15px; line-height: 1.9; }
.lg-addr-en { margin-top: 4px; color: rgba(255, 255, 255, .45); font-size: 12.5px; letter-spacing: .06em; }
.lg-cta {
  display: inline-flex; align-items: center; gap: 10px; margin-top: 36px;
  padding: 15px 34px; border-radius: 999px; font-size: 15px; font-weight: 600; color: #041424;
  background: linear-gradient(112deg, #bfe3ff, #6fc0ff 60%, #38a7ff);
  box-shadow: 0 18px 44px rgba(30, 123, 255, .35);
  transition: transform .3s ease, box-shadow .3s ease;
}
.lg-cta:hover { transform: translateY(-3px); box-shadow: 0 24px 56px rgba(30, 123, 255, .48); }
.lg-footer {
  margin-top: 70px; padding-top: 26px; border-top: 1px solid rgba(255, 255, 255, .08);
  display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between;
  font-size: 12px; color: rgba(255, 255, 255, .4); text-align: left;
}

@media (max-width: 900px) {
  .lg-hero { padding-top: 110px; }
  .lg-hero-inner { grid-template-columns: 1fr; gap: 40px; }
  .lg-hero-mark { order: -1; min-height: 220px; }
  .lg-face-wrap { width: 150px; }
  .lg-halo { width: 240px; }
  .lg-ring { width: 200px; }
  .lg-cards { grid-template-columns: 1fr; }
  .lg-chapter { min-height: auto; }
  .lg-chapter-sticky { position: static; min-height: auto; padding: 80px 0; }
  .lg-watermark { font-size: 190px; opacity: .5; }
  .lg-founder-grid { grid-template-columns: 1fr; }
  .lg-portrait { min-height: 240px; }
  .lg-posts { grid-template-columns: 1fr; }
  .lg-eco-grid { grid-template-columns: repeat(2, 1fr); }
  .lg-nav-links a:not(.lg-nav-cta) { display: none; }
  .lg-lang { min-width: 0; }
}
@media (max-width: 520px) {
  .lg-eco-grid { grid-template-columns: 1fr; }
  .lg-footer { justify-content: center; text-align: center; }
}
@media (prefers-reduced-motion: reduce) {
  .lg-about { scroll-behavior: auto; }
  .lg-about * { animation: none !important; transition: none !important; }
  .lg-reveal { opacity: 1; transform: none; }
}
`;

const AboutPage = () => {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // 鲁港通 - 卡片入场：首屏直接显示，其余进入视口再淡入
    const revealEls = Array.from(root.querySelectorAll<HTMLElement>('.lg-reveal'));
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let observer: IntersectionObserver | null = null;

    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      revealEls.forEach((el) => el.classList.add('lg-in'));
    } else {
      const viewportHeight = root.clientHeight;
      const pending: HTMLElement[] = [];
      revealEls.forEach((el) => {
        if (shouldRevealImmediately(el.getBoundingClientRect().top, viewportHeight)) {
          el.classList.add('lg-in');
        } else {
          pending.push(el);
        }
      });
      if (pending.length > 0) {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add('lg-in');
              observer?.unobserve(entry.target);
            });
          },
          { root, threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
        );
        pending.forEach((el) => observer?.observe(el));
      }
    }

    // 鲁港通 - 滚动驱动：进度条、导航毛玻璃、元素视差，统一走 rAF 节流
    const nav = root.querySelector<HTMLElement>('.lg-nav');
    const progress = root.querySelector<HTMLElement>('.lg-progress');
    const parallaxEls = Array.from(root.querySelectorAll<HTMLElement>('[data-ps]'));
    let frame = 0;

    const render = () => {
      frame = 0;
      const { scrollTop, scrollHeight, clientHeight } = root;
      root.style.setProperty('--lg-sy', `${scrollTop}px`);
      nav?.classList.toggle('lg-scrolled', scrollTop > 24);
      if (progress) {
        progress.style.transform = `scaleX(${calcScrollProgress(scrollTop, scrollHeight, clientHeight)})`;
      }
      parallaxEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > clientHeight + 200) return;
        const offset = calcParallaxOffset(rect, clientHeight, Number(el.dataset.ps ?? 0));
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(render);
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    render();

    return () => {
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className="lg-about" ref={rootRef}>
      <style>{ABOUT_CSS}</style>

      <div className="lg-progress" />

      <header className="lg-nav">
        <NextLink href="/" className="lg-brand">
          <BrandFace idPrefix="lg-brand" />
          <span>
            鲁港通
            <small>LUGANG CONNECT</small>
          </span>
        </NextLink>
        <div className="lg-nav-right">
          <nav className="lg-nav-links">
            <a href="#south">{t('login:about_nav_south')}</a>
            <a href="#north">{t('login:about_nav_north')}</a>
            <a href="#founder">{t('login:about_nav_founder')}</a>
            <a href="#ecosystem">{t('login:about_nav_ecosystem')}</a>
            <a href="#contact" className="lg-nav-cta">
              {t('login:about_nav_cta')}
            </a>
          </nav>
          <div className="lg-lang">
            <I18nLngSelector />
          </div>
        </div>
      </header>

      <section className="lg-hero">
        <div className="lg-orb lg-orb-a" data-ps="-0.10" />
        <div className="lg-orb lg-orb-b" data-ps="0.07" />
        <div className="lg-orb lg-orb-c" data-ps="-0.05" />
        <div className="lg-hero-inner">
          <div>
            <div className="lg-eyebrow">{t('login:about_hero_eyebrow')}</div>
            <h1>
              <span className="lg-grad">{t('login:about_hero_title1')}</span>
              <br />
              {t('login:about_hero_title2')}
            </h1>
            <div className="lg-slogan">{t('login:about_hero_slogan')}</div>
            <div className="lg-slogan-en">RUGANG CONNECT · CROSS-BORDER AI PLATFORM</div>
            <p className="lg-lead">{t('login:about_hero_p1')}</p>
            <p className="lg-lead">{t('login:about_hero_p2')}</p>
            <div className="lg-hero-commit">{t('login:about_hero_commit')}</div>
            <div className="lg-hero-chips">
              {HERO_CHIPS.map((key) => (
                <div className="lg-chip" key={key}>
                  <i />
                  {t(key)}
                </div>
              ))}
            </div>
          </div>
          <div className="lg-hero-mark">
            <div className="lg-halo" />
            <div className="lg-ring" />
            <div className="lg-face-wrap">
              <BrandFace idPrefix="lg-hero" />
            </div>
          </div>
        </div>
        <div className="lg-scroll-hint">
          <span />
          SCROLL
        </div>
      </section>

      {CHAPTERS.map((chapter) => (
        <section key={chapter.id} id={chapter.id} className="lg-chapter lg-anchor">
          <div className="lg-chapter-sticky">
            <div className={`lg-chapter-bg ${chapter.bgClass}`}>
              <div className="lg-watermark" data-ps={chapter.parallax}>
                {chapter.watermark}
              </div>
            </div>
            <div className="lg-chapter-inner">
              <div className="lg-chapter-head">
                <span className="lg-index">{chapter.index}</span>
                <h2 className="lg-h2">
                  {t(chapter.titleLead)}
                  <em>{t(chapter.titleAccent)}</em>
                </h2>
              </div>
              <div className="lg-mission-tag">{t(chapter.mission)}</div>
              <div className="lg-cards">
                {chapter.cards.map((card, i) => (
                  <div className={`lg-reveal lg-d${i + 1}`} key={card.no}>
                    <article className="lg-card">
                      <div className="lg-no">{card.no}</div>
                      <h3>{t(card.title)}</h3>
                      <p>{t(card.text)}</p>
                    </article>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      <section className="lg-mission">
        <div className="lg-mission-glow" data-ps="0.05" />
        <blockquote>
          {t('login:about_mission_title1')}
          <br />
          {t('login:about_mission_title2')}
        </blockquote>
        <div className="lg-rule" />
        <p className="lg-mission-text">{t('login:about_mission_p1')}</p>
        <h3 className="lg-promise-label">{t('login:about_mission_promise_label')}</h3>
        <p className="lg-mission-text">{t('login:about_mission_p2')}</p>
        <div className="lg-promise">🎉 {t('login:about_mission_card')}</div>
      </section>

      <section className="lg-band lg-band-dark">
        <div className="lg-wrap">
          <div className="lg-kicker">MILESTONE</div>
          <h2 className="lg-h2 lg-reveal">
            {t('login:about_history_title_lead')}
            <em>{t('login:about_history_title_accent')}</em>
          </h2>
          <div className="lg-timeline lg-reveal lg-d1">
            <div className="lg-dot" />
            <div className="lg-year">{t('login:about_history_year_label')}</div>
            <h3>{t('login:about_history_h3')}</h3>
            <p>{t('login:about_history_p2')}</p>
            <div className="lg-quote-line">{t('login:about_history_highlight')}</div>
          </div>
        </div>
      </section>

      <section id="founder" className="lg-band lg-band-deep lg-anchor">
        <div className="lg-wrap">
          <div className="lg-kicker">FOUNDER</div>
          <h2 className="lg-h2 lg-reveal">
            {t('login:about_founder_title_lead')}
            <em>{t('login:about_founder_title_accent')}</em>
          </h2>
          <div className="lg-founder-grid">
            <div className="lg-portrait lg-reveal">
              <div className="lg-mono">JH</div>
              <div className="lg-portrait-name">MR. JIN HUI</div>
            </div>
            <div className="lg-founder-copy lg-reveal lg-d1">
              <h3>{t('login:about_founder_name')}</h3>
              <div className="lg-role">{t('login:about_founder_role')}</div>
              <div className="lg-sub-label">{t('login:about_founder_posts_title')}</div>
              <div className="lg-posts">
                {FOUNDER_POSTS.map((key) => (
                  <div className="lg-post" key={key}>
                    <i />
                    {t(key)}
                  </div>
                ))}
              </div>
              <div className="lg-sub-label">{t('login:about_founder_advantage_title')}</div>
              <p>{t('login:about_founder_advantage_p1')}</p>
              <p>{t('login:about_founder_advantage_p2')}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="ecosystem" className="lg-band lg-band-dark lg-anchor">
        <div className="lg-wrap">
          <div className="lg-kicker">ECOSYSTEM</div>
          <h2 className="lg-h2 lg-reveal">
            {t('login:about_eco_title_lead')}
            <em>{t('login:about_eco_title_accent')}</em>
          </h2>
          <p className="lg-sub lg-reveal lg-d1">{t('login:about_partners_p')}</p>
          <div className="lg-eco-label lg-eco-label-first">{t('login:about_eco_community_label')}</div>
          <div className="lg-eco-grid lg-reveal">
            {COMMUNITIES.map((item) => (
              <div className="lg-eco" key={item.name}>
                <div className="lg-mark">{item.mark}</div>
                <b>{t(item.name)}</b>
              </div>
            ))}
          </div>
          <div className="lg-eco-label">{t('login:about_eco_gov_label')}</div>
          <div className="lg-eco-grid lg-reveal">
            {GOV_PARTNERS.map((item) => (
              <div className="lg-eco" key={item.name}>
                <div className="lg-mark">{item.mark}</div>
                <b>{t(item.name)}</b>
                <small>{t(item.desc)}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="lg-contact lg-anchor">
        <div className="lg-wrap">
          <div className="lg-kicker">CONTACT</div>
          <h2>
            {t('login:about_contact_cta_title1')}
            <br />
            {t('login:about_contact_cta_title2')}
          </h2>
          <div className="lg-addr">
            {t('login:about_contact_addr_label')}
            {t('login:about_contact_addr_cn')}
          </div>
          <div className="lg-addr-en">6/F, Gamsun Commercial Centre, 333 Nathan Road, Kowloon, Hong Kong</div>
          <NextLink href="/login" className="lg-cta">
            {t('login:about_contact_cta_btn')}
          </NextLink>
          <footer className="lg-footer">
            <span>{t('login:about_footer_support')}</span>
            <span>{t('login:hero_footer_copyright')}</span>
          </footer>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
