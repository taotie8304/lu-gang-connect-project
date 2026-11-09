// 鲁港通 - 关于页 v3 样式（纸本 +《鹊华秋色图》，与 about-v3-preview 一致）
export const ABOUT_V3_CSS = `
.lg-a3 {
  --paper: #f3f0e7;
  --paper-2: #eae5d8;
  --ink: #1e1d1a;
  --ink-2: #3b3933;
  --muted: #6f6a5e;
  --blue: #1e7bff;
  --blue-2: #38a7ff;
  --jade: #3f9c8c;
  --gold: #b09355;
  --line: rgba(30, 29, 26, 0.13);
  --serif: 'Songti SC', 'Noto Serif SC', 'Source Han Serif SC', 'PingFang SC', Georgia, serif;
  --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  position: relative;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
  scroll-behavior: smooth;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.lg-a3 * { box-sizing: border-box; }
.lg-a3 ::selection { background: rgba(30, 123, 255, 0.22); }
.lg-a3 a { color: inherit; text-decoration: none; }
.lg-a3 h1, .lg-a3 h2, .lg-a3 h3, .lg-a3 h4, .lg-a3 p, .lg-a3 ul, .lg-a3 blockquote { margin: 0; padding: 0; }
.lg-a3 ul { list-style: none; }
.lg-a3 section[id] { scroll-margin-top: 72px; }
.lg-a3::-webkit-scrollbar { width: 9px; }
.lg-a3::-webkit-scrollbar-track { background: var(--paper-2); }
.lg-a3::-webkit-scrollbar-thumb { background: rgba(30, 29, 26, 0.22); border-radius: 9px; }

.lg-a3 .progress {
  position: fixed; left: 0; right: 0; top: var(--lugang-titlebar-height, 0px);
  height: 2px; z-index: 80; pointer-events: none;
  background: linear-gradient(90deg, var(--blue), var(--jade), var(--gold));
  transform: scaleX(0); transform-origin: 0 50%;
}
.lg-a3 .nav {
  position: absolute; left: 0; right: 0; top: 0; z-index: 70;
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px clamp(20px, 4.5vw, 60px);
  border-bottom: 1px solid transparent;
  transition: background .4s ease, padding .4s ease, border-color .4s ease, backdrop-filter .4s;
}
.lg-a3 .nav.is-scrolled {
  position: fixed;
  top: var(--lugang-titlebar-height, 0px);
  padding-top: 11px; padding-bottom: 11px;
  background: rgba(243, 240, 231, 0.82);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  border-bottom-color: var(--line);
}
.lg-a3 .brand { display: flex; align-items: center; gap: 11px; }
.lg-a3 .brand svg { width: 32px; height: 32px; border-radius: 9px; box-shadow: 0 8px 22px rgba(30, 123, 255, .28); flex: none; }
.lg-a3 .brand b { font-family: var(--sans); font-size: 18px; letter-spacing: .16em; font-weight: 600; }
.lg-a3 .brand small { display: block; font-family: var(--sans); font-size: 9px; letter-spacing: .26em; color: var(--muted); margin-top: 1px; }
.lg-a3 .nav-right { display: flex; align-items: center; gap: clamp(14px, 2vw, 26px); }
.lg-a3 .links { display: flex; align-items: center; gap: clamp(16px, 2.4vw, 32px); font-size: 13px; color: var(--ink-2); }
.lg-a3 .links a { position: relative; padding: 4px 0; }
.lg-a3 .links a::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: -3px; height: 1px;
  background: var(--ink); transform: scaleX(0); transform-origin: 0 50%; transition: transform .28s ease;
}
.lg-a3 .links a:hover::after { transform: scaleX(1); }
.lg-a3 .links .cta {
  padding: 9px 18px; border-radius: 999px; background: var(--ink); color: var(--paper);
  font-size: 12.5px; letter-spacing: .04em; transition: transform .25s, background .25s;
}
.lg-a3 .links .cta::after { display: none; }
.lg-a3 .links .cta:hover { background: #000; transform: translateY(-1px); }
.lg-a3 .lang { display: flex; align-items: center; min-width: 96px; }

.lg-a3 .hero { position: relative; min-height: 100%; display: flex; align-items: flex-end; overflow: hidden; }
.lg-a3 .hero-art {
  position: absolute; left: 0; right: 0; top: -8%; height: 118%;
  background-image: url('/imgs/about-quehua.jpg');
  background-size: cover; background-position: 52% 46%;
  will-change: transform;
}
.lg-a3 .hero-shade {
  position: absolute; inset: 0;
  background:
    linear-gradient(90deg, rgba(243,240,231,.97) 0%, rgba(243,240,231,.93) 26%, rgba(243,240,231,.62) 46%, rgba(243,240,231,.08) 72%, rgba(243,240,231,.02) 100%),
    linear-gradient(180deg, rgba(243,240,231,.55) 0%, transparent 24%, transparent 62%, rgba(243,240,231,.92) 100%);
}
.lg-a3 .hero-noise {
  position: absolute; inset: 0; pointer-events: none; opacity: .35; mix-blend-mode: multiply;
  background-image: radial-gradient(rgba(30,29,26,.10) .6px, transparent .6px);
  background-size: 3px 3px;
}
.lg-a3 .hero-inner {
  position: relative; z-index: 2; width: 100%; max-width: 1180px; margin: 0 auto;
  padding: 150px clamp(22px, 5vw, 64px) 110px;
  will-change: transform, opacity;
}
.lg-a3 .eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: var(--blue);
  margin-bottom: 26px;
}
.lg-a3 .eyebrow::before { content: ''; width: 34px; height: 1px; background: var(--blue); }
.lg-a3 .hero h1 {
  font-family: var(--serif); font-weight: 600; letter-spacing: .01em;
  font-size: clamp(42px, 6.2vw, 86px); line-height: 1.14;
}
.lg-a3 .hero h1 em { font-style: normal; position: relative; color: var(--ink); }
.lg-a3 .hero h1 em::after {
  content: ''; position: absolute; left: 2px; right: -4px; bottom: .06em; height: .16em;
  background: linear-gradient(90deg, rgba(30,123,255,.28), rgba(63,156,140,.22));
  border-radius: 3px; z-index: -1;
}
.lg-a3 .hero .lede {
  margin-top: 28px; max-width: 560px; font-size: 16px; line-height: 2; color: var(--ink-2);
}
.lg-a3 .hero .lede strong { font-weight: 600; color: var(--ink); }
.lg-a3 .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
.lg-a3 .btn {
  display: inline-flex; align-items: center; gap: 9px; padding: 13px 26px; border-radius: 999px;
  font-size: 14px; letter-spacing: .03em; transition: transform .3s, box-shadow .3s, background .3s;
}
.lg-a3 .btn.dark { background: var(--ink); color: var(--paper); box-shadow: 0 14px 34px rgba(30,29,26,.18); }
.lg-a3 .btn.dark:hover { transform: translateY(-2px); box-shadow: 0 20px 44px rgba(30,29,26,.24); }
.lg-a3 .btn.ghost { border: 1px solid rgba(30,29,26,.28); color: var(--ink); background: rgba(243,240,231,.4); }
.lg-a3 .btn.ghost:hover { background: rgba(255,255,255,.6); transform: translateY(-2px); }
.lg-a3 .hero-meta {
  display: flex; flex-wrap: wrap; gap: 10px 26px; margin-top: 40px;
  font-size: 11.5px; letter-spacing: .06em; color: var(--muted);
}
.lg-a3 .hero-meta span { display: inline-flex; align-items: center; gap: 7px; }
.lg-a3 .hero-meta i { width: 5px; height: 5px; border-radius: 50%; background: var(--jade); box-shadow: 0 0 0 3px rgba(63,156,140,.14); }
.lg-a3 .painting-note {
  position: absolute; right: clamp(18px, 4vw, 54px); bottom: 26px; z-index: 2;
  font-family: var(--serif); font-size: 11px; letter-spacing: .14em; color: rgba(30,29,26,.42);
  writing-mode: vertical-rl;
}
.lg-a3 .scroll-cue {
  position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  font-size: 10px; letter-spacing: .24em; color: rgba(30,29,26,.46);
}
.lg-a3 .scroll-cue span {
  width: 1px; height: 38px; background: linear-gradient(180deg, rgba(30,29,26,.5), transparent);
  animation: a3-drop 2.2s ease-in-out infinite;
}
@keyframes a3-drop {
  0% { transform: scaleY(.2); transform-origin: top; opacity: .2; }
  50% { transform: scaleY(1); opacity: 1; }
  100% { transform: scaleY(.2); transform-origin: bottom; opacity: 0; }
}

.lg-a3 .wrap { width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 clamp(22px, 5vw, 64px); }
.lg-a3 .section-no {
  font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--blue);
  padding-bottom: 18px; border-bottom: 1px solid var(--line); margin-bottom: 52px;
}
.lg-a3 .section-no.light { color: #8fc6ff; border-color: rgba(255,255,255,.18); }
.lg-a3 .reveal { opacity: 0; transform: translateY(30px); transition: opacity .9s cubic-bezier(.2,.7,.2,1), transform .9s cubic-bezier(.2,.7,.2,1); }
.lg-a3 .reveal.in { opacity: 1; transform: none; }
.lg-a3 .d1 { transition-delay: .1s; }
.lg-a3 .d2 { transition-delay: .2s; }
.lg-a3 .d3 { transition-delay: .3s; }

.lg-a3 .manifesto { padding: clamp(90px, 12vw, 160px) 0 clamp(70px, 9vw, 120px); background: var(--paper); }
.lg-a3 .statement {
  font-family: var(--serif); font-weight: 600; letter-spacing: .01em;
  font-size: clamp(30px, 4.6vw, 62px); line-height: 1.32; max-width: 980px;
}
.lg-a3 .statement .dim { color: rgba(30,29,26,.34); }
.lg-a3 .statement-sub { margin-top: 34px; max-width: 640px; font-size: 15px; line-height: 2; color: var(--muted); }
.lg-a3 .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin-top: 64px; }
.lg-a3 .stat { border-top: 1px solid var(--line); padding-top: 22px; }
.lg-a3 .stat b { display: flex; align-items: baseline; flex-wrap: wrap; font-family: var(--serif); font-size: clamp(32px, 3.6vw, 48px); font-weight: 600; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
.lg-a3 .stat b > span { display: inline; margin-top: 0; font-size: inherit; font-family: inherit; color: inherit; letter-spacing: inherit; }
.lg-a3 .stat b small { align-self: baseline; font-size: 14px; font-family: var(--sans); color: var(--muted); margin-left: 6px; letter-spacing: .06em; }
.lg-a3 .stat > span { display: block; margin-top: 8px; font-size: 12.5px; line-height: 1.65; color: var(--muted); letter-spacing: .04em; }

.lg-a3 .capabilities { padding: clamp(80px, 10vw, 140px) 0; background: var(--paper-2); }
.lg-a3 .capabilities h2, .lg-a3 .twocities h2 {
  font-family: var(--serif); font-weight: 600; font-size: clamp(32px, 4.2vw, 58px); line-height: 1.22;
}
.lg-a3 .cap-list { margin-top: 46px; border-top: 1px solid rgba(30,29,26,.16); }
.lg-a3 .cap {
  display: grid; grid-template-columns: 1fr 1fr; gap: clamp(24px, 5vw, 72px); align-items: center;
  padding: clamp(30px, 4.4vw, 56px) 0; border-bottom: 1px solid rgba(30,29,26,.16);
}
.lg-a3 .cap-main { display: grid; grid-template-columns: 64px 1fr; gap: 0 18px; align-items: start; }
.lg-a3 .cap-no {
  font-family: var(--serif); font-size: 15px; color: var(--blue); letter-spacing: .1em; padding-top: 7px;
}
.lg-a3 .cap h3 { font-family: var(--serif); font-size: clamp(23px, 2.6vw, 34px); font-weight: 600; letter-spacing: .01em; }
.lg-a3 .cap p { margin-top: 14px; font-size: 14.5px; line-height: 1.95; color: var(--muted); max-width: 460px; }
.lg-a3 .cap ul { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; grid-column: 2; }
.lg-a3 .cap li {
  font-size: 11.5px; letter-spacing: .04em; color: var(--ink-2);
  padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(30,29,26,.18);
  background: rgba(255,255,255,.34);
}
.lg-a3 .cap-visual { position: relative; height: 260px; border-radius: 18px; overflow: hidden; }
.lg-a3 .cap:hover .cap-visual { box-shadow: 0 26px 60px rgba(30,29,26,.12); transition: box-shadow .4s; }

.lg-a3 .v-policy { background: linear-gradient(140deg, #e8e2d3, #d9d2c1); padding: 26px; }
.lg-a3 .doc {
  position: absolute; left: 34px; right: 34px; top: 34px; bottom: 34px;
  background: #fbfaf6; border: 1px solid rgba(30,29,26,.12); border-radius: 12px;
  padding: 22px 22px 18px; box-shadow: 0 18px 40px rgba(30,29,26,.10);
}
.lg-a3 .doc.back-2 { transform: rotate(-4deg) translate(-10px, 10px) scale(.94); opacity: .55; }
.lg-a3 .doc.back-1 { transform: rotate(2.4deg) translate(8px, 2px) scale(.97); opacity: .8; }
.lg-a3 .doc-head { display: flex; align-items: center; justify-content: space-between; font-size: 9px; letter-spacing: .12em; color: var(--muted); }
.lg-a3 .doc-tag { padding: 3px 7px; border-radius: 4px; background: rgba(30,123,255,.1); color: var(--blue); letter-spacing: .06em; }
.lg-a3 .doc h4 { font-family: var(--serif); font-size: 15px; margin-top: 16px; letter-spacing: .02em; }
.lg-a3 .doc-line { height: 6px; border-radius: 4px; background: rgba(30,29,26,.10); margin-top: 10px; }
.lg-a3 .doc-line.w80 { width: 80%; } .lg-a3 .doc-line.w62 { width: 62%; } .lg-a3 .doc-line.w90 { width: 90%; }
.lg-a3 .doc-line.hl { background: linear-gradient(90deg, rgba(30,123,255,.25), rgba(63,156,140,.18)); width: 72%; }
.lg-a3 .doc-cite {
  position: absolute; left: 18px; right: 18px; bottom: 16px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-radius: 8px; background: rgba(30,123,255,.07); border: 1px solid rgba(30,123,255,.18);
  font-size: 9.5px; color: #2a5fa8; letter-spacing: .02em;
}
.lg-a3 .doc-cite b { font-weight: 600; }
.lg-a3 .doc-cite span { color: var(--jade); }

.lg-a3 .v-browser { background: linear-gradient(140deg, #dce6ee, #c9d8e4); padding: 26px; }
.lg-a3 .browser {
  position: absolute; left: 30px; right: 30px; top: 30px; bottom: 30px;
  background: #fcfcfa; border-radius: 12px; border: 1px solid rgba(30,29,26,.14);
  box-shadow: 0 18px 44px rgba(30,29,26,.13); overflow: hidden;
}
.lg-a3 .browser-bar { display: flex; align-items: center; gap: 6px; padding: 9px 12px; background: #f0eee7; border-bottom: 1px solid rgba(30,29,26,.08); }
.lg-a3 .browser-bar i { width: 6px; height: 6px; border-radius: 50%; background: rgba(30,29,26,.22); }
.lg-a3 .browser-url { flex: 1; margin-left: 8px; height: 14px; border-radius: 4px; background: rgba(30,29,26,.08); }
.lg-a3 .browser-body { padding: 18px 20px; }
.lg-a3 .form-title { font-size: 10px; letter-spacing: .14em; color: var(--muted); }
.lg-a3 .field { margin-top: 12px; }
.lg-a3 .field label { display: block; font-size: 8.5px; color: var(--muted); letter-spacing: .08em; margin-bottom: 5px; }
.lg-a3 .field .input {
  height: 26px; border-radius: 6px; border: 1px solid rgba(30,29,26,.14); background: #fff;
  display: flex; align-items: center; padding: 0 9px; font-size: 9.5px; color: var(--ink-2);
  position: relative; overflow: hidden;
}
.lg-a3 .field .input::after {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 0;
  background: rgba(30,123,255,.12); animation: a3-fill 5s ease-in-out infinite;
}
.lg-a3 .field:nth-child(3) .input::after { animation-delay: .7s; }
.lg-a3 .field:nth-child(4) .input::after { animation-delay: 1.4s; }
@keyframes a3-fill { 0%, 12% { width: 0; } 36%, 82% { width: 100%; } 100% { width: 0; } }
.lg-a3 .browser-submit {
  margin-top: 14px; height: 27px; border-radius: 6px; background: var(--blue); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 9.5px; letter-spacing: .1em;
}
.lg-a3 .browser-cursor {
  position: absolute; right: 26%; bottom: 21%; width: 14px; height: 18px;
  background: var(--ink); clip-path: polygon(0 0, 100% 62%, 56% 68%, 42% 100%);
  animation: a3-cursor 5s ease-in-out infinite;
}
@keyframes a3-cursor {
  0%, 10% { transform: translate(30px, 20px); opacity: 0; }
  24% { opacity: 1; }
  42%, 72% { transform: translate(0, 0); opacity: 1; }
  88%, 100% { transform: translate(-20px, 26px); opacity: 0; }
}

.lg-a3 .v-route { background: linear-gradient(140deg, #e4e9df, #ccd9d1); }
.lg-a3 .route-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.lg-a3 .route-svg .rail { fill: none; stroke: rgba(30,29,26,.16); stroke-width: 1.4; stroke-dasharray: 4 5; }
.lg-a3 .route-svg .rail-live { fill: none; stroke: var(--blue); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 520; stroke-dashoffset: 520; animation: a3-route 6s ease-in-out infinite; }
@keyframes a3-route { 0% { stroke-dashoffset: 520; } 55%, 80% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -520; } }
.lg-a3 .route-svg .node { fill: #fbfaf6; stroke: rgba(30,29,26,.3); stroke-width: 1.2; }
.lg-a3 .route-svg .node.on { fill: var(--blue); stroke: var(--blue); }
.lg-a3 .route-svg text { font-size: 8px; letter-spacing: .1em; fill: #5e5a50; font-family: var(--sans); }
.lg-a3 .route-svg .pin { animation: a3-pin 6s ease-in-out infinite; }
@keyframes a3-pin { 0%, 6% { opacity: 0; transform: translate(0, 0); } 12% { opacity: 1; } 55% { opacity: 1; transform: translate(210px, -62px); } 70%, 100% { opacity: 0; transform: translate(210px, -62px); } }

.lg-a3 .twocities { padding: clamp(90px, 11vw, 150px) 0; background: var(--paper); position: relative; overflow: hidden; }
.lg-a3 .twocities .mountains {
  position: absolute; left: 0; right: 0; bottom: 0; height: 44%; opacity: .16; pointer-events: none;
}
.lg-a3 .twocities .mountains svg { width: 100%; height: 100%; }
.lg-a3 .twocities .sub { margin-top: 22px; max-width: 620px; font-size: 15px; line-height: 2; color: var(--muted); }
.lg-a3 .route { position: relative; margin-top: 64px; z-index: 1; }
.lg-a3 .route-line { position: relative; height: 2px; background: rgba(30,29,26,.16); border-radius: 2px; margin: 0 6px 26px; }
.lg-a3 .route-fill { position: absolute; left: 0; top: -1px; height: 4px; width: 0; border-radius: 4px; background: linear-gradient(90deg, var(--blue), var(--jade)); }
.lg-a3 .route-dot {
  position: absolute; top: 50%; left: 0; width: 13px; height: 13px; border-radius: 50%;
  background: #fff; border: 2px solid var(--blue); transform: translate(-50%, -50%);
  box-shadow: 0 0 0 6px rgba(30,123,255,.12);
}
.lg-a3 .route-labels { display: flex; justify-content: space-between; font-family: var(--serif); font-size: 13px; letter-spacing: .12em; color: var(--ink-2); }
.lg-a3 .route-labels span:last-child { text-align: right; }
.lg-a3 .route-labels small { display: block; font-family: var(--sans); font-size: 10px; letter-spacing: .2em; color: var(--muted); margin-top: 4px; }
.lg-a3 .route-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 46px; }
.lg-a3 .rcard {
  padding: 30px 30px 32px; border-radius: 18px; background: rgba(255,255,255,.52);
  border: 1px solid rgba(30,29,26,.12); transition: transform .4s, background .4s, box-shadow .4s;
}
.lg-a3 .rcard:hover { transform: translateY(-6px); background: rgba(255,255,255,.82); box-shadow: 0 24px 56px rgba(30,29,26,.10); }
.lg-a3 .rcard .dir { font-size: 10px; letter-spacing: .24em; color: var(--blue); }
.lg-a3 .rcard h3 { margin-top: 14px; font-family: var(--serif); font-size: 24px; font-weight: 600; }
.lg-a3 .rcard p { margin-top: 12px; font-size: 13.5px; line-height: 1.95; color: var(--muted); }
.lg-a3 .rcard .tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 18px; }
.lg-a3 .rcard .tags span { font-size: 10.5px; padding: 5px 10px; border-radius: 999px; background: rgba(30,29,26,.055); color: var(--ink-2); }

.lg-a3 .tech {
  position: relative; overflow: hidden; color: #f4f7fb; background: #071522;
  padding: clamp(90px, 11vw, 150px) 0;
}
.lg-a3 .tech::before {
  content: ''; position: absolute; inset: 0;
  background-image: linear-gradient(rgba(120,190,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(120,190,255,.055) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(circle at 50% 40%, #000, transparent 74%);
  -webkit-mask-image: radial-gradient(circle at 50% 40%, #000, transparent 74%);
}
.lg-a3 .tech::after {
  content: ''; position: absolute; width: 620px; height: 620px; right: -160px; top: -220px; border-radius: 50%;
  background: radial-gradient(circle, rgba(30,123,255,.30), transparent 66%); filter: blur(10px);
}
.lg-a3 .tech-inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1.05fr .95fr; gap: clamp(30px, 6vw, 80px); align-items: center; }
.lg-a3 .tech h2 { font-family: var(--serif); font-size: clamp(34px, 4.4vw, 60px); font-weight: 600; line-height: 1.24; }
.lg-a3 .tech p { margin-top: 24px; max-width: 500px; font-size: 14.5px; line-height: 2; color: rgba(233,241,250,.68); }
.lg-a3 .source-chips { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 30px; }
.lg-a3 .source-chips span {
  font-size: 11px; letter-spacing: .04em; padding: 7px 12px; border-radius: 999px;
  border: 1px solid rgba(140,205,255,.24); background: rgba(140,205,255,.06); color: rgba(233,241,250,.82);
}
.lg-a3 .mascot-card {
  position: relative; padding: 36px 30px 30px; border-radius: 24px;
  background: linear-gradient(160deg, rgba(255,255,255,.09), rgba(255,255,255,.03));
  border: 1px solid rgba(140,205,255,.18);
  backdrop-filter: blur(8px);
}
.lg-a3 .mascot-stage { position: relative; display: grid; place-items: center; height: 210px; }
.lg-a3 .mascot-halo {
  position: absolute; width: 190px; height: 190px; border-radius: 50%;
  background: radial-gradient(circle, rgba(56,167,255,.28), transparent 66%);
  animation: a3-breathe 6s ease-in-out infinite;
}
@keyframes a3-breathe { 0%, 100% { transform: scale(1); opacity: .8; } 50% { transform: scale(1.08); opacity: 1; } }
.lg-a3 .mascot { position: relative; width: 132px; height: 132px; animation: a3-tilt 7s ease-in-out infinite; transform-origin: 50% 88%; }
.lg-a3 .mascot svg { width: 100%; height: 100%; border-radius: 28px; box-shadow: 0 30px 60px rgba(10,90,190,.42); }
@keyframes a3-tilt {
  0%, 18%, 100% { transform: rotate(0deg); }
  24% { transform: rotate(-6deg); }
  31% { transform: rotate(-6deg); }
  38% { transform: rotate(5deg); }
  46% { transform: rotate(5deg); }
  54% { transform: rotate(0deg); }
}
.lg-a3 .qmark {
  position: absolute; font-family: var(--serif); color: #bfe3ff; opacity: 0;
  animation: a3-q 7s ease-in-out infinite; text-shadow: 0 0 18px rgba(120,200,255,.7);
}
.lg-a3 .qmark.q1 { left: 18%; top: 6%; font-size: 22px; animation-delay: .1s; }
.lg-a3 .qmark.q2 { left: 38%; top: 0; font-size: 16px; animation-delay: .35s; }
.lg-a3 .qmark.q3 { right: 20%; top: 9%; font-size: 13px; animation-delay: .6s; }
@keyframes a3-q {
  0%, 22% { opacity: 0; transform: translateY(8px) scale(.8); }
  34% { opacity: 1; transform: translateY(0) scale(1); }
  62% { opacity: .9; transform: translateY(-6px) scale(1); }
  78%, 100% { opacity: 0; transform: translateY(-14px) scale(.9); }
}
.lg-a3 .mascot-bubble {
  margin-top: 12px; padding: 12px 16px; border-radius: 12px;
  background: rgba(255,255,255,.08); border: 1px solid rgba(140,205,255,.18);
  font-size: 12.5px; color: rgba(233,241,250,.86); letter-spacing: .02em;
}
.lg-a3 .mascot-bubble b { color: #8fdccb; font-weight: 500; }
.lg-a3 .mascot-src { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; font-size: 10px; color: rgba(233,241,250,.45); letter-spacing: .06em; }
.lg-a3 .mascot-src span:last-child { color: #8fdccb; }

.lg-a3 .proof { padding: clamp(80px, 10vw, 130px) 0; background: var(--paper-2); }
.lg-a3 .proof h2 { font-family: var(--serif); font-size: clamp(30px, 4vw, 54px); font-weight: 600; line-height: 1.3; max-width: 860px; }
.lg-a3 .proof-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: clamp(26px, 5vw, 70px); margin-top: 54px; align-items: start; }
.lg-a3 blockquote {
  font-family: var(--serif); font-size: clamp(20px, 2.3vw, 30px); line-height: 1.72; letter-spacing: .02em;
  border-left: 2px solid var(--blue); padding-left: 26px; color: var(--ink-2);
}
.lg-a3 .quote-by { margin-top: 22px; padding-left: 28px; font-size: 12px; color: var(--muted); letter-spacing: .08em; }
.lg-a3 .trust-list { display: grid; gap: 0; border-top: 1px solid var(--line); }
.lg-a3 .trust-row { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; padding: 18px 2px; border-bottom: 1px solid var(--line); }
.lg-a3 .trust-row b { font-size: 14px; font-weight: 500; letter-spacing: .02em; }
.lg-a3 .trust-row span { font-size: 11.5px; color: var(--muted); text-align: right; }

.lg-a3 .contact {
  position: relative; overflow: hidden; text-align: center; color: #f4f7fb;
  padding: clamp(100px, 12vw, 160px) 0 50px;
  background: radial-gradient(800px 480px at 50% 0%, rgba(30,123,255,.28), transparent 64%), #071522;
}
.lg-a3 .contact h2 { font-family: var(--serif); font-size: clamp(32px, 4.6vw, 62px); font-weight: 600; line-height: 1.26; }
.lg-a3 .contact p { margin-top: 20px; font-size: 14px; color: rgba(233,241,250,.62); }
.lg-a3 .contact .btn.light { margin-top: 34px; background: #f3f0e7; color: #10100e; box-shadow: 0 18px 44px rgba(30,123,255,.3); }
.lg-a3 .contact .btn.light:hover { transform: translateY(-2px); }
.lg-a3 .contact .addr { margin-top: 40px; font-size: 12px; color: rgba(233,241,250,.45); line-height: 1.9; letter-spacing: .04em; }
.lg-a3 .contact .addr span { opacity: .6; }
.lg-a3 .foot {
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px;
  margin-top: 60px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.1);
  font-size: 11px; color: rgba(255,255,255,.36);
}

@media (max-width: 920px) {
  .lg-a3 .links a:not(.cta) { display: none; }
  .lg-a3 .hero-inner { padding-top: 130px; padding-bottom: 90px; }
  .lg-a3 .hero h1 { font-size: clamp(36px, 10vw, 56px); }
  .lg-a3 .stats { grid-template-columns: 1fr; gap: 0; }
  .lg-a3 .stat { padding: 18px 0; }
  .lg-a3 .cap { grid-template-columns: 1fr; }
  .lg-a3 .cap-visual { height: 230px; }
  .lg-a3 .route-cards { grid-template-columns: 1fr; }
  .lg-a3 .tech-inner { grid-template-columns: 1fr; }
  .lg-a3 .mascot-stage { height: 180px; }
  .lg-a3 .proof-grid { grid-template-columns: 1fr; }
  .lg-a3 .painting-note { display: none; }
}
@media (max-width: 560px) {
  .lg-a3 .brand small { display: none; }
  .lg-a3 .lang { min-width: 0; }
  .lg-a3 .cap-main { grid-template-columns: 1fr; }
  .lg-a3 .cap-no { padding-top: 0; margin-bottom: 10px; }
  .lg-a3 .cap ul { grid-column: 1; }
  .lg-a3 .hero-actions .btn { flex: 1; justify-content: center; }
  .lg-a3 .route-labels { font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .lg-a3 { scroll-behavior: auto; }
  .lg-a3 *, .lg-a3 *::before, .lg-a3 *::after { animation: none !important; transition: none !important; }
  .lg-a3 .reveal { opacity: 1; transform: none; }
}

/* 鲁港通 - 英文排版：方正无衬线 + 英文正文重排 */
html[data-lang="en"] .lg-a3 {
  --serif: "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --sans: "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}
html[data-lang="en"] .lg-a3 .brand b { font-size: 17px; letter-spacing: .02em; }
html[data-lang="en"] .lg-a3 .brand small { letter-spacing: .18em; }
html[data-lang="en"] .lg-a3 .links { font-size: 14px; letter-spacing: 0; }
html[data-lang="en"] .lg-a3 .links .cta { font-size: 13px; letter-spacing: 0; }
html[data-lang="en"] .lg-a3 .eyebrow { letter-spacing: .2em; }
html[data-lang="en"] .lg-a3 .hero h1 { font-size: clamp(40px, 5.4vw, 74px); line-height: 1.06; letter-spacing: -.025em; }
html[data-lang="en"] .lg-a3 .hero .lede { max-width: 640px; font-size: 17px; line-height: 1.75; letter-spacing: 0; }
html[data-lang="en"] .lg-a3 .hero-meta { font-size: 12px; letter-spacing: .01em; }
html[data-lang="en"] .lg-a3 .btn { letter-spacing: 0; }
html[data-lang="en"] .lg-a3 .section-no { letter-spacing: .14em; }
html[data-lang="en"] .lg-a3 .statement { max-width: 960px; font-size: clamp(32px, 4.2vw, 56px); line-height: 1.14; letter-spacing: -.02em; }
html[data-lang="en"] .lg-a3 .statement-sub { max-width: 680px; font-size: 16px; line-height: 1.78; letter-spacing: 0; }
html[data-lang="en"] .lg-a3 h2 { line-height: 1.12; letter-spacing: -.02em; }
html[data-lang="en"] .lg-a3 .stat b { font-size: clamp(34px, 3.4vw, 46px); letter-spacing: -.02em; }
html[data-lang="en"] .lg-a3 .stat b small { letter-spacing: .02em; }
html[data-lang="en"] .lg-a3 .stat > span { font-size: 13px; line-height: 1.6; letter-spacing: .01em; }
html[data-lang="en"] .lg-a3 .cap h3,
html[data-lang="en"] .lg-a3 .rcard h3,
html[data-lang="en"] .lg-a3 .doc h4 { letter-spacing: 0; }
html[data-lang="en"] .lg-a3 .cap p,
html[data-lang="en"] .lg-a3 .rcard p { letter-spacing: 0; line-height: 1.75; }
html[data-lang="en"] .lg-a3 .proof blockquote { line-height: 1.55; letter-spacing: 0; }
html[data-lang="en"] .lg-a3 .route-labels { letter-spacing: .02em; }
html[data-lang="en"] .lg-a3 .lang button { letter-spacing: 0; }

/* 鲁港通 - 韩文排版：Malgun Gothic + keep-all 防断词 */
html[data-lang="ko-KR"] .lg-a3 {
  --serif: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Microsoft YaHei", sans-serif;
  --sans: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Microsoft YaHei", sans-serif;
}
html[data-lang="ko-KR"] .lg-a3 .brand b { font-size: 17px; letter-spacing: .01em; }
html[data-lang="ko-KR"] .lg-a3 .links { font-size: 13.5px; letter-spacing: 0; }
html[data-lang="ko-KR"] .lg-a3 .btn { letter-spacing: 0; }
html[data-lang="ko-KR"] .lg-a3 .section-no { letter-spacing: .1em; }
html[data-lang="ko-KR"] .lg-a3 .hero h1 { font-size: clamp(38px, 5vw, 68px); line-height: 1.28; letter-spacing: -.02em; word-break: keep-all; }
html[data-lang="ko-KR"] .lg-a3 .hero .lede { max-width: 620px; font-size: 16.5px; line-height: 1.95; letter-spacing: 0; word-break: keep-all; }
html[data-lang="ko-KR"] .lg-a3 .statement { max-width: 900px; font-size: clamp(30px, 4vw, 52px); line-height: 1.42; letter-spacing: -.01em; word-break: keep-all; }
html[data-lang="ko-KR"] .lg-a3 .statement-sub { font-size: 15.5px; line-height: 1.95; word-break: keep-all; }
html[data-lang="ko-KR"] .lg-a3 h2 { line-height: 1.32; letter-spacing: -.01em; word-break: keep-all; }
html[data-lang="ko-KR"] .lg-a3 .stat b small { letter-spacing: 0; }
html[data-lang="ko-KR"] .lg-a3 .stat > span { font-size: 13px; line-height: 1.7; letter-spacing: 0; word-break: keep-all; }
html[data-lang="ko-KR"] .lg-a3 .proof blockquote { line-height: 1.8; letter-spacing: 0; word-break: keep-all; }
html[data-lang="ko-KR"] .lg-a3 .cap p,
html[data-lang="ko-KR"] .lg-a3 .rcard p,
html[data-lang="ko-KR"] .lg-a3 .trust-row,
html[data-lang="ko-KR"] .lg-a3 .contact p { word-break: keep-all; }
html[data-lang="ko-KR"] .lg-a3 .lang button { letter-spacing: 0; }
`;
