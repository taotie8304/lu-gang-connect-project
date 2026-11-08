// 鲁港通 - 首页 v4 样式：米色纸张 + 衬线大标题 + 深色卡片，全部收敛在 .lg-home 下
export const HOME_CSS = `
  .lg-home {
    --paper: #f7f4ec;
    --paper-2: #f2eee3;
    --card: #fffdf8;
    --ink: #1e1d1a;
    --ink-2: #3f3b33;
    --muted: #6f6a5e;
    --faint: #8f897b;
    --line: rgba(30, 29, 26, 0.12);
    --line-2: rgba(30, 29, 26, 0.18);
    --blue: #1e7bff;
    --blue-soft: #e8f1ff;
    --jade: #3f9c8c;
    --gold: #a9853f;
    --serif: 'Songti SC', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN', 'STSong', 'SimSun', Georgia, serif;
    --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    --shadow-s: 0 1px 2px rgba(30, 29, 26, 0.05), 0 6px 18px rgba(30, 29, 26, 0.05);
    --shadow-m: 0 2px 6px rgba(30, 29, 26, 0.05), 0 18px 48px rgba(30, 29, 26, 0.09);
    --shadow-l: 0 4px 12px rgba(30, 29, 26, 0.06), 0 32px 80px rgba(30, 29, 26, 0.12);
    position: relative;
    height: 100%;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
    overflow-y: auto;
    scroll-behavior: smooth;
    scroll-padding-top: 84px;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-gutter: stable;
  }
  .lg-home *, .lg-home *::before, .lg-home *::after { box-sizing: border-box; }
  .lg-home a { color: inherit; text-decoration: none; }
  .lg-home button { font-family: inherit; }
  .lg-home :focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; border-radius: 6px; }
  .lg-home :where(h1, h2, h3, h4, p) { margin: 0; }
  .lg-home .h5-wrap { max-width: 1200px; margin: 0 auto; padding: 0 32px; }
  .h5-sr {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }

  /* ---------- progress + nav ---------- */
  .h5-progress {
    position: fixed; top: var(--lugang-titlebar-height, 0px); left: 0; z-index: 90;
    height: 2px; width: 0;
    background: linear-gradient(90deg, var(--blue), var(--jade));
    transition: width 0.08s linear;
  }
  .h5-nav {
    position: sticky; top: 0; z-index: 50;
    background: rgba(247, 244, 236, 0.72);
    border-bottom: 1px solid transparent;
    transition: background 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease;
  }
  .h5-nav.is-scrolled {
    background: rgba(247, 244, 236, 0.9);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom-color: var(--line);
  }
  .h5-nav-in {
    max-width: 1200px; margin: 0 auto; padding: 0 32px;
    height: 66px; display: flex; align-items: center; gap: 26px;
  }
  .h5-brand { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .h5-brand svg {
    width: 32px; height: 32px; display: block;
    border-radius: 8px; box-shadow: 0 3px 10px rgba(78, 128, 178, 0.26);
  }
  .h5-brand-name { font-size: 16px; font-weight: 600; letter-spacing: 0.12em; color: var(--ink); }
  .h5-brand-name small { display: block; font-size: 8.5px; font-weight: 400; letter-spacing: 0.26em; color: var(--faint); margin-top: 1px; }
  .h5-links { display: flex; align-items: center; gap: 26px; margin-left: 12px; }
  .h5-link {
    position: relative; font-size: 13.5px; color: var(--muted);
    padding: 6px 2px; letter-spacing: 0.03em; transition: color 0.2s ease;
  }
  .h5-link::after {
    content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
    background: var(--ink); transform: scaleX(0); transform-origin: left;
    transition: transform 0.25s ease;
  }
  .h5-link:hover { color: var(--ink); }
  .h5-link:hover::after { transform: scaleX(1); }
  .h5-nav-right { margin-left: auto; display: flex; align-items: center; gap: 20px; }
  .h5-nav-lang { width: 124px; flex-shrink: 0; }
  .h5-nav-lang button {
    height: 34px; padding: 0 10px; border-radius: 999px;
    background: transparent; border-color: var(--line-2);
    font-size: 12px; color: var(--muted); box-shadow: none;
  }
  .h5-nav-lang button:hover { background: rgba(30, 29, 26, 0.04); border-color: var(--line-2); }
  .h5-nav-lang img, .h5-nav-lang svg { width: 14px; height: 14px; }
  .h5-nav-dl { font-size: 13.5px; color: var(--muted); transition: color 0.2s ease; }
  .h5-nav-dl:hover { color: var(--ink); }
  .h5-nav-login { font-size: 13.5px; color: var(--ink); }
  .h5-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    height: 42px; padding: 0 22px; border-radius: 999px;
    font-size: 14px; letter-spacing: 0.03em; cursor: pointer;
    border: 1px solid transparent;
    transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    white-space: nowrap;
  }
  .h5-btn:hover { transform: translateY(-1px); }
  .h5-btn-dark { background: #1f1e1c; color: #f7f4ec; }
  .h5-btn-dark:hover { background: #33312c; }
  .lg-home a.h5-btn-dark, .lg-home a.h5-btn-dark:hover { color: #f7f4ec; }
  .h5-btn-line { background: transparent; color: var(--ink); border-color: var(--line-2); }
  .h5-btn-line:hover { background: rgba(30, 29, 26, 0.04); border-color: var(--ink); }
  .h5-nav .h5-btn { height: 36px; padding: 0 18px; font-size: 13px; }
  .h5-burger {
    display: none; width: 38px; height: 38px; margin-left: 2px; padding: 0;
    align-items: center; justify-content: center; flex-direction: column; gap: 5px;
    border-radius: 999px; border: 1px solid var(--line-2); background: transparent;
    cursor: pointer;
  }
  .h5-burger span {
    display: block; width: 15px; height: 1.5px; border-radius: 2px;
    background: var(--ink); transition: transform 0.25s ease;
  }
  .h5-nav.is-menu .h5-burger span:nth-child(1) { transform: translateY(3.25px) rotate(45deg); }
  .h5-nav.is-menu .h5-burger span:nth-child(2) { transform: translateY(-3.25px) rotate(-45deg); }
  .h5-menu { display: none; }

  /* ---------- hero ---------- */
  .h5-hero {
    position: relative;
    padding: clamp(64px, 8vw, 112px) 0 34px;
    text-align: center;
    isolation: isolate;
  }
  .h5-hero-bg { position: absolute; inset: -40px 0 auto; height: 860px; pointer-events: none; overflow: hidden; }
  .h5-hero-glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 46% 34% at 50% 6%, rgba(30, 123, 255, 0.10), transparent 68%),
      radial-gradient(ellipse 30% 30% at 78% 28%, rgba(63, 156, 140, 0.08), transparent 70%),
      radial-gradient(ellipse 26% 26% at 18% 34%, rgba(169, 133, 63, 0.06), transparent 72%);
  }
  .h5-hero-grid {
    position: absolute; left: 50%; top: -20px; width: min(1120px, 96vw); height: 560px;
    transform: translateX(-50%);
    background-image: radial-gradient(rgba(30, 29, 26, 0.13) 1px, transparent 1px);
    background-size: 28px 28px;
    mask-image: radial-gradient(ellipse 56% 58% at 50% 34%, #000 8%, transparent 72%);
    -webkit-mask-image: radial-gradient(ellipse 56% 58% at 50% 34%, #000 8%, transparent 72%);
    opacity: 0.32;
  }
  .h5-orb {
    position: absolute; border-radius: 50%;
    filter: blur(42px); opacity: 0.55;
    animation: h5-drift 20s ease-in-out infinite alternate;
    will-change: transform;
  }
  .h5-orb.a { width: 340px; height: 340px; left: 6%; top: 24%; background: rgba(30, 123, 255, 0.16); }
  .h5-orb.b { width: 280px; height: 280px; right: 4%; top: 46%; background: rgba(63, 156, 140, 0.15); animation-delay: -7s; }
  .h5-orb.c { width: 220px; height: 220px; left: 42%; top: 66%; background: rgba(169, 133, 63, 0.10); animation-delay: -13s; }
  @keyframes h5-drift {
    from { translate: 0 0; scale: 1; }
    to { translate: 26px -34px; scale: 1.08; }
  }
  .h5-hero > .h5-wrap { position: relative; z-index: 2; }
  .h5-eyebrow {
    display: inline-flex; align-items: center; gap: 14px;
    font-size: 11.5px; letter-spacing: 0.2em; color: var(--faint);
  }
  .h5-eyebrow::before, .h5-eyebrow::after {
    content: ''; width: 28px; height: 1px; background: rgba(30, 29, 26, 0.22);
  }
  .h5-hero h1 {
    margin: 30px auto 0; max-width: 1040px;
    font-family: var(--serif); font-weight: 600;
    font-size: clamp(46px, 8.2vw, 106px);
    line-height: 1.07; letter-spacing: 0.015em;
    color: var(--ink); text-wrap: balance;
  }
  .h5-hero h1 em { font-style: normal; color: var(--ink); position: relative; }
  .h5-hero h1 em::after {
    content: ''; position: absolute; left: 2%; right: 2%; bottom: 0.06em; height: 0.09em;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(30, 123, 255, 0.22), rgba(63, 156, 140, 0.18));
    z-index: -1;
  }
  .h5-lede {
    margin: 30px auto 0; max-width: 660px; text-wrap: pretty;
    font-size: clamp(14.5px, 1.25vw, 17px); line-height: 2.05; color: var(--muted); letter-spacing: 0.02em;
  }
  .h5-cta { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-top: 38px; }
  .h5-cta .h5-btn { height: 48px; padding: 0 30px; font-size: 14.5px; }
  .h5-meta {
    display: flex; justify-content: center; flex-wrap: wrap; gap: 10px 22px;
    margin-top: 30px; font-size: 11.5px; color: var(--faint); letter-spacing: 0.06em;
  }
  .h5-meta span { display: inline-flex; align-items: center; gap: 7px; }
  .h5-meta i { width: 3px; height: 3px; border-radius: 50%; background: currentColor; opacity: 0.6; }
  .h5-hero-mascot {
    position: absolute; right: max(1.6vw, 18px); top: 12%;
    width: clamp(132px, 14vw, 204px); z-index: 1;
    will-change: transform;
    transition: transform 0.55s cubic-bezier(0.22, 1.35, 0.36, 1);
  }
  .h5-mascot-bob { animation: h5-bob 6.5s ease-in-out infinite; }
  .h5-mascot-figure { position: relative; display: block; width: 100%; }
  .h5-mascot-img {
    display: block; width: 100%; height: auto;
    mix-blend-mode: multiply;
    filter: drop-shadow(0 22px 34px rgba(30, 123, 255, 0.22));
    user-select: none; -webkit-user-drag: none;
  }
  .h5-eyes { position: absolute; inset: 0; pointer-events: none; }
  .h5-eye {
    position: absolute; width: 6.3%; height: 7.4%;
    border-radius: 50%; background: #fff;
    box-shadow:
      inset -2px -3px 0 rgba(140, 212, 245, 0.55),
      inset 0 0 0 1.5px rgba(46, 150, 209, 0.35),
      0 2px 5px rgba(34, 120, 180, 0.14);
    transform: translate(-50%, -50%);
    transition:
      height 0.16s ease, width 0.18s ease, border-radius 0.16s ease,
      transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.16s ease;
    will-change: transform, height;
  }
  .h5-eye.left { left: 38.3%; top: 47.4%; }
  .h5-eye.right { left: 62.1%; top: 46.9%; }
  .h5-eyes[data-face='blink'] .h5-eye {
    height: 1.4%; border-radius: 999px;
    box-shadow: inset 0 0 0 1.5px rgba(46, 150, 209, 0.28);
  }
  .h5-eyes[data-face='squint'] .h5-eye { height: 2.4%; width: 6.7%; border-radius: 999px; }
  .h5-eyes[data-face='wide'] .h5-eye { height: 8.8%; width: 6.9%; }
  .h5-eyes[data-face='left'] .h5-eye { transform: translate(calc(-50% - 26%), -50%); }
  .h5-eyes[data-face='right'] .h5-eye { transform: translate(calc(-50% + 26%), -50%); }
  @keyframes h5-bob {
    0%, 100% { transform: translateY(0) rotate(-1.2deg); }
    50% { transform: translateY(-14px) rotate(1.4deg); }
  }
  .h5-mascot-say {
    position: absolute; right: 88%; top: 16%;
    padding: 8px 13px; border-radius: 12px 12px 3px 12px;
    background: var(--card); border: 1px solid var(--line-2);
    box-shadow: var(--shadow-s);
    font-size: 11.5px; color: var(--muted); letter-spacing: 0.04em; white-space: nowrap;
  }
  .h5-mascot-say::after {
    content: ''; position: absolute; right: -5px; bottom: 6px;
    width: 9px; height: 9px; background: var(--card);
    border-right: 1px solid var(--line-2); border-bottom: 1px solid var(--line-2);
    transform: rotate(-45deg);
  }
  .h5-float {
    position: absolute; z-index: 0;
    padding: 7px 13px; border-radius: 999px;
    background: rgba(255, 253, 248, 0.82); border: 1px solid var(--line);
    box-shadow: 0 8px 22px rgba(30, 29, 26, 0.05);
    font-size: 11px; color: var(--muted); letter-spacing: 0.05em;
    animation: h5-floaty 9s ease-in-out infinite;
    will-change: transform;
  }
  .h5-float.f1 { left: 4%; top: 24%; animation-delay: -1s; }
  .h5-float.f2 { left: 8%; top: 56%; animation-delay: -4s; }
  .h5-float.f3 { left: 16%; top: 76%; animation-delay: -6.5s; }
  .h5-float.f4 { right: 5%; top: 66%; animation-delay: -2.5s; }
  .h5-float.f5 { right: 12%; top: 84%; animation-delay: -5s; }
  @keyframes h5-floaty {
    0%, 100% { translate: 0 0; }
    50% { translate: 0 -10px; }
  }
  .h5-scroll-cue {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    margin-top: 46px; font-size: 10px; letter-spacing: 0.22em; color: var(--faint);
  }
  .h5-scroll-cue i {
    display: block; width: 1px; height: 34px;
    background: linear-gradient(180deg, rgba(30, 29, 26, 0.35), transparent);
    animation: h5-cue 2.6s ease-in-out infinite;
  }
  @keyframes h5-cue { 0%, 100% { opacity: 0.35; transform: scaleY(0.6); } 50% { opacity: 1; transform: scaleY(1); } }

  /* ---------- workbench ---------- */
  .h5-work { padding: 12px 0 0; position: relative; }
  .h5-work-stage { will-change: transform; transition: transform 0.35s ease-out; }
  .h5-work-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(432px, 0.85fr);
    gap: 22px; align-items: stretch;
  }
  .h5-demo-wrap { position: relative; min-width: 0; }
  .h5-peek {
    position: absolute; top: -52px; right: 30px; width: 86px; z-index: 3;
    pointer-events: none; animation: h5-bob 5.6s ease-in-out infinite;
  }
  .h5-peek img { display: block; width: 100%; mix-blend-mode: multiply; filter: drop-shadow(0 12px 20px rgba(30, 123, 255, 0.22)); }
  .h5-demo {
    display: flex; flex-direction: column; height: 100%;
    background: var(--card);
    border: 1px solid var(--line-2);
    border-radius: 22px; overflow: hidden;
    box-shadow: var(--shadow-l);
  }
  .h5-demo-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 16px; border-bottom: 1px solid var(--line);
    background: rgba(30, 29, 26, 0.025);
  }
  .h5-dots { display: flex; gap: 6px; }
  .h5-dots i { width: 9px; height: 9px; border-radius: 50%; display: block; }
  .h5-dots i:nth-child(1) { background: #df9a8f; }
  .h5-dots i:nth-child(2) { background: #dcc08a; }
  .h5-dots i:nth-child(3) { background: #9dbfa4; }
  .h5-url {
    margin-left: 8px; flex: 1; max-width: 320px;
    padding: 5px 12px; border-radius: 999px;
    background: rgba(255, 253, 248, 0.9); border: 1px solid var(--line);
    font-size: 10.5px; color: var(--faint); letter-spacing: 0.04em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .h5-live {
    margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
    font-size: 10px; letter-spacing: 0.12em; color: var(--jade);
  }
  .h5-live i { width: 5px; height: 5px; border-radius: 50%; background: var(--jade); animation: h5-pulse 2.6s ease-in-out infinite; }
  @keyframes h5-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
  .h5-stage {
    position: relative; flex: 1; min-height: 440px; padding: 26px 26px 52px;
    background:
      radial-gradient(ellipse 70% 60% at 20% 0%, rgba(30, 123, 255, 0.05), transparent 70%),
      radial-gradient(ellipse 60% 50% at 100% 100%, rgba(63, 156, 140, 0.05), transparent 70%),
      #fffdf8;
  }
  .h5-scene {
    position: absolute; inset: 26px 26px 52px;
    display: flex; flex-direction: column; justify-content: center;
    opacity: 0; transform: translateY(10px);
    transition: opacity 0.55s ease, transform 0.55s ease;
    pointer-events: none;
  }
  .h5-scene.is-on { opacity: 1; transform: none; }
  .h5-q {
    align-self: flex-end; max-width: 76%;
    padding: 10px 15px; border-radius: 14px 14px 4px 14px;
    background: #1f1e1c; color: #f7f4ec;
    font-size: 13px; line-height: 1.65;
  }
  .h5-a {
    margin-top: 14px; align-self: flex-start; max-width: 92%;
    padding: 16px 18px; border-radius: 14px 14px 14px 4px;
    background: #fbf9f3; border: 1px solid var(--line);
    font-size: 12.5px; line-height: 1.85; color: var(--ink-2);
  }
  .h5-a strong { font-weight: 600; color: var(--ink); }
  .h5-steps { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 9px; }
  .h5-steps li { display: flex; gap: 10px; align-items: flex-start; }
  .h5-steps b {
    flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 50%; font-size: 10px; font-weight: 600;
    color: var(--blue); background: rgba(30, 123, 255, 0.09);
  }
  .h5-src { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 13px; }
  .h5-src span {
    font-size: 10px; letter-spacing: 0.03em; color: #2f6f8f;
    padding: 4px 9px; border-radius: 6px;
    background: rgba(30, 123, 255, 0.06); border: 1px solid rgba(30, 123, 255, 0.16);
  }
  .h5-scene-route { justify-content: center; }
  .h5-route-cap { display: flex; justify-content: space-between; font-size: 11px; color: var(--faint); letter-spacing: 0.1em; }
  .h5-route-line { position: relative; height: 2px; margin-top: 12px; background: rgba(30, 29, 26, 0.1); border-radius: 2px; }
  .h5-route-fill {
    position: absolute; inset: 0 auto 0 0; width: 0; border-radius: 2px;
    background: linear-gradient(90deg, var(--jade), var(--blue));
  }
  .h5-scene.is-on .h5-route-fill { animation: h5-route 2.2s cubic-bezier(0.3, 0.7, 0.3, 1) 0.15s forwards; }
  @keyframes h5-route { from { width: 0; } to { width: 78%; } }
  .h5-route-dot {
    position: absolute; top: 50%; left: 0; width: 10px; height: 10px; margin-top: -5px;
    border-radius: 50%; background: #fff; border: 2px solid var(--blue);
    box-shadow: 0 0 0 4px rgba(30, 123, 255, 0.12);
  }
  .h5-scene.is-on .h5-route-dot { animation: h5-dot 2.2s cubic-bezier(0.3, 0.7, 0.3, 1) 0.15s forwards; }
  @keyframes h5-dot { from { left: 0; } to { left: 78%; } }
  .h5-route-ends { display: flex; justify-content: space-between; margin-top: 16px; }
  .h5-route-ends b { display: block; font-family: var(--serif); font-size: 19px; font-weight: 600; letter-spacing: 0.04em; }
  .h5-route-ends small { display: block; margin-top: 2px; font-size: 9.5px; letter-spacing: 0.16em; color: var(--faint); }
  .h5-route-ends > div:last-child { text-align: right; }
  .h5-route-meta { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 30px; }
  .h5-route-meta span {
    font-size: 11px; padding: 5px 12px; border-radius: 999px;
    border: 1px solid var(--line); color: var(--muted); background: rgba(255, 253, 248, 0.8);
  }
  .h5-scene-doc { justify-content: center; }
  .h5-doc-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
  .h5-doc-head b, .h5-doc-head strong { font-family: var(--serif); font-size: 16px; font-weight: 600; letter-spacing: 0.04em; }
  .h5-doc-head span { font-size: 10px; letter-spacing: 0.12em; color: var(--faint); }
  .h5-doc-row {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 13px; border-radius: 10px;
    border: 1px solid var(--line); background: #fbf9f3;
  }
  .h5-doc-row + .h5-doc-row { margin-top: 8px; }
  .h5-doc-check {
    width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(63, 156, 140, 0.12); color: var(--jade); font-size: 10px; font-weight: 700;
  }
  .h5-doc-name { font-size: 12.5px; color: var(--ink); }
  .h5-doc-meta { margin-left: auto; font-size: 10px; color: var(--faint); letter-spacing: 0.03em; }
  .h5-scene-bars { position: absolute; left: 26px; bottom: 22px; display: flex; gap: 6px; z-index: 2; }
  .h5-scene-bars i { width: 22px; height: 3px; border-radius: 2px; background: rgba(30, 29, 26, 0.14); display: block; transition: background 0.3s ease; }
  .h5-scene-bars i.is-on { background: var(--ink); }
  .h5-stage-note { position: absolute; right: 24px; bottom: 20px; z-index: 2; font-size: 10px; color: var(--faint); letter-spacing: 0.05em; }

  /* login + download */
  .h5-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .h5-login {
    min-width: 0;
    background: var(--card); border: 1px solid var(--line-2); border-radius: 22px;
    padding: 24px 22px 22px; box-shadow: var(--shadow-s);
  }
  .h5-login h2 { font-family: var(--serif); font-size: 24px; font-weight: 600; letter-spacing: 0.03em; }
  .h5-login-sub { margin-top: 6px; font-size: 12.5px; color: var(--faint); }
  .h5-login-body { margin-top: 16px; font-size: 14px; line-height: 1.5; }
  /* 鲁港通 - 隐藏 LoginForm 内置的 logo 品牌行，避免与卡片标题「登录鲁港通」重复（body > LoginContainer > LoginFormPanel > FormLayout > 品牌行） */
  .h5-login-body > div > div > div > div:first-child { display: none; }
  .h5-dl { border: 1px solid var(--line-2); border-radius: 18px; padding: 16px 18px; background: rgba(255, 253, 248, 0.5); }
  .h5-dl-title { display: flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.14em; color: var(--faint); }
  .h5-dl-title::after { content: ''; flex: 1; height: 1px; background: var(--line); }
  .h5-dl-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-radius: 10px; transition: background 0.2s ease; }
  .h5-dl-row + .h5-dl-row { border-top: 1px solid var(--line); }
  .h5-dl-row:hover { background: rgba(30, 29, 26, 0.04); }
  .h5-dl-ico { width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .h5-dl-ico.win { background: rgba(30, 123, 255, 0.09); color: var(--blue); }
  .h5-dl-ico.android { background: rgba(63, 156, 140, 0.12); color: #2f8578; }
  .h5-dl-ico svg { width: 16px; height: 16px; }
  .h5-dl-name { display: block; font-size: 13px; color: var(--ink); }
  .h5-dl-ver { display: block; margin-top: 1px; font-size: 10.5px; color: var(--faint); letter-spacing: 0.03em; }
  .h5-dl-arrow { margin-left: auto; font-size: 12px; color: var(--faint); }
  .h5-dl-note { margin-top: 6px; font-size: 10.5px; line-height: 1.7; color: var(--faint); }

  /* ---------- stats + marquee ---------- */
  .h5-stats { padding: 64px 0 0; }
  .h5-stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; }
  .h5-stat { border-top: 1px solid var(--line-2); padding-top: 18px; text-align: center; }
  .h5-stat b { display: block; font-family: var(--serif); font-size: clamp(28px, 3vw, 40px); font-weight: 600; letter-spacing: 0; }
  .h5-stat b small { margin-left: 4px; font-size: 12px; font-family: var(--sans); font-weight: 400; color: var(--faint); letter-spacing: 0.06em; }
  .h5-stat > span { display: block; margin-top: 6px; font-size: 12px; color: var(--muted); letter-spacing: 0.03em; }
  .h5-marquee {
    margin-top: 56px; padding: 16px 0;
    border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
    overflow: hidden; position: relative;
    mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  }
  .h5-marquee-track { display: flex; width: max-content; animation: h5-marquee 46s linear infinite; }
  .h5-marquee:hover .h5-marquee-track { animation-play-state: paused; }
  .h5-marquee-track span {
    display: inline-flex; align-items: center; gap: 18px;
    padding: 0 18px; font-size: 11.5px; letter-spacing: 0.16em; color: var(--faint); white-space: nowrap;
  }
  .h5-marquee-track span::after { content: '·'; color: rgba(30, 29, 26, 0.28); }
  @keyframes h5-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

  /* ---------- shared section head ---------- */
  .h5-kicker { font-size: 11px; letter-spacing: 0.24em; color: var(--gold); }
  .h5-h2 { margin-top: 12px; font-family: var(--serif); font-weight: 600; font-size: clamp(32px, 4vw, 54px); line-height: 1.22; letter-spacing: 0.02em; text-wrap: balance; }
  .h5-sub { margin: 16px auto 0; max-width: 660px; font-size: 14.5px; line-height: 1.95; color: var(--muted); }
  .h5-head-center { text-align: center; }

  /* ---------- personas ---------- */
  .h5-personas { margin-top: 92px; padding: 96px 0; background: var(--paper-2); }
  .h5-persona-tabs {
    display: inline-flex; flex-wrap: wrap; justify-content: center; gap: 2px;
    margin-top: 30px; padding: 4px; border-radius: 999px;
    border: 1px solid var(--line-2); background: rgba(255, 253, 248, 0.72);
  }
  .h5-persona-tab {
    height: 38px; padding: 0 22px; border: 0; border-radius: 999px; cursor: pointer;
    background: transparent; font-size: 13px; color: var(--muted); letter-spacing: 0.04em;
    transition: background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease;
  }
  .h5-persona-tab.is-on { background: #1f1e1c; color: #f7f4ec; box-shadow: 0 6px 16px rgba(31, 30, 28, 0.18); }
  .h5-persona-stage { position: relative; margin-top: 32px; }
  .h5-persona-panel {
    display: none;
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: 18px;
  }
  .h5-persona-panel.is-on { display: grid; animation: h5-fade 0.45s ease both; }
  @keyframes h5-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .h5-persona-q {
    display: flex; flex-direction: column; justify-content: center;
    padding: 34px 32px; border-radius: 20px;
    background: #1f1e1c; color: #f7f4ec;
    box-shadow: 0 24px 56px rgba(31, 30, 28, 0.2);
  }
  .h5-persona-q small { font-size: 10.5px; letter-spacing: 0.2em; color: rgba(247, 244, 236, 0.45); }
  .h5-persona-q p { margin-top: 18px; font-family: var(--serif); font-size: clamp(20px, 2.1vw, 28px); line-height: 1.55; letter-spacing: 0.02em; }
  .h5-persona-q span { margin-top: 22px; font-size: 11.5px; color: rgba(247, 244, 236, 0.55); }
  .h5-persona-a { padding: 30px 32px; border-radius: 20px; background: var(--card); border: 1px solid var(--line-2); box-shadow: var(--shadow-s); }
  .h5-persona-a small { font-size: 10.5px; letter-spacing: 0.2em; color: var(--faint); }
  .h5-persona-a h3 { margin-top: 12px; font-family: var(--serif); font-size: 20px; font-weight: 600; line-height: 1.5; letter-spacing: 0.02em; }
  .h5-persona-list { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 11px; counter-reset: pa; }
  .h5-persona-list li { display: grid; grid-template-columns: 22px 1fr; gap: 11px; align-items: start; font-size: 13px; line-height: 1.75; color: var(--muted); counter-increment: pa; }
  .h5-persona-list li::before {
    content: counter(pa, decimal-leading-zero);
    font-family: var(--serif); font-size: 11.5px; color: var(--blue); padding-top: 2px;
  }
  .h5-persona-src { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); }
  .h5-persona-src span { font-size: 10px; color: #2f6f8f; padding: 4px 9px; border-radius: 6px; background: rgba(30, 123, 255, 0.06); border: 1px solid rgba(30, 123, 255, 0.16); }

  /* ---------- flow ---------- */
  .h5-flow-section { padding: 104px 0 96px; }
  .h5-flow {
    position: relative; margin-top: 44px;
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;
  }
  .h5-flow-line { position: absolute; left: 0; right: 0; top: 27px; height: 1px; background: var(--line-2); }
  .h5-flow-line i { display: block; height: 100%; width: 12.5%; background: var(--ink); transition: width 0.4s cubic-bezier(0.3, 0.7, 0.3, 1); }
  .h5-flow-btn {
    position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 0 8px 16px; border: 0; background: transparent; cursor: pointer; text-align: center;
  }
  .h5-flow-no {
    width: 54px; height: 54px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--paper); border: 1px solid var(--line-2);
    font-family: var(--serif); font-size: 15px; color: var(--faint);
    transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
  }
  .h5-flow-btn.is-on .h5-flow-no { background: #1f1e1c; border-color: #1f1e1c; color: #f7f4ec; transform: scale(1.06); }
  .h5-flow-btn b { font-size: 14px; font-weight: 500; color: var(--muted); letter-spacing: 0.04em; transition: color 0.25s ease; }
  .h5-flow-btn.is-on b { color: var(--ink); }
  .h5-flow-detail {
    margin-top: 26px; display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: 20px; align-items: stretch;
  }
  .h5-flow-copy { position: relative; min-height: 300px; padding: 30px 30px 28px; border-radius: 20px; background: var(--card); border: 1px solid var(--line-2); box-shadow: var(--shadow-s); }
  .h5-flow-copy small { font-size: 10.5px; letter-spacing: 0.2em; color: var(--faint); }
  .h5-flow-copy h3 { margin-top: 12px; font-family: var(--serif); font-size: clamp(22px, 2.4vw, 30px); font-weight: 600; line-height: 1.4; }
  .h5-flow-copy p { margin-top: 14px; font-size: 13.5px; line-height: 1.95; color: var(--muted); }
  .h5-flow-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 20px; }
  .h5-flow-tags span { font-size: 10.5px; color: var(--muted); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); }
  .h5-flow-visual {
    position: relative; min-height: 300px; border-radius: 20px; overflow: hidden;
    background:
      radial-gradient(ellipse 70% 60% at 20% 0%, rgba(30, 123, 255, 0.07), transparent 70%),
      radial-gradient(ellipse 60% 50% at 100% 100%, rgba(63, 156, 140, 0.07), transparent 70%),
      var(--paper-2);
    border: 1px solid var(--line-2);
  }
  .h5-flow-pane { position: absolute; inset: 24px; opacity: 0; transform: translateY(12px); transition: opacity 0.4s ease, transform 0.4s ease; pointer-events: none; }
  .h5-flow-pane.is-on { opacity: 1; transform: none; }
  .h5-mini { height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 10px; }
  .h5-mini-q { align-self: flex-end; max-width: 82%; padding: 10px 14px; border-radius: 12px 12px 4px 12px; background: #1f1e1c; color: #f7f4ec; font-size: 12.5px; }
  .h5-mini-query { display: flex; gap: 8px; flex-wrap: wrap; }
  .h5-mini-query span { font-size: 10.5px; padding: 5px 10px; border-radius: 999px; background: rgba(255, 253, 248, 0.9); border: 1px solid var(--line); color: var(--muted); }
  .h5-mini-doc { padding: 18px 18px 16px; border-radius: 12px; background: var(--card); border: 1px solid var(--line-2); box-shadow: var(--shadow-s); }
  .h5-mini-doc-head { display: flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.12em; color: var(--faint); }
  .h5-mini-stamp { margin-left: auto; font-size: 9px; color: #2f6f8f; border: 1px solid rgba(30, 123, 255, 0.24); border-radius: 4px; padding: 2px 5px; letter-spacing: 0.08em; }
  .h5-mini-doc b { display: block; margin-top: 12px; font-family: var(--serif); font-size: 17px; font-weight: 600; line-height: 1.5; }
  .h5-mini-doc p { margin-top: 8px; font-size: 11.5px; line-height: 1.8; color: var(--muted); }
  .h5-mini-check { display: flex; align-items: center; gap: 10px; padding: 11px 13px; border-radius: 10px; background: var(--card); border: 1px solid var(--line); font-size: 12px; }
  .h5-mini-check + .h5-mini-check { margin-top: 8px; }
  .h5-mini-check i { width: 18px; height: 18px; border-radius: 50%; background: rgba(63, 156, 140, 0.12); color: var(--jade); display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-style: normal; flex-shrink: 0; }
  .h5-mini-check.missing { border-color: rgba(169, 133, 63, 0.4); background: rgba(169, 133, 63, 0.06); }
  .h5-mini-check.missing i { background: rgba(169, 133, 63, 0.16); color: var(--gold); }
  .h5-mini-check em { margin-left: auto; font-style: normal; font-size: 10px; color: var(--faint); }
  .h5-mini-browser { border-radius: 12px; background: var(--card); border: 1px solid var(--line-2); overflow: hidden; box-shadow: var(--shadow-s); }
  .h5-mini-browser-bar { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--line); background: rgba(30, 29, 26, 0.03); }
  .h5-mini-browser-bar span { flex: 1; height: 16px; border-radius: 999px; background: rgba(30, 29, 26, 0.06); }
  .h5-mini-browser-body { padding: 16px; }
  .h5-mini-field { height: 26px; border-radius: 6px; border: 1px solid var(--line); background: #fffefb; margin-top: 8px; }
  .h5-mini-field.short { width: 62%; }
  .h5-mini-confirm { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; padding: 6px 11px; border-radius: 999px; background: rgba(30, 123, 255, 0.08); color: #1a66d0; font-size: 10.5px; }

  /* ---------- agent ---------- */
  .h5-agent { padding: 104px 0 100px; background: var(--paper-2); position: relative; overflow: hidden; }
  .h5-agent::before {
    content: ''; position: absolute; left: 50%; top: 30%; width: 720px; height: 720px;
    transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(30, 123, 255, 0.10), transparent 66%);
    filter: blur(10px);
  }
  .h5-agent-grid { position: relative; display: grid; grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr); gap: 40px; align-items: center; }
  .h5-agent-stage { position: relative; display: flex; align-items: center; justify-content: center; min-height: 440px; }
  .h5-agent-ring {
    position: absolute; border-radius: 50%; border: 1px solid rgba(30, 123, 255, 0.18);
    left: 50%; top: 50%;
  }
  .h5-agent-ring.r1 { width: 300px; height: 300px; margin: -150px 0 0 -150px; animation: h5-ring 14s linear infinite; }
  .h5-agent-ring.r2 { width: 390px; height: 390px; margin: -195px 0 0 -195px; border-color: rgba(63, 156, 140, 0.16); animation: h5-ring 22s linear infinite reverse; }
  .h5-agent-ring.r3 { width: 480px; height: 480px; margin: -240px 0 0 -240px; border-color: rgba(169, 133, 63, 0.12); animation: h5-ring 30s linear infinite; }
  @keyframes h5-ring { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  .h5-agent-ring::after {
    content: ''; position: absolute; top: -3px; left: 50%; width: 6px; height: 6px; border-radius: 50%;
    background: var(--blue); box-shadow: 0 0 0 5px rgba(30, 123, 255, 0.1);
  }
  .h5-agent-mascot { position: relative; z-index: 2; width: clamp(200px, 24vw, 300px); will-change: transform; }
  .h5-agent-mascot img { display: block; width: 100%; mix-blend-mode: multiply; filter: drop-shadow(0 30px 50px rgba(30, 123, 255, 0.24)); }
  .h5-orbit {
    position: absolute; z-index: 3;
    padding: 7px 12px; border-radius: 999px;
    background: var(--card); border: 1px solid var(--line-2);
    font-size: 10.5px; letter-spacing: 0.06em; color: var(--muted);
    box-shadow: var(--shadow-s);
  }
  .h5-orbit.o1 { left: 2%; top: 24%; }
  .h5-orbit.o2 { right: 0; top: 18%; }
  .h5-orbit.o3 { left: 0; bottom: 22%; }
  .h5-orbit.o4 { right: 4%; bottom: 16%; }
  .h5-agent-feed { position: relative; }
  .h5-agent-feed .h5-head-center { text-align: left; }
  .h5-agent-feed .h5-sub { margin-left: 0; }
  .h5-agent-feed-head { display: flex; align-items: center; gap: 10px; margin-top: 30px; font-size: 11px; letter-spacing: 0.16em; color: var(--faint); }
  .h5-agent-feed-head i { width: 6px; height: 6px; border-radius: 50%; background: var(--jade); animation: h5-pulse 2s ease-in-out infinite; }
  .h5-agent-feed-head::after { content: ''; flex: 1; height: 1px; background: var(--line); }
  .h5-feed { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 10px; }
  .h5-feed li {
    display: grid; grid-template-columns: 58px 1fr auto; gap: 14px; align-items: center;
    padding: 16px 18px; border-radius: 14px;
    background: var(--card); border: 1px solid var(--line);
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .h5-feed li:hover { transform: translateX(4px); box-shadow: var(--shadow-s); }
  .h5-feed time { font-size: 11px; color: var(--faint); letter-spacing: 0.04em; }
  .h5-feed p { font-size: 13px; line-height: 1.7; color: var(--ink-2); }
  .h5-feed em { font-style: normal; font-size: 9.5px; letter-spacing: 0.08em; color: var(--jade); border: 1px solid rgba(63, 156, 140, 0.3); border-radius: 999px; padding: 3px 8px; white-space: nowrap; }
  .h5-agent-note { margin-top: 16px; font-size: 10.5px; color: var(--faint); letter-spacing: 0.04em; }

  /* ---------- pricing ---------- */
  .h5-pricing { padding: 108px 0 96px; }
  .h5-billing {
    display: inline-flex; align-items: center; gap: 2px; margin-top: 26px; padding: 3px;
    border-radius: 999px; border: 1px solid var(--line-2); background: rgba(255, 253, 248, 0.7);
  }
  .h5-billing button {
    height: 32px; padding: 0 16px; border: 0; border-radius: 999px; cursor: pointer;
    background: transparent; font-size: 12.5px; color: var(--muted); transition: background 0.2s ease, color 0.2s ease;
  }
  .h5-billing button.is-on { background: #1f1e1c; color: #f7f4ec; }
  .h5-billing small { font-size: 10px; opacity: 0.7; margin-left: 4px; }
  .h5-price-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 40px; align-items: stretch; }
  .h5-plan {
    display: flex; flex-direction: column; position: relative;
    padding: 24px 22px 22px; border-radius: 18px;
    background: var(--card); border: 1px solid var(--line);
    transition: transform 0.28s ease, box-shadow 0.28s ease;
  }
  .h5-plan:hover { transform: translateY(-3px); box-shadow: var(--shadow-m); }
  .h5-plan-name { font-size: 13px; letter-spacing: 0.08em; color: var(--ink); }
  .h5-plan-desc { margin-top: 4px; font-size: 11.5px; color: var(--faint); }
  .h5-plan-price { display: flex; align-items: baseline; gap: 4px; margin-top: 20px; }
  .h5-plan-price .cur { font-size: 15px; color: var(--ink); }
  .h5-plan-price .num { font-family: var(--serif); font-size: 40px; font-weight: 600; line-height: 1; letter-spacing: -0.01em; }
  .h5-plan-price .unit { font-size: 11.5px; color: var(--faint); margin-left: 2px; }
  .h5-plan-cta {
    display: inline-flex; align-items: center; justify-content: center;
    width: 100%; height: 38px; margin-top: 20px; border-radius: 9px; cursor: pointer;
    border: 1px solid var(--line-2); background: transparent; color: var(--ink); text-decoration: none;
    font-size: 12.5px; letter-spacing: 0.04em; transition: background 0.2s ease, border-color 0.2s ease;
  }
  .h5-plan-cta:hover { background: rgba(30, 29, 26, 0.05); border-color: var(--ink); }
  .h5-plan-feats { list-style: none; margin: 20px 0 0; padding: 18px 0 0; border-top: 1px solid var(--line); display: grid; gap: 9px; }
  .h5-plan-feats li { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; line-height: 1.6; color: var(--muted); }
  .h5-plan-feats li::before { content: '✓'; color: var(--jade); font-weight: 700; line-height: 1.5; font-size: 11px; }
  .h5-plan-feats li.off { color: var(--faint); }
  .h5-plan-feats li.off::before { content: '—'; color: var(--faint); font-weight: 400; }
  .h5-plan.is-featured { background: #1f1e1c; border-color: #1f1e1c; color: #f7f4ec; box-shadow: 0 20px 48px rgba(31, 30, 28, 0.22); }
  .h5-plan.is-featured .h5-plan-name { color: #f7f4ec; }
  .h5-plan.is-featured .h5-plan-desc { color: rgba(247, 244, 236, 0.55); }
  .h5-plan.is-featured .h5-plan-price .cur,
  .h5-plan.is-featured .h5-plan-price .num { color: #f7f4ec; }
  .h5-plan.is-featured .h5-plan-price .unit { color: rgba(247, 244, 236, 0.55); }
  .h5-plan.is-featured .h5-plan-cta { background: #f7f4ec; border-color: #f7f4ec; color: #1f1e1c; }
  .h5-plan.is-featured .h5-plan-cta:hover { background: #fffdf8; }
  .h5-plan.is-featured .h5-plan-feats { border-top-color: rgba(247, 244, 236, 0.16); }
  .h5-plan.is-featured .h5-plan-feats li { color: rgba(247, 244, 236, 0.72); }
  .h5-plan.is-featured .h5-plan-feats li::before { color: rgba(120, 220, 200, 0.85); }
  .h5-plan.is-featured .h5-plan-feats li.off { color: rgba(247, 244, 236, 0.4); }
  .h5-plan.is-featured .h5-plan-feats li.off::before { color: rgba(247, 244, 236, 0.4); }
  .h5-plan-badge {
    position: absolute; top: 18px; right: 18px;
    padding: 3px 9px; border-radius: 999px;
    font-size: 9.5px; letter-spacing: 0.1em;
    color: #1f1e1c; background: #e5d7b4;
  }
  .h5-service-note {
    display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 26px;
    margin-top: 22px; padding: 14px 20px; border-radius: 999px;
    border: 1px dashed var(--line-2); font-size: 11.5px; color: var(--muted);
  }
  .h5-service-note span { display: inline-flex; align-items: center; gap: 7px; }
  .h5-service-note i { width: 4px; height: 4px; border-radius: 50%; background: var(--jade); }
  .h5-table-wrap { margin-top: 34px; border: 1px solid var(--line-2); border-radius: 18px; overflow-x: auto; background: var(--card); }
  .h5-table { width: 100%; border-collapse: collapse; min-width: 720px; }
  .h5-table th, .h5-table td { padding: 14px 18px; text-align: center; border-bottom: 1px solid var(--line); font-size: 12.5px; font-weight: 400; color: var(--muted); }
  .h5-table thead th { font-size: 11.5px; letter-spacing: 0.08em; color: var(--faint); background: rgba(30, 29, 26, 0.025); }
  .h5-table thead th:first-child { text-align: left; }
  .h5-table tbody th { text-align: left; color: var(--ink); font-size: 12.5px; letter-spacing: 0.01em; }
  .h5-table tbody tr:last-child th, .h5-table tbody tr:last-child td { border-bottom: 0; }
  .h5-table tbody tr:hover { background: rgba(30, 29, 26, 0.015); }
  .h5-table .yes { display: inline-flex; width: 22px; height: 22px; border-radius: 50%; align-items: center; justify-content: center; background: rgba(63, 156, 140, 0.1); color: var(--jade); font-size: 11px; }
  .h5-table .no { color: rgba(30, 29, 26, 0.25); }
  .h5-table .part { font-size: 10.5px; color: var(--gold); border: 1px solid rgba(169, 133, 63, 0.3); border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
  .h5-table-hint { display: none; }
  .h5-enterprise {
    display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
    margin-top: 16px; padding: 22px 26px; border-radius: 16px;
    border: 1px solid var(--line); background: rgba(255, 253, 248, 0.66);
  }
  .h5-enterprise h3 { font-family: var(--serif); font-size: 18px; font-weight: 600; letter-spacing: 0.03em; }
  .h5-enterprise p { margin-top: 5px; font-size: 12.5px; color: var(--muted); }
  .h5-enterprise .h5-btn { margin-left: auto; }
  .h5-price-notes { margin-top: 22px; display: grid; gap: 5px; font-size: 11px; color: var(--faint); line-height: 1.7; }

  /* ---------- faq ---------- */
  .h5-faq { padding: 8px 0 104px; }
  .h5-faq-list { max-width: 800px; margin: 36px auto 0; border-top: 1px solid var(--line-2); }
  .h5-faq-item { border-bottom: 1px solid var(--line-2); }
  .h5-faq-item summary {
    display: flex; align-items: center; gap: 16px;
    padding: 20px 2px; cursor: pointer; list-style: none;
    font-size: 14.5px; color: var(--ink); letter-spacing: 0.01em;
  }
  .h5-faq-item summary::-webkit-details-marker { display: none; }
  .h5-faq-item summary::after {
    content: '+'; margin-left: auto; font-size: 18px; font-weight: 300; color: var(--faint);
    transition: transform 0.25s ease;
  }
  .h5-faq-item[open] summary::after { transform: rotate(45deg); }
  .h5-faq-a { padding: 0 2px 22px; font-size: 13px; line-height: 1.95; color: var(--muted); max-width: 700px; }

  /* ---------- footer ---------- */
  .h5-foot { background: #1f1e1c; color: rgba(247, 244, 236, 0.78); padding: 64px 0 34px; }
  .h5-foot-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 0.7fr)); gap: 40px; }
  .h5-foot-brand { display: flex; align-items: center; gap: 10px; }
  .h5-foot-brand svg { width: 30px; height: 30px; border-radius: 7px; }
  .h5-foot-brand b { font-size: 15px; font-weight: 600; letter-spacing: 0.14em; color: #f7f4ec; }
  .h5-foot-tag { margin-top: 16px; max-width: 300px; font-size: 12.5px; line-height: 1.9; color: rgba(247, 244, 236, 0.5); }
  .h5-foot-col h4 { margin: 0 0 14px; font-size: 11px; font-weight: 400; letter-spacing: 0.18em; color: rgba(247, 244, 236, 0.42); }
  .h5-foot-col a { display: block; padding: 5px 0; font-size: 12.5px; color: rgba(247, 244, 236, 0.76); transition: color 0.2s ease; }
  .h5-foot-col a:hover { color: #f7f4ec; }
  .h5-foot-bottom {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
    margin-top: 52px; padding-top: 22px; border-top: 1px solid rgba(247, 244, 236, 0.12);
    font-size: 10.5px; letter-spacing: 0.03em; color: rgba(247, 244, 236, 0.4);
  }

  /* ---------- reveal + parallax ---------- */
  .h5-reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.75s cubic-bezier(0.2, 0.7, 0.2, 1), transform 0.75s cubic-bezier(0.2, 0.7, 0.2, 1); }
  .h5-reveal.from-left { transform: translateX(-26px); }
  .h5-reveal.from-right { transform: translateX(26px); }
  .h5-reveal.from-scale { transform: scale(0.96); }
  .h5-reveal.is-in { opacity: 1; transform: none; }
  .h5-reveal.d1 { transition-delay: 0.08s; }
  .h5-reveal.d2 { transition-delay: 0.16s; }
  .h5-reveal.d3 { transition-delay: 0.24s; }
  [data-parallax], [data-drift] { transform: translate3d(0, var(--py, 0px), 0); }

  /* ---------- responsive ---------- */
  @media (max-width: 1180px) {
    .h5-hero-mascot { position: relative; right: auto; top: auto; width: 128px; margin: 0 auto 18px; z-index: 2; }
    .h5-mascot-say { display: none; }
    .h5-float { display: none; }
    .h5-hero h1 { margin-top: 18px; }
  }
  @media (max-width: 1080px) {
    .h5-work-grid { grid-template-columns: 1fr; }
    .h5-side { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .h5-price-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .h5-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .h5-persona-panel { grid-template-columns: 1fr; }
    .h5-flow-detail { grid-template-columns: 1fr; }
    .h5-agent-grid { grid-template-columns: 1fr; gap: 20px; }
    .h5-agent-stage { min-height: 380px; }
    .h5-foot-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 1024px) {
    .h5-nav-dl { display: none; }
    .h5-links { gap: 18px; }
    .h5-nav-right { gap: 14px; }
    .h5-nav-in { gap: 20px; }
  }
  @media (max-width: 900px) {
    .h5-links { gap: 14px; font-size: 12px; }
    .h5-nav-in { gap: 14px; }
    .h5-nav-right { gap: 10px; }
    .h5-nav .h5-btn { height: 34px; padding: 0 14px; font-size: 12px; }
  }
  @media (max-width: 820px) {
    .h5-links { display: none; }
    .h5-burger { display: flex; }
    .h5-nav-lang { display: none; }
    .h5-menu {
      display: block; position: absolute; top: 100%; left: 0; right: 0;
      padding: 6px 20px 24px;
      background: rgba(247, 244, 236, 0.98);
      -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
      border-bottom: 1px solid var(--line);
      box-shadow: 0 26px 44px -30px rgba(30, 29, 26, 0.45);
      opacity: 0; visibility: hidden; transform: translateY(-10px);
      transition: opacity 0.24s ease, transform 0.24s ease, visibility 0.24s;
    }
    .h5-nav.is-menu .h5-menu { opacity: 1; visibility: visible; transform: none; }
    .h5-menu a.h5-menu-link {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 2px; font-size: 15px; color: var(--ink);
      border-bottom: 1px solid var(--line);
    }
    .h5-menu a.h5-menu-link::after { content: '→'; font-size: 13px; color: var(--faint); }
    .h5-menu-foot { display: flex; align-items: center; gap: 16px; margin-top: 18px; }
    .h5-menu-foot .h5-btn { flex: 1; height: 44px; }
    .h5-menu-dl { font-size: 13.5px; color: var(--muted); white-space: nowrap; }
    .h5-flow { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 22px; }
    .h5-flow-line { display: none; }
    .h5-table-hint { display: block; margin: 28px 2px 0; text-align: right; font-size: 11px; color: var(--faint); letter-spacing: 0.02em; }
    .h5-table-wrap { margin-top: 10px; }
    .h5-table thead th:first-child, .h5-table tbody th {
      position: sticky; left: 0; z-index: 2;
      background: var(--card);
      box-shadow: 10px 0 14px -12px rgba(30, 29, 26, 0.35);
    }
    .h5-table thead th:first-child { background: #f6f2e9; }
  }
  @media (max-width: 700px) {
    .lg-home .h5-wrap { padding: 0 20px; }
    .h5-nav-in { padding: 0 20px; height: 60px; gap: 14px; }
    .h5-nav-dl, .h5-nav-login { display: none; }
    .h5-hero { padding: 40px 0 22px; }
    .h5-hero h1 { font-size: clamp(38px, 11vw, 56px); line-height: 1.12; }
    .h5-lede { margin-top: 20px; font-size: 14px; line-height: 1.95; }
    .h5-cta { margin-top: 26px; }
    .h5-cta .h5-btn { height: 44px; padding: 0 22px; font-size: 14px; }
    .h5-meta { flex-direction: column; align-items: center; gap: 6px; font-size: 11px; margin-top: 22px; }
    .h5-meta i { display: none; }
    .h5-scroll-cue { display: none; }
    .h5-peek { width: 64px; top: -40px; right: 20px; }
    .h5-stage { min-height: 390px; padding: 18px 16px 48px; }
    .h5-scene { inset: 18px 16px 48px; }
    .h5-a { padding: 13px 14px; font-size: 12px; }
    .h5-q { font-size: 12.5px; max-width: 92%; }
    .h5-scene-bars { left: 16px; bottom: 20px; }
    .h5-stage-note { display: none; }
    .h5-side { grid-template-columns: 1fr; }
    .h5-stats { padding-top: 44px; }
    .h5-stats-grid { gap: 16px; }
    .h5-marquee { margin-top: 38px; }
    .h5-personas { margin-top: 64px; padding: 68px 0; }
    .h5-h2 { font-size: clamp(28px, 8vw, 40px); }
    .h5-persona-tabs { display: flex; flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; max-width: 100%; }
    .h5-persona-tab { flex-shrink: 0; padding: 0 18px; }
    .h5-persona-q, .h5-persona-a { padding: 24px 22px; }
    .h5-flow-section { padding: 72px 0 60px; }
    .h5-flow { margin-top: 30px; }
    .h5-flow-detail { margin-top: 18px; }
    .h5-flow-copy, .h5-flow-visual { border-radius: 16px; }
    .h5-flow-visual { min-height: 270px; }
    .h5-agent { padding: 72px 0 64px; }
    .h5-agent-stage { min-height: 330px; }
    .h5-agent-ring.r3 { display: none; }
    .h5-orbit { font-size: 9.5px; }
    .h5-feed li { grid-template-columns: 48px 1fr; gap: 10px; }
    .h5-feed em { grid-column: 2; justify-self: start; }
    .h5-pricing { padding: 76px 0 64px; }
    .h5-price-grid { grid-template-columns: 1fr; }
    .h5-plan.is-featured { order: -1; }
    .h5-service-note { border-radius: 16px; justify-content: flex-start; }
    .h5-table-hint { margin-top: 24px; }
    .h5-table-wrap { border-radius: 14px; }
    .h5-table th, .h5-table td { padding: 12px 14px; }
    .h5-enterprise { align-items: flex-start; }
    .h5-enterprise .h5-btn { margin-left: 0; width: 100%; }
    .h5-faq { padding-bottom: 72px; }
    .h5-faq-item summary { font-size: 13.5px; padding: 17px 2px; }
    .h5-foot { padding-top: 48px; }
    .h5-foot-grid { grid-template-columns: 1fr 1fr; gap: 28px; }
    .h5-foot-intro { grid-column: 1 / -1; }
    .h5-foot-tag { grid-column: 1 / -1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lg-home *, .lg-home *::before, .lg-home *::after { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }
    .h5-reveal { opacity: 1; transform: none; }
    .h5-work-stage { transform: none !important; }
  }
`;
