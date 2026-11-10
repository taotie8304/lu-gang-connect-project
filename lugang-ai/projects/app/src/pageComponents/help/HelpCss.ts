// 鲁港通 - 帮助中心样式（独立作用域 .lg-help，避免影响聊天与账号页）
export const HELP_CSS = `
.lg-help{
  --ink:#1b2a34;--ink-2:#41545f;--muted:#7f909b;--line:#e2edf3;--line-2:#eef5f9;
  --bg:#f6fafc;--card:#ffffff;--blue:#2f7fb8;--blue-ink:#1f5c87;
  --blue-soft:#eaf4fb;--blue-soft-2:#f3f9fd;--amber-bg:#fdf7ee;--amber-line:#f0e0c4;--amber-ink:#7a5a22;
  --shadow:0 1px 2px rgba(22,68,92,.04),0 14px 36px rgba(22,68,92,.06);
  height:100%;overflow-y:auto;overflow-x:hidden;background:var(--bg);color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif;
  -webkit-font-smoothing:antialiased;scroll-behavior:smooth;
}
.lg-help *{box-sizing:border-box}
.lg-help h1,.lg-help h2,.lg-help h3,.lg-help h4,.lg-help p,.lg-help ul,.lg-help ol{margin:0}
.lg-help a{color:inherit;text-decoration:none}
.lg-help button{font:inherit;cursor:pointer;border:0;background:none;color:inherit;padding:0}
.lg-help input{font:inherit}
.lg-help summary{list-style:none}
.lg-help summary::-webkit-details-marker{display:none}
.lg-help a:focus-visible,.lg-help button:focus-visible,.lg-help input:focus-visible,.lg-help summary:focus-visible,.lg-help [tabindex]:focus-visible{outline:2px solid #58a9d8;outline-offset:2px}
.lg-help .hp-wrap{width:min(1120px,calc(100% - 48px));margin:0 auto}

/* header */
.lg-help .hp-header{position:sticky;top:0;z-index:60;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.lg-help .hp-header .hp-wrap{display:flex;align-items:center;justify-content:space-between;height:66px;gap:20px}
.lg-help .hp-brand{display:flex;align-items:center;gap:10px;min-width:0}
.lg-help .hp-brand-text{display:flex;flex-direction:column;line-height:1.15;min-width:0}
.lg-help .hp-brand-name{font-size:15.5px;font-weight:700;letter-spacing:.02em;white-space:nowrap}
.lg-help .hp-brand-sub{font-size:10.5px;color:var(--muted);letter-spacing:.16em;margin-top:3px;white-space:nowrap}
.lg-help .hp-header-nav{display:flex;align-items:center;gap:22px;font-size:13.5px;color:var(--ink-2)}
.lg-help .hp-header-nav a{padding:6px 2px;transition:.16s}
.lg-help .hp-header-nav a:hover{color:var(--blue-ink)}
.lg-help .hp-header-actions{display:flex;align-items:center;gap:10px;flex:0 0 auto}
.lg-help .hp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:500;transition:.18s;white-space:nowrap}
.lg-help .hp-btn-primary{background:var(--blue);color:#fff;box-shadow:0 7px 16px rgba(47,127,184,.2)}
.lg-help .hp-btn-primary:hover{background:#276fa3;color:#fff}
.lg-help .hp-btn-ghost{background:#fff;border:1px solid var(--line);color:var(--ink-2)}
.lg-help .hp-btn-ghost:hover{border-color:#c9e0ec;background:#f7fbfd;color:var(--blue-ink)}
.lg-help .hp-btn-sm{height:32px;padding:0 12px;font-size:12.5px}

/* language notice */
.lg-help .hp-lang-notice{background:#eef7fc;border-bottom:1px solid #d9ebf5;color:#35657f;font-size:12.5px;line-height:1.7;padding:9px 24px;text-align:center}
.lg-help .hp-missing-notice{max-width:900px;margin:20px auto 0;background:#fdf7ee;border:1px solid var(--amber-line);color:var(--amber-ink);border-radius:12px;padding:12px 16px;font-size:13px;line-height:1.7}

/* hero */
.lg-help .hp-hero{padding:64px 0 30px;text-align:center;background:radial-gradient(900px 340px at 50% -32%,#def1fb 0%,rgba(255,255,255,0) 72%)}
.lg-help .hp-hero-eyebrow{display:inline-flex;align-items:center;gap:7px;background:#eaf5fc;color:#2a6f9e;border:1px solid #d6ebf6;border-radius:999px;padding:6px 13px;font-size:12px;letter-spacing:.02em}
.lg-help .hp-hero h1{font-size:46px;line-height:1.18;letter-spacing:-.03em;margin-top:18px;font-weight:700}
.lg-help .hp-hero-sub{max-width:620px;margin:14px auto 0;color:var(--ink-2);font-size:15px;line-height:1.8}
.lg-help .hp-search{position:relative;max-width:640px;margin:28px auto 0;text-align:left}
.lg-help .hp-search input{width:100%;height:54px;border-radius:15px;border:1px solid #cfe3ef;background:#fff;padding:0 18px 0 46px;font-size:14.5px;color:var(--ink);outline:none;box-shadow:var(--shadow);transition:.18s}
.lg-help .hp-search input::placeholder{color:#9aabb5}
.lg-help .hp-search input:focus{border-color:#9ecde8;box-shadow:0 0 0 3px rgba(88,169,216,.14),0 14px 34px rgba(22,68,92,.07)}
.lg-help .hp-search-icon{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:#8faebf;pointer-events:none}
.lg-help .hp-search-results{position:absolute;top:62px;left:0;right:0;background:#fff;border:1px solid var(--line);border-radius:15px;box-shadow:0 20px 48px rgba(22,68,92,.14);overflow:hidden;z-index:65}
.lg-help .hp-result-item{display:flex;flex-direction:column;gap:3px;width:100%;text-align:left;padding:12px 16px;border-bottom:1px solid var(--line-2);transition:.15s}
.lg-help .hp-result-item:last-child{border-bottom:0}
.lg-help .hp-result-item:hover,.lg-help .hp-result-item:focus-visible{background:var(--blue-soft-2)}
.lg-help .hp-result-cat{font-size:11px;color:var(--blue);letter-spacing:.04em}
.lg-help .hp-result-title{font-size:13.5px;font-weight:600;color:var(--ink)}
.lg-help .hp-result-sum{font-size:12px;color:var(--muted);line-height:1.6}
.lg-help .hp-result-empty{padding:18px 16px;font-size:13px;color:var(--ink-2);line-height:1.8}
.lg-help .hp-result-empty span{color:var(--muted);font-size:12px}
.lg-help .hp-hot-chips{display:flex;justify-content:center;align-items:center;gap:7px;flex-wrap:wrap;margin-top:16px;font-size:12px;color:var(--muted)}
.lg-help .hp-chip{background:#fff;border:1px solid var(--line);border-radius:999px;padding:5px 11px;font-size:12px;color:var(--ink-2);transition:.16s}
.lg-help .hp-chip:hover{border-color:#c3e0ef;background:var(--blue-soft-2);color:var(--blue-ink)}

/* quick cards */
.lg-help .hp-quick{padding:20px 0 8px}
.lg-help .hp-quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.lg-help .hp-quick-card{display:flex;align-items:flex-start;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:var(--shadow);transition:.18s}
.lg-help .hp-quick-card:hover{transform:translateY(-2px);border-color:#c9e3f1;box-shadow:0 18px 42px rgba(22,68,92,.09)}
.lg-help .hp-quick-no{font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--blue);background:var(--blue-soft);border-radius:8px;padding:5px 8px;flex:0 0 auto;margin-top:2px}
.lg-help .hp-quick-card h3{font-size:15px;font-weight:600}
.lg-help .hp-quick-card p{font-size:12.5px;color:var(--muted);margin-top:5px;line-height:1.6}
.lg-help .hp-quick-arrow{margin-left:auto;color:#a8c2d1;font-size:16px;align-self:center;transition:.18s}
.lg-help .hp-quick-card:hover .hp-quick-arrow{color:var(--blue);transform:translateX(2px)}

/* sections */
.lg-help .hp-section{padding:38px 0}
.lg-help .hp-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:20px}
.lg-help .hp-section-head h2{font-size:24px;letter-spacing:-.02em}
.lg-help .hp-section-head p{font-size:13px;color:var(--muted);margin-top:6px}
.lg-help .hp-section-note{font-size:11.5px;color:#93a7b2;letter-spacing:.12em;white-space:nowrap}
.lg-help .hp-cat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.lg-help .hp-cat-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;scroll-margin-top:90px}
.lg-help .hp-cat-head{display:flex;align-items:center;gap:10px}
.lg-help .hp-cat-icon{width:34px;height:34px;border-radius:10px;background:var(--blue-soft);color:var(--blue-ink);display:grid;place-items:center;flex:0 0 auto}
.lg-help .hp-cat-title{font-size:14.5px;font-weight:600}
.lg-help .hp-cat-count{margin-left:auto;font-size:11.5px;color:var(--muted);white-space:nowrap}
.lg-help .hp-cat-links{margin-top:14px;display:flex;flex-direction:column;gap:1px}
.lg-help .hp-cat-link{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px;margin:0 -8px;border-radius:9px;font-size:13px;color:var(--ink-2);text-align:left;transition:.15s}
.lg-help .hp-cat-link:hover{background:var(--blue-soft-2);color:var(--blue-ink)}
.lg-help .hp-cat-link .hp-arrow{opacity:.38;font-size:12px}
.lg-help .hp-cat-link:hover .hp-arrow{opacity:.8}

/* popular faq */
.lg-help .hp-popular{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;max-width:900px}
.lg-help .hp-faq{border-bottom:1px solid var(--line-2)}
.lg-help .hp-faq:last-child{border-bottom:0}
.lg-help .hp-faq summary{cursor:pointer;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;font-size:14px;font-weight:500;color:var(--ink)}
.lg-help .hp-faq summary::after{content:"+";color:#93b3c6;font-size:18px;font-weight:400;line-height:1;flex:0 0 auto;transition:transform .18s}
.lg-help .hp-faq[open] summary::after{transform:rotate(45deg)}
.lg-help .hp-faq-a{padding:0 20px 18px;font-size:13.5px;line-height:1.85;color:var(--ink-2);max-width:780px}

/* legal / contact bands */
.lg-help .hp-legal-band{background:linear-gradient(180deg,#f2f9fd 0%,#ffffff 100%);border:1px solid #dcebf3;border-radius:18px;padding:24px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.lg-help .hp-legal-band h2{font-size:19px;letter-spacing:-.01em}
.lg-help .hp-legal-band p{font-size:12.5px;color:var(--muted);line-height:1.75;margin-top:7px;max-width:520px}
.lg-help .hp-legal-chips{display:flex;flex-wrap:wrap;gap:8px;max-width:560px;justify-content:flex-end}
.lg-help .hp-legal-chip{background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 12px;font-size:12px;color:var(--ink-2);transition:.16s}
.lg-help .hp-legal-chip:hover{border-color:#bfddec;color:var(--blue-ink);background:var(--blue-soft-2)}
.lg-help .hp-legal-chip.is-new{background:#eaf6fc;border-color:#c6e4f4;color:#1f5f8c;font-weight:500}
.lg-help .hp-contact-band{background:#eef7fc;border:1px solid #d9ebf5;border-radius:18px;padding:26px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.lg-help .hp-contact-band h3{font-size:18px;letter-spacing:-.01em}
.lg-help .hp-contact-band p{font-size:12.5px;color:#5e7c8b;margin-top:6px}
.lg-help .hp-contact-actions{display:flex;gap:10px;flex-wrap:wrap}
.lg-help .hp-footer{border-top:1px solid var(--line);margin-top:26px;padding:28px 0 46px;color:var(--muted);font-size:12px}
.lg-help .hp-footer .hp-wrap{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;line-height:1.8}

/* article */
.lg-help .hp-breadcrumb{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);padding:26px 0 0;flex-wrap:wrap}
.lg-help .hp-breadcrumb a{color:var(--muted)}
.lg-help .hp-breadcrumb a:hover{color:var(--blue-ink)}
.lg-help .hp-article-layout{display:grid;grid-template-columns:220px minmax(0,760px);gap:48px;justify-content:center;padding:24px 0 56px;align-items:start}
.lg-help .hp-toc{position:sticky;top:96px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}
.lg-help .hp-toc-title{font-size:11px;letter-spacing:.14em;color:var(--muted);margin-bottom:8px}
.lg-help .hp-toc a{display:block;padding:7px 8px;border-radius:8px;font-size:12.5px;color:var(--ink-2);line-height:1.5}
.lg-help .hp-toc a:hover{background:var(--blue-soft-2);color:var(--blue-ink)}
.lg-help .hp-article{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:36px 42px 40px;box-shadow:var(--shadow);min-width:0}
.lg-help .hp-article-tag{display:inline-flex;background:var(--blue-soft);color:var(--blue-ink);border-radius:999px;padding:4px 10px;font-size:11.5px;letter-spacing:.04em}
.lg-help .hp-article h1{font-size:34px;line-height:1.28;letter-spacing:-.03em;margin:14px 0 10px}
.lg-help .hp-article-meta{display:flex;gap:14px;color:var(--muted);font-size:12px;flex-wrap:wrap}
.lg-help .hp-article-lead{background:#f5fafd;border:1px solid #e1eef6;border-radius:13px;padding:16px 18px;margin:24px 0 4px}
.lg-help .hp-article-lead strong{font-size:13px;color:var(--blue-ink);letter-spacing:.02em}
.lg-help .hp-article-lead ul{margin-top:8px;padding-left:20px}
.lg-help .hp-article-lead li{font-size:13px;line-height:1.8;color:var(--ink-2);margin:4px 0}
.lg-help .hp-article h2{font-size:21px;line-height:1.4;letter-spacing:-.01em;margin:36px 0 12px;scroll-margin-top:88px}
.lg-help .hp-article h3{font-size:16px;margin:24px 0 8px;color:var(--ink)}
.lg-help .hp-article p{font-size:14.5px;line-height:1.92;color:var(--ink-2);margin:12px 0}
.lg-help .hp-article ol,.lg-help .hp-article ul{padding-left:22px;margin:12px 0}
.lg-help .hp-article li{font-size:14.5px;line-height:1.9;color:var(--ink-2);margin:5px 0}
.lg-help .hp-article ol li::marker{color:#58a9d8;font-weight:600}
.lg-help .hp-article strong{color:var(--ink);font-weight:600}
.lg-help .hp-article a{color:var(--blue);text-decoration:underline;text-underline-offset:3px}
.lg-help .hp-callout{border-radius:12px;padding:14px 16px;margin:18px 0;font-size:13.5px;line-height:1.82}
.lg-help .hp-callout strong{display:inline-block;margin-right:4px}
.lg-help .hp-callout.tip{background:#f0f8fd;border:1px solid #d6eaf6;color:#275a78}
.lg-help .hp-callout.official{background:#f8f8f3;border:1px solid #e7e5d7;color:#5d5a45}
.lg-help .hp-callout.note{background:var(--amber-bg);border:1px solid var(--amber-line);color:var(--amber-ink)}
.lg-help .hp-compare{margin:16px 0;display:flex;flex-direction:column;gap:8px}
.lg-help .hp-compare-row{display:flex;gap:10px;align-items:flex-start;border-radius:11px;padding:12px 14px;font-size:13.5px;line-height:1.8}
.lg-help .hp-compare-row.bad{background:#f8fafb;border:1px solid var(--line)}
.lg-help .hp-compare-row.good{background:#f1f9fd;border:1px solid #d8ecf6}
.lg-help .hp-compare-label{flex:0 0 auto;font-size:11px;font-weight:600;border-radius:999px;padding:3px 8px;margin-top:2px}
.lg-help .hp-compare-row.bad .hp-compare-label{background:#eef2f4;color:#7b8d97}
.lg-help .hp-compare-row.good .hp-compare-label{background:#ddeff9;color:#1f5c87}
.lg-help .hp-compare-row p{font-size:13.5px;line-height:1.8;margin:0;color:var(--ink-2)}
.lg-help .hp-table-wrap{margin:18px 0}
.lg-help .hp-table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:10px}
.lg-help .hp-table-hint{display:none;font-size:11.5px;color:var(--muted);margin-bottom:6px}
.lg-help .hp-article table{width:100%;border-collapse:collapse;font-size:13px;min-width:520px}
.lg-help .hp-article th,.lg-help .hp-article td{border:1px solid var(--line);padding:9px 12px;text-align:left;line-height:1.6}
.lg-help .hp-article th{background:#f6fafc;font-weight:600;color:var(--ink)}
.lg-help .hp-article td{color:var(--ink-2)}
.lg-help .hp-qa{border-top:1px solid var(--line-2);padding:14px 0 2px}
.lg-help .hp-qa .q{font-size:14px;font-weight:600;color:var(--ink);margin:0}
.lg-help .hp-qa .a{font-size:13.5px;line-height:1.85;color:var(--ink-2);margin:6px 0 0}
.lg-help .hp-helpful{display:flex;align-items:center;gap:9px;flex-wrap:wrap;border-top:1px solid var(--line-2);margin-top:30px;padding-top:18px;font-size:12.5px;color:var(--muted)}
.lg-help .hp-helpful button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px;font-size:12px;color:var(--ink-2);transition:.16s}
.lg-help .hp-helpful button:hover{border-color:#c5e0ee;background:var(--blue-soft-2);color:var(--blue-ink)}
.lg-help .hp-helpful button.is-selected{background:var(--blue-soft);border-color:#bfddec;color:var(--blue-ink)}
.lg-help .hp-helpful-note{color:#5f8fa8}
.lg-help .hp-related{background:#f8fbfd;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-top:22px}
.lg-help .hp-related strong{display:block;font-size:12.5px;color:var(--ink);margin-bottom:8px}
.lg-help .hp-related a{display:block;font-size:13px;color:var(--ink-2);padding:5px 0;text-decoration:none}
.lg-help .hp-related a:hover{color:var(--blue-ink)}
.lg-help .hp-prev-next{display:flex;justify-content:space-between;gap:18px;margin-top:22px;font-size:12.5px;color:var(--muted);flex-wrap:wrap}
.lg-help .hp-prev-next a{color:var(--blue-ink)}
.lg-help .hp-article-contact{background:#eef7fc;border:1px solid #d9ebf5;border-radius:14px;padding:16px 18px;margin-top:22px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.lg-help .hp-article-contact strong{font-size:13.5px;color:var(--ink)}
.lg-help .hp-article-contact p{font-size:12.5px;color:#5e7c8b;margin:4px 0 0}
.lg-help .hp-mobile-toc{display:none}
.lg-help .hp-mobile-toc summary{cursor:pointer;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:13px;font-weight:500;display:flex;justify-content:space-between}
.lg-help .hp-mobile-toc summary::after{content:"+";color:#93b3c6}
.lg-help .hp-mobile-toc[open] summary::after{content:"-"}
.lg-help .hp-mobile-toc div{padding:8px 6px 0}
.lg-help .hp-mobile-toc a{display:block;padding:6px 4px;font-size:12.5px;color:var(--ink-2)}
.lg-help .hp-mobile-contact{display:none}

/* legal page */
.lg-help .hp-legal-hero{padding:34px 0 6px;max-width:760px}
.lg-help .hp-legal-hero h1{font-size:38px;letter-spacing:-.03em;margin:12px 0 10px}
.lg-help .hp-legal-hero p{font-size:14px;line-height:1.85;color:var(--ink-2);max-width:640px}
.lg-help .hp-legal-list{display:flex;flex-direction:column;gap:12px;margin:26px 0 56px;max-width:900px}
.lg-help .hp-legal-row{display:flex;align-items:center;gap:18px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;transition:.16s}
.lg-help .hp-legal-row:hover{border-color:#cfe5f1;box-shadow:0 12px 30px rgba(22,68,92,.06)}
.lg-help .hp-legal-num{font-size:11px;font-weight:700;color:#9fb6c3;letter-spacing:.08em;flex:0 0 auto}
.lg-help .hp-legal-main{min-width:0}
.lg-help .hp-legal-main h2{font-size:14.5px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0}
.lg-help .hp-legal-main p{font-size:12.5px;color:var(--muted);margin-top:5px;line-height:1.6}
.lg-help .hp-legal-meta{margin-left:auto;font-size:11.5px;color:#9aabb5;white-space:nowrap}
.lg-help .hp-badge-new{display:inline-flex;background:#eaf6fc;color:#1f5f8c;border:1px solid #c8e5f4;border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:500;letter-spacing:.02em}

/* responsive */
@media (max-width:860px){
  .lg-help .hp-quick-grid{grid-template-columns:1fr}
  .lg-help .hp-cat-grid{grid-template-columns:repeat(2,1fr)}
  .lg-help .hp-article-layout{grid-template-columns:1fr;padding:18px 0 48px;gap:0}
  .lg-help .hp-toc{display:none}
  .lg-help .hp-mobile-toc{display:block;margin:18px 0 0}
  .lg-help .hp-hero h1{font-size:36px}
  .lg-help .hp-legal-band,.lg-help .hp-contact-band{flex-direction:column;align-items:flex-start}
  .lg-help .hp-legal-chips{justify-content:flex-start}
  .lg-help .hp-header .hp-wrap{height:60px}
  .lg-help .hp-header-nav{display:none}
  .lg-help .hp-header-actions .hp-btn-ghost{display:none}
  .lg-help .hp-article{padding:26px 22px 30px}
  .lg-help .hp-table-hint{display:block}
}
@media (max-width:560px){
  .lg-help .hp-wrap{width:calc(100% - 32px)}
  .lg-help .hp-cat-grid{grid-template-columns:1fr}
  .lg-help .hp-hero{padding:42px 0 22px}
  .lg-help .hp-hero h1{font-size:30px}
  .lg-help .hp-hero-sub{font-size:14px}
  .lg-help .hp-search input{height:50px;font-size:14px}
  .lg-help .hp-search-results{top:58px}
  .lg-help .hp-section{padding:28px 0}
  .lg-help .hp-section-head{flex-direction:column;align-items:flex-start;gap:4px}
  .lg-help .hp-legal-band,.lg-help .hp-contact-band{flex-direction:column;align-items:flex-start;padding:20px}
  .lg-help .hp-legal-chips{justify-content:flex-start;max-width:none}
  .lg-help .hp-quick-card{padding:17px}
  .lg-help .hp-article{padding:24px 18px 28px;border-radius:14px}
  .lg-help .hp-article h1{font-size:24px}
  .lg-help .hp-article h2{font-size:19px}
  .lg-help .hp-article p,.lg-help .hp-article li{font-size:14px}
  .lg-help .hp-legal-hero h1{font-size:28px}
  .lg-help .hp-legal-row{flex-wrap:wrap;align-items:flex-start;gap:12px}
  .lg-help .hp-legal-meta{margin-left:0;width:100%}
  .lg-help .hp-legal-row .hp-btn{margin-left:auto}
  .lg-help .hp-breadcrumb{padding-top:18px}
  .lg-help .hp-mobile-contact{display:inline-flex;position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:50;height:40px;padding:0 18px;border-radius:999px;background:var(--blue);color:#fff;font-size:13px;font-weight:500;box-shadow:0 12px 28px rgba(47,127,184,.32);align-items:center;justify-content:center}
  .lg-help .hp-footer{padding-bottom:76px}
}
`;
