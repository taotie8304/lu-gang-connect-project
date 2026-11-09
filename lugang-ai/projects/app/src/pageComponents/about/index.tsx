// 鲁港通 - 关于页 v3（纸本 +《鹊华秋色图》，与 about-v3-preview 一致）
// 全局 body 已锁定滚动，本页自带滚动容器；进度条、导航吸顶、视差、路径与计数均由本页驱动。
import { useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { useTranslation } from 'next-i18next';
import I18nLngSelector from '@/components/Select/I18nLngSelector';
import { ABOUT_V3_CSS } from './AboutV3Css';

type AboutStat = { count?: number; suffix?: string; value?: string; unit: string; desc: string };
type AboutCapItem = { no: string; title: string; text: string; tags: string[] };
type AboutContent = {
  nav: {
    brandAria: string;
    brandName: string;
    brandSub: string;
    caps: string;
    cities: string;
    tech: string;
    cta: string;
    langAria: string;
  };
  hero: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    ledeLead: string;
    ledeStrong: string;
    ledeTail: string;
    ctaTalk: string;
    ctaExplore: string;
    meta: string[];
    painting: string;
    scroll: string;
  };
  manifesto: {
    no: string;
    titleLead: string;
    titleDim: string;
    sub: string;
    stats: AboutStat[];
  };
  caps: {
    no: string;
    title: string;
    items: AboutCapItem[];
    policy: {
      head: string;
      tag: string;
      docTitle: string;
      source: string;
      updated: string;
    };
    browser: {
      formTitle: string;
      fields: { label: string; value: string }[];
      submit: string;
    };
    route: { labels: string[] };
  };
  cities: {
    no: string;
    titleLead: string;
    titleAccent: string;
    sub: string;
    routeLeft: { name: string; sub: string };
    routeRight: { name: string; sub: string };
    cards: { dir: string; title: string; text: string; tags: string[] }[];
  };
  tech: {
    no: string;
    titleLead: string;
    titleAccent: string;
    p: string;
    chips: string[];
    bubbleLead: string;
    bubbleStrong: string;
    bubbleTail: string;
    srcLeft: string;
    srcRight: string;
  };
  proof: {
    no: string;
    titleLead: string;
    titleAccent: string;
    quote: string;
    quoteBy: string;
    rows: { label: string; value: string }[];
  };
  contact: {
    no: string;
    titleLead: string;
    titleAccent: string;
    p: string;
    cta: string;
    addrLine: string;
    addrEn: string;
    footLeft: string;
    footRight: string;
  };
};

// 鲁港通 - 品牌小圆脸（导航与「技术与信任」卡片共用同一套 defs）
const BrandFace = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <g clipPath="url(#a3FaceClip)">
      <rect width="64" height="64" fill="url(#a3FaceBg)" />
      <circle cx="32" cy="58" r="35" fill="url(#a3FaceDome)" />
    </g>
    <ellipse className="a3-eye" cx="24.5" cy="41" rx="4.4" ry="6.4" fill="#c9efff" />
    <ellipse className="a3-eye" cx="39.5" cy="40.2" rx="4.4" ry="6.4" fill="#c9efff" />
  </svg>
);

const ROUTE_PATH = 'M60 200 C 120 190, 140 120, 190 118 S 280 150, 320 92 S 360 62, 372 54';
const ROUTE_LABEL_POS = [
  { x: 46, y: 220 },
  { x: 168, y: 108 },
  { x: 326, y: 44 }
];
const COUNT_DURATION = 1200;

const formatCount = (value: number) => value.toLocaleString('en-US');

const AboutPage = () => {
  const { t } = useTranslation('about3');
  const translateSection = t as unknown as (
    key: string,
    options: { returnObjects: true }
  ) => unknown;
  const content = translateSection('content', { returnObjects: true }) as AboutContent;
  const { nav, hero, manifesto, caps, cities, tech, proof, contact } = content;

  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const heroInnerRef = useRef<HTMLDivElement>(null);
  const routeSectionRef = useRef<HTMLDivElement>(null);
  const routeFillRef = useRef<HTMLDivElement>(null);
  const routeDotRef = useRef<HTMLDivElement>(null);

  const [statCounts, setStatCounts] = useState<number[]>(() => manifesto.stats.map(() => 0));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const navEl = navRef.current;
    const progressEl = progressRef.current;
    const artEl = artRef.current;
    const heroInnerEl = heroInnerRef.current;
    const routeSectionEl = routeSectionRef.current;
    const routeFillEl = routeFillRef.current;
    const routeDotEl = routeDotRef.current;

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 鲁港通 - 数字滚动：每个 stat 只跑一次，rAF 推 React state
    const started = new Set<number>();
    const countFrames: number[] = [];
    const animateStat = (index: number, target: number) => {
      if (started.has(index)) return;
      started.add(index);
      if (reduceMotion) {
        setStatCounts((prev) => {
          const next = [...prev];
          next[index] = target;
          return next;
        });
        return;
      }
      const startTime = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - startTime) / COUNT_DURATION);
        const eased = 1 - Math.pow(1 - p, 3);
        const value = Math.round(target * eased);
        setStatCounts((prev) => {
          if (prev[index] === value) return prev;
          const next = [...prev];
          next[index] = value;
          return next;
        });
        if (p < 1) countFrames.push(window.requestAnimationFrame(tick));
      };
      countFrames.push(window.requestAnimationFrame(tick));
    };

    // 鲁港通 - 入场观察：进入视口加 .in，数字牌同时触发计数
    let observer: IntersectionObserver | undefined;
    if (!reduceMotion && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target as HTMLElement;
            el.classList.add('in');
            const statEl = el.querySelector<HTMLElement>('[data-stat-index]');
            if (statEl) {
              const index = Number(statEl.dataset.statIndex);
              const target = Number(statEl.dataset.count);
              if (Number.isInteger(index) && Number.isFinite(target)) {
                animateStat(index, target);
              }
            }
            observer?.unobserve(el);
          });
        },
        { root, threshold: 0.18, rootMargin: '0px 0px -6% 0px' }
      );
      root.querySelectorAll('.reveal').forEach((el) => observer?.observe(el));
    } else {
      root.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
      setStatCounts(
        manifesto.stats.map((stat) => (typeof stat.count === 'number' ? stat.count : 0))
      );
    }

    const render = () => {
      const sy = root.scrollTop;
      const max = root.scrollHeight - root.clientHeight;
      const progressValue = max > 0 ? Math.min(1, Math.max(0, sy / max)) : 0;
      if (progressEl) progressEl.style.transform = `scaleX(${progressValue})`;
      if (navEl) navEl.classList.toggle('is-scrolled', sy > 40);

      if (!reduceMotion) {
        if (artEl) artEl.style.transform = `translate3d(0, ${sy * 0.32}px, 0)`;
        if (heroInnerEl) {
          heroInnerEl.style.transform = `translate3d(0, ${sy * 0.1}px, 0)`;
          heroInnerEl.style.opacity = String(
            Math.max(0, 1 - sy / (root.clientHeight * 0.9))
          );
        }
      }

      if (routeSectionEl && routeFillEl && routeDotEl) {
        const rootTop = root.getBoundingClientRect().top;
        const rect = routeSectionEl.getBoundingClientRect();
        const p = Math.min(
          1,
          Math.max(
            0,
            (root.clientHeight * 0.82 - (rect.top - rootTop)) / (rect.height * 0.86)
          )
        );
        routeFillEl.style.width = `${p * 100}%`;
        routeDotEl.style.left = `${p * 100}%`;
      }
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        render();
      });
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    render();
    const timer = window.setTimeout(onScroll, 60);

    return () => {
      window.clearTimeout(timer);
      if (raf) window.cancelAnimationFrame(raf);
      countFrames.forEach((frame) => window.cancelAnimationFrame(frame));
      observer?.disconnect();
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // 仅在挂载时绑定一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lg-a3" ref={rootRef}>
      <style>{ABOUT_V3_CSS}</style>

      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <clipPath id="a3FaceClip">
            <rect width="64" height="64" rx="15" />
          </clipPath>
          <linearGradient id="a3FaceBg" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#1e7bff" />
            <stop offset="1" stopColor="#38a7ff" />
          </linearGradient>
          <radialGradient id="a3FaceDome" cx="50%" cy="38%" r="66%">
            <stop stopColor="#ffffff" />
            <stop offset=".55" stopColor="#e7f7ff" />
            <stop offset="1" stopColor="#c3ecff" />
          </radialGradient>
        </defs>
      </svg>

      <div className="progress" ref={progressRef} />

      <header className="nav" ref={navRef}>
        <a className="brand" href="#a3Top" aria-label={nav.brandAria}>
          <BrandFace />
          <span>
            <b>{nav.brandName}</b>
            <small>{nav.brandSub}</small>
          </span>
        </a>
        <div className="nav-right">
          <nav className="links">
            <a href="#a3Caps">{nav.caps}</a>
            <a href="#a3Cities">{nav.cities}</a>
            <a href="#a3Tech">{nav.tech}</a>
            <a href="#a3Contact" className="cta">
              {nav.cta}
            </a>
          </nav>
          <div className="lang" aria-label={nav.langAria}>
            <I18nLngSelector />
          </div>
        </div>
      </header>

      <section className="hero" id="a3Top">
        <div className="hero-art" ref={artRef} />
        <div className="hero-shade" />
        <div className="hero-noise" />
        <div className="hero-inner" ref={heroInnerRef}>
          <div className="eyebrow">{hero.eyebrow}</div>
          <h1>
            {hero.titleLead}
            <br />
            <em>{hero.titleAccent}</em>
          </h1>
          <p className="lede">
            {hero.ledeLead}
            <strong>{hero.ledeStrong}</strong>
            {hero.ledeTail}
          </p>
          <div className="hero-actions">
            <a className="btn dark" href="#a3Contact">
              {hero.ctaTalk} <span>→</span>
            </a>
            <a className="btn ghost" href="#a3Caps">
              {hero.ctaExplore}
            </a>
          </div>
          <div className="hero-meta">
            {hero.meta.map((item) => (
              <span key={item}>
                <i />
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="painting-note">{hero.painting}</div>
        <div className="scroll-cue">
          <span />
          {hero.scroll}
        </div>
      </section>

      <section className="manifesto">
        <div className="wrap">
          <div className="section-no reveal">{manifesto.no}</div>
          <h2 className="statement reveal">
            {manifesto.titleLead}
            <br />
            <span className="dim">{manifesto.titleDim}</span>
          </h2>
          <p className="statement-sub reveal d1">{manifesto.sub}</p>
          <div className="stats">
            {manifesto.stats.map((stat, index) => (
              <div
                className={`stat reveal${index === 1 ? ' d1' : index === 2 ? ' d2' : ''}`}
                key={index}
              >
                <b>
                  {typeof stat.count === 'number' ? (
                    <>
                      <span
                        data-stat-index={index}
                        data-count={stat.count}
                      >
                        {formatCount(statCounts[index] ?? 0)}
                      </span>
                      {stat.suffix}
                      <small>{stat.unit}</small>
                    </>
                  ) : (
                    <>
                      {stat.value}
                      <small>{stat.unit}</small>
                    </>
                  )}
                </b>
                <span>{stat.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="capabilities" id="a3Caps">
        <div className="wrap">
          <div className="section-no reveal">{caps.no}</div>
          <h2 className="reveal">{caps.title}</h2>
          <div className="cap-list">
            {caps.items.map((item, index) => (
              <article className="cap reveal" key={item.no}>
                <div className="cap-main">
                  <span className="cap-no">{item.no}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <ul>
                      {item.tags.map((tag) => (
                        <li key={tag}>{tag}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {index === 0 && (
                  <div className="cap-visual v-policy">
                    <div className="doc back-2" />
                    <div className="doc back-1" />
                    <div className="doc">
                      <div className="doc-head">
                        <span>{caps.policy.head}</span>
                        <span className="doc-tag">{caps.policy.tag}</span>
                      </div>
                      <h4>{caps.policy.docTitle}</h4>
                      <div className="doc-line w90" />
                      <div className="doc-line w80" />
                      <div className="doc-line w62" />
                      <div className="doc-line hl" />
                      <div className="doc-cite">
                        <b>{caps.policy.source}</b>
                        <span>{caps.policy.updated}</span>
                      </div>
                    </div>
                  </div>
                )}

                {index === 1 && (
                  <div className="cap-visual v-browser">
                    <div className="browser">
                      <div className="browser-bar">
                        <i />
                        <i />
                        <i />
                        <div className="browser-url" />
                      </div>
                      <div className="browser-body">
                        <div className="form-title">{caps.browser.formTitle}</div>
                        {caps.browser.fields.map((field) => (
                          <div className="field" key={field.label}>
                            <label>{field.label}</label>
                            <div className="input">{field.value}</div>
                          </div>
                        ))}
                        <div className="browser-submit">{caps.browser.submit}</div>
                      </div>
                    </div>
                    <div className="browser-cursor" />
                  </div>
                )}

                {index === 2 && (
                  <div className="cap-visual v-route">
                    <svg
                      className="route-svg"
                      viewBox="0 0 420 260"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <path className="rail" d={ROUTE_PATH} />
                      <path className="rail-live" d={ROUTE_PATH} />
                      <circle className="node" cx="60" cy="200" r="5" />
                      <circle className="node" cx="190" cy="118" r="4" />
                      <circle className="node on" cx="372" cy="54" r="5" />
                      {caps.route.labels.map((label, labelIndex) => (
                        <text
                          key={label}
                          x={ROUTE_LABEL_POS[labelIndex]?.x}
                          y={ROUTE_LABEL_POS[labelIndex]?.y}
                        >
                          {label}
                        </text>
                      ))}
                      <g className="pin">
                        <circle cx="60" cy="200" r="4" fill="#1e7bff" />
                        <circle
                          cx="60"
                          cy="200"
                          r="8"
                          fill="none"
                          stroke="#1e7bff"
                          strokeOpacity=".35"
                        />
                      </g>
                    </svg>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="twocities" id="a3Cities">
        <div className="mountains" aria-hidden="true">
          <svg viewBox="0 0 1200 300" preserveAspectRatio="none">
            <path
              d="M0 300 L140 176 L226 232 L330 128 L430 214 L520 150 L640 246 L760 168 L860 226 L980 140 L1090 220 L1200 172 L1200 300 Z"
              fill="#1e1d1a"
            />
            <path
              d="M0 300 L120 224 L250 268 L380 196 L520 262 L660 206 L820 270 L980 208 L1120 264 L1200 232 L1200 300 Z"
              fill="#3b3933"
              opacity=".7"
            />
          </svg>
        </div>
        <div className="wrap">
          <div className="section-no reveal">{cities.no}</div>
          <h2 className="reveal">
            {cities.titleLead}
            <br />
            {cities.titleAccent}
          </h2>
          <p className="sub reveal d1">{cities.sub}</p>
          <div className="route" ref={routeSectionRef}>
            <div className="route-line">
              <div className="route-fill" ref={routeFillRef} />
              <div className="route-dot" ref={routeDotRef} />
            </div>
            <div className="route-labels">
              <span>
                {cities.routeLeft.name}
                <small>{cities.routeLeft.sub}</small>
              </span>
              <span>
                {cities.routeRight.name}
                <small>{cities.routeRight.sub}</small>
              </span>
            </div>
            <div className="route-cards">
              {cities.cards.map((card, index) => (
                <article className={`rcard reveal${index === 1 ? ' d1' : ''}`} key={index}>
                  <div className="dir">{card.dir}</div>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                  <div className="tags">
                    {card.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="tech" id="a3Tech">
        <div className="wrap tech-inner">
          <div className="tech-copy">
            <div className="section-no light reveal">{tech.no}</div>
            <h2 className="reveal">
              {tech.titleLead}
              <br />
              {tech.titleAccent}
            </h2>
            <p className="reveal d1">{tech.p}</p>
            <div className="source-chips reveal d2">
              {tech.chips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          </div>
          <div className="mascot-card reveal d1">
            <div className="mascot-stage">
              <div className="mascot-halo" />
              <span className="qmark q1">?</span>
              <span className="qmark q2">?</span>
              <span className="qmark q3">?</span>
              <div className="mascot">
                <BrandFace />
              </div>
            </div>
            <div className="mascot-bubble">
              {tech.bubbleLead}
              <b>{tech.bubbleStrong}</b>
              {tech.bubbleTail}
            </div>
            <div className="mascot-src">
              <span>{tech.srcLeft}</span>
              <span>{tech.srcRight}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="proof">
        <div className="wrap">
          <div className="section-no reveal">{proof.no}</div>
          <h2 className="reveal">
            {proof.titleLead}
            <br />
            {proof.titleAccent}
          </h2>
          <div className="proof-grid">
            <div className="reveal">
              <blockquote>{proof.quote}</blockquote>
              <div className="quote-by">{proof.quoteBy}</div>
            </div>
            <div className="trust-list reveal d1">
              {proof.rows.map((row) => (
                <div className="trust-row" key={row.label}>
                  <b>{row.label}</b>
                  <span>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="contact" id="a3Contact">
        <div className="wrap">
          <div className="section-no light reveal" style={{ textAlign: 'left' }}>
            {contact.no}
          </div>
          <h2 className="reveal">
            {contact.titleLead}
            <br />
            {contact.titleAccent}
          </h2>
          <p className="reveal d1">{contact.p}</p>
          <NextLink className="btn light reveal d2" href="/login">
            {contact.cta} <span>→</span>
          </NextLink>
          <div className="addr reveal d3">
            {contact.addrLine}
            <br />
            <span>{contact.addrEn}</span>
          </div>
          <div className="foot">
            <span>{contact.footLeft}</span>
            <span>{contact.footRight}</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
