// 鲁港通 - 首页交互动效：滚动进度、视差、指针跟随、场景轮播、计数与渐入
import { useEffect } from 'react';
import type { RefObject } from 'react';
import {
  calcDriftOffset,
  calcScrollOffset,
  calcScrollProgress,
  formatCount,
  shouldRevealImmediately
} from './homeFx';

const SCENE_INTERVAL = 6400;
const COUNT_DURATION = 1200;
const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

export const useHomeEffects = (rootRef: RefObject<HTMLDivElement | null>) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const cleanups: (() => void)[] = [];
    const listen = (
      target: Window | Document | HTMLElement,
      type: string,
      handler: EventListener,
      options?: AddEventListenerOptions
    ) => {
      target.addEventListener(type, handler, options);
      cleanups.push(() => target.removeEventListener(type, handler, options));
    };

    /* 滚动进度条 */
    const progress = root.querySelector<HTMLElement>('.h5-progress');
    const syncScroll = () => {
      if (!progress) return;
      const doc = document.documentElement;
      progress.style.width = `${calcScrollProgress(window.scrollY, doc.scrollHeight, window.innerHeight) * 100}%`;
    };
    listen(window, 'scroll', syncScroll, { passive: true });
    listen(window, 'resize', syncScroll);
    syncScroll();

    /* 视差与相对视口漂移 */
    const parallaxEls = Array.from(root.querySelectorAll<HTMLElement>('[data-parallax]'));
    const driftEls = Array.from(root.querySelectorAll<HTMLElement>('[data-drift]'));
    let ticking = false;
    const updateParallax = () => {
      const y = window.scrollY;
      parallaxEls.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax || '0') || 0;
        el.style.setProperty('--py', `${calcScrollOffset(y, speed)}px`);
      });
      const viewportHeight = window.innerHeight;
      driftEls.forEach((el) => {
        const speed = parseFloat(el.dataset.drift || '0') || 0;
        const current = parseFloat(el.style.getPropertyValue('--py')) || 0;
        const rect = el.getBoundingClientRect();
        const top = rect.top - current;
        el.style.setProperty(
          '--py',
          `${calcDriftOffset({ top, height: rect.height }, viewportHeight, speed)}px`
        );
      });
      ticking = false;
    };
    const requestParallax = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateParallax);
    };
    if (!reduceMotion && (parallaxEls.length || driftEls.length)) {
      listen(window, 'scroll', requestParallax, { passive: true });
      listen(window, 'resize', updateParallax);
      updateParallax();
    }

    /* 首屏吉祥物跟随指针 */
    const hero = root.querySelector<HTMLElement>('.h5-hero');
    const heroMascot = root.querySelector<HTMLElement>('#home-hero-mascot');
    if (!reduceMotion && finePointer && hero && heroMascot) {
      listen(hero, 'pointermove', (event) => {
        const pointer = event as PointerEvent;
        const rect = hero.getBoundingClientRect();
        const dx = (pointer.clientX - rect.left) / rect.width - 0.5;
        const dy = (pointer.clientY - rect.top) / rect.height - 0.5;
        heroMascot.style.transform = `translate3d(${(dx * -18).toFixed(1)}px, ${(dy * -14).toFixed(1)}px, 0)`;
      });
      listen(hero, 'pointerleave', () => {
        heroMascot.style.transform = '';
      });
    }

    /* 工作台轻微 3D 倾斜 */
    const stage = root.querySelector<HTMLElement>('#home-work-stage');
    const stageWrap = stage?.parentElement;
    if (!reduceMotion && finePointer && stage && stageWrap) {
      listen(stageWrap, 'pointermove', (event) => {
        const pointer = event as PointerEvent;
        const rect = stage.getBoundingClientRect();
        const dx = (pointer.clientX - rect.left) / rect.width - 0.5;
        const dy = (pointer.clientY - rect.top) / rect.height - 0.5;
        stage.style.transform = `perspective(1400px) rotateX(${(dy * -2.4).toFixed(2)}deg) rotateY(${(dx * 2.8).toFixed(2)}deg)`;
      });
      listen(stageWrap, 'pointerleave', () => {
        stage.style.transform = '';
      });
    }

    /* 演示窗口三幕轮播（进入视口后启动） */
    const scenes = Array.from(root.querySelectorAll<HTMLElement>('.h5-scene'));
    const bars = Array.from(root.querySelectorAll<HTMLElement>('.h5-scene-bars i'));
    let sceneIndex = 0;
    let sceneTimer: number | undefined;
    const showScene = (next: number) => {
      sceneIndex = (next + scenes.length) % scenes.length;
      scenes.forEach((el, index) => el.classList.toggle('is-on', index === sceneIndex));
      bars.forEach((el, index) => el.classList.toggle('is-on', index === sceneIndex));
    };
    const startScenes = () => {
      if (reduceMotion || sceneTimer !== undefined || scenes.length < 2) return;
      sceneTimer = window.setInterval(() => showScene(sceneIndex + 1), SCENE_INTERVAL);
    };
    cleanups.push(() => {
      if (sceneTimer !== undefined) window.clearInterval(sceneTimer);
    });
    const demo = root.querySelector('.h5-demo');
    if ('IntersectionObserver' in window && demo) {
      const sceneObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) startScenes();
        },
        { threshold: 0.2 }
      );
      sceneObserver.observe(demo);
      cleanups.push(() => sceneObserver.disconnect());
    } else {
      startScenes();
    }

    /* 统计数字滚动 */
    const counters = Array.from(root.querySelectorAll<HTMLElement>('[data-count]'));
    let counted = false;
    let countFrame = 0;
    const animateCounters = () => {
      if (counted) return;
      counted = true;
      counters.forEach((el) => {
        const target = Number.parseInt(el.dataset.count || '0', 10) || 0;
        const start = performance.now();
        const tick = (now: number) => {
          const progressValue = Math.min(1, (now - start) / COUNT_DURATION);
          el.textContent = formatCount(target * easeOutCubic(progressValue));
          if (progressValue < 1) countFrame = requestAnimationFrame(tick);
        };
        countFrame = requestAnimationFrame(tick);
      });
    };
    cleanups.push(() => cancelAnimationFrame(countFrame));

    /* 渐入：首屏直接显示，其余进入视口后再出现 */
    const reveals = Array.from(root.querySelectorAll<HTMLElement>('.h5-reveal'));
    if (!reduceMotion && 'IntersectionObserver' in window) {
      const viewportHeight = window.innerHeight;
      const pending: HTMLElement[] = [];
      reveals.forEach((el) => {
        if (shouldRevealImmediately(el.getBoundingClientRect().top, viewportHeight)) {
          el.classList.add('is-in');
        } else {
          pending.push(el);
        }
      });
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            (entry.target as HTMLElement).classList.add('is-in');
            revealObserver.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      pending.forEach((el) => revealObserver.observe(el));
      cleanups.push(() => revealObserver.disconnect());

      const statsGrid = root.querySelector('.h5-stats-grid');
      if (statsGrid) {
        const statsObserver = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            animateCounters();
            statsObserver.disconnect();
          },
          { threshold: 0.3 }
        );
        statsObserver.observe(statsGrid);
        cleanups.push(() => statsObserver.disconnect());
      }
    } else {
      reveals.forEach((el) => el.classList.add('is-in'));
      counters.forEach((el) => {
        el.textContent = formatCount(Number.parseInt(el.dataset.count || '0', 10) || 0);
      });
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [rootRef]);
};
