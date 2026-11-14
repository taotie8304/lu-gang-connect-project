// 鲁港通 - 首页交互动效：滚动进度、视差、吉祥物表情与跟随、场景轮播、计数与渐入
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { calcDriftOffset, calcScrollOffset, calcScrollProgress, formatCount } from './homeFx';
import { clampMascotPoint, parseMascotPoint, serializeMascotPoint } from './mascotDrag';
import type { MascotPoint } from './mascotDrag';
import { hasStatsAnimated, markStatsAnimated } from './homeRuntime';
import { bindReveal } from '@/web/common/utils/reveal';

const SCENE_INTERVAL = 6400;
const COUNT_DURATION = 1200;
const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

// 鲁港通 - 史莱姆表情：保持时长区间（毫秒）与出现权重
type Face = 'idle' | 'blink' | 'left' | 'right' | 'squint' | 'wide';
const FACE_HOLD: Record<Face, [number, number]> = {
  idle: [520, 1100],
  blink: [220, 320],
  left: [700, 1200],
  right: [700, 1200],
  squint: [900, 1500],
  wide: [800, 1300]
};
const FACE_WEIGHTS: [Face, number][] = [
  ['blink', 0.26],
  ['left', 0.17],
  ['right', 0.17],
  ['squint', 0.14],
  ['wide', 0.12],
  ['idle', 0.14]
];
const randomBetween = ([min, max]: [number, number]) => min + Math.random() * (max - min);
const pickFace = (): Face => {
  let roll = Math.random();
  for (const [face, weight] of FACE_WEIGHTS) {
    if (roll < weight) return face;
    roll -= weight;
  }
  return 'idle';
};

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

    /* 滚动进度条：首页自身是滚动容器，进度按容器滚动量计算 */
    const progress = root.querySelector<HTMLElement>('.h5-progress');
    const syncScroll = () => {
      if (!progress) return;
      progress.style.width = `${calcScrollProgress(root.scrollTop, root.scrollHeight, root.clientHeight) * 100}%`;
    };
    listen(root, 'scroll', syncScroll, { passive: true });
    listen(window, 'resize', syncScroll);
    syncScroll();

    /* 视差与相对视口漂移 */
    const parallaxEls = Array.from(root.querySelectorAll<HTMLElement>('[data-parallax]'));
    const driftEls = Array.from(root.querySelectorAll<HTMLElement>('[data-drift]'));
    let ticking = false;
    const updateParallax = () => {
      const y = root.scrollTop;
      parallaxEls.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax || '0') || 0;
        el.style.setProperty('--py', `${calcScrollOffset(y, speed)}px`);
      });
      const viewportHeight = root.clientHeight;
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
      listen(root, 'scroll', requestParallax, { passive: true });
      listen(window, 'resize', updateParallax);
      updateParallax();
    }

    /* 首屏吉祥物：表情调度与拖拽共享同一元素，拖拽期间暂停写入表情 */
    const hero = root.querySelector<HTMLElement>('.h5-hero');
    const heroMascot = root.querySelector<HTMLElement>('#home-hero-mascot');
    const mascotEyes = heroMascot?.querySelector<HTMLElement>('.h5-eyes') ?? null;
    const mascotParallax = heroMascot?.querySelector<HTMLElement>('.h5-mascot-parallax') ?? null;
    let dragging = false;

    /* 史莱姆表情：眨眼 / 左右看 / 眯眼 / 圆眼，各元素独立节奏 */
    const faces = Array.from(root.querySelectorAll<HTMLElement>('[data-face]'));
    if (!reduceMotion && faces.length) {
      let faceStopped = false;
      const faceTimers: number[] = [];
      const schedule = (fn: () => void, delay: number) => {
        faceTimers.push(window.setTimeout(fn, delay));
      };
      cleanups.push(() => {
        faceStopped = true;
        faceTimers.forEach((timer) => window.clearTimeout(timer));
      });
      const applyFace = (el: HTMLElement, face: Face) => {
        if (dragging && el === mascotEyes) return;
        el.dataset.face = face;
      };
      faces.forEach((el) => {
        const hold = (face: Face) => {
          if (faceStopped) return;
          applyFace(el, face);
          schedule(() => {
            if (faceStopped) return;
            applyFace(el, 'idle');
            schedule(() => hold(pickFace()), randomBetween(FACE_HOLD.idle));
          }, randomBetween(FACE_HOLD[face]));
        };
        schedule(() => hold(pickFace()), 500 + Math.random() * 1400);
      });
    }

    /* 鲁港通 - 史莱姆拖拽：仅桌面精确指针启用，落点归一化保存并限制在首屏区域内 */
    const MASCOT_POS_KEY = 'lg-home-mascot-pos';
    let mascotPoint = parseMascotPoint(window.localStorage.getItem(MASCOT_POS_KEY));
    const canDragMascot = finePointer && window.innerWidth > 1180 && hero !== null && heroMascot !== null;
    const applyMascotPoint = (point: MascotPoint) => {
      if (!heroMascot) return;
      heroMascot.style.setProperty('--mx', `${(point.x * 100).toFixed(2)}%`);
      heroMascot.style.setProperty('--my', `${(point.y * 100).toFixed(2)}%`);
    };
    const clampMascot = (pointerX: number, pointerY: number): MascotPoint | null => {
      if (!hero || !heroMascot) return null;
      const heroRect = hero.getBoundingClientRect();
      const mascotSize = { width: heroMascot.offsetWidth, height: heroMascot.offsetHeight };
      if (mascotSize.width <= 0 || mascotSize.height <= 0) return null;
      return clampMascotPoint({ pointerX, pointerY, heroRect, mascotSize });
    };
    const restoreMascot = () => {
      if (dragging || !mascotPoint || !hero) return;
      const rect = hero.getBoundingClientRect();
      const restored = clampMascot(rect.left + mascotPoint.x * rect.width, rect.top + mascotPoint.y * rect.height);
      if (!restored) return;
      mascotPoint = restored;
      applyMascotPoint(restored);
    };
    if (canDragMascot && heroMascot) {
      restoreMascot();
      listen(window, 'resize', restoreMascot);
      // 鲁港通 - 吉祥物图片未加载时高度为 0，恢复落点需等图片就绪后重试
      const mascotImg = heroMascot.querySelector('img');
      if (mascotImg && !mascotImg.complete) listen(mascotImg, 'load', restoreMascot);

      let activePointer: number | null = null;
      let startX = 0;
      let startY = 0;
      let pendingDrag = false;
      const stopDrag = (persist: boolean) => {
        if (dragging) {
          dragging = false;
          heroMascot.classList.remove('is-dragging');
          if (mascotEyes) mascotEyes.dataset.face = 'idle';
          if (persist && mascotPoint) {
            window.localStorage.setItem(MASCOT_POS_KEY, serializeMascotPoint(mascotPoint));
          }
        }
        pendingDrag = false;
        activePointer = null;
      };
      listen(heroMascot, 'pointerdown', (event) => {
        const pointer = event as PointerEvent;
        if (pointer.button !== 0 || pointer.pointerType === 'touch') return;
        activePointer = pointer.pointerId;
        startX = pointer.clientX;
        startY = pointer.clientY;
        pendingDrag = true;
        heroMascot.setPointerCapture(pointer.pointerId);
      });
      listen(heroMascot, 'pointermove', (event) => {
        const pointer = event as PointerEvent;
        if (activePointer !== pointer.pointerId) return;
        if (!dragging) {
          if (!pendingDrag || Math.hypot(pointer.clientX - startX, pointer.clientY - startY) <= 4) return;
          dragging = true;
          pendingDrag = false;
          heroMascot.classList.add('is-dragging');
          if (mascotEyes) mascotEyes.dataset.face = 'busy';
          if (mascotParallax) mascotParallax.style.transform = '';
        }
        const next = clampMascot(pointer.clientX, pointer.clientY);
        if (!next) return;
        mascotPoint = next;
        applyMascotPoint(next);
      });
      const endDrag = (event: Event) => {
        const pointer = event as PointerEvent;
        if (activePointer === null || pointer.pointerId !== activePointer) return;
        if (heroMascot.hasPointerCapture(activePointer)) {
          heroMascot.releasePointerCapture(activePointer);
        }
        stopDrag(true);
      };
      listen(heroMascot, 'pointerup', endDrag);
      listen(heroMascot, 'pointercancel', endDrag);
      cleanups.push(() => stopDrag(false));
    }

    /* 首屏吉祥物跟随指针弹跳：拖拽过（存在落点）后不再位移，避免与悬浮位置打架 */
    if (!reduceMotion && finePointer && hero && mascotParallax) {
      listen(hero, 'pointermove', (event) => {
        if (dragging || mascotPoint) return;
        const pointer = event as PointerEvent;
        const rect = hero.getBoundingClientRect();
        const dx = (pointer.clientX - rect.left) / rect.width - 0.5;
        const dy = (pointer.clientY - rect.top) / rect.height - 0.5;
        const lift = Math.min(1, Math.hypot(dx, dy) * 1.8);
        mascotParallax.style.transform = `translate3d(${(dx * -34).toFixed(1)}px, ${(dy * -26 - lift * 8).toFixed(1)}px, 0) rotate(${(dx * 6).toFixed(2)}deg)`;
      });
      listen(hero, 'pointerleave', () => {
        mascotParallax.style.transform = '';
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
        { root, threshold: 0.2 }
      );
      sceneObserver.observe(demo);
      cleanups.push(() => sceneObserver.disconnect());
    } else {
      startScenes();
    }

    /* 统计数字滚动：同一页面生命周期内只播放一次，语言切换重挂载后直接显示终值 */
    const counters = Array.from(root.querySelectorAll<HTMLElement>('[data-count]'));
    let countFrame = 0;
    const finishCounters = () => {
      counters.forEach((el) => {
        el.textContent = formatCount(Number.parseInt(el.dataset.count || '0', 10) || 0);
      });
    };
    const runCounters = () => {
      if (hasStatsAnimated()) {
        finishCounters();
        return;
      }
      markStatsAnimated();
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
    if (hasStatsAnimated()) finishCounters();

    /* 渐入与统计触发：语言切换会重建文案节点，交给 bindReveal 持续重扫，避免元素永久隐藏 */
    if (!reduceMotion) {
      cleanups.push(bindReveal({ root, selector: '.h5-reveal', activeClass: 'is-in' }));
      cleanups.push(bindReveal({ root, selector: '.h5-stats-grid', onReveal: runCounters }));
    } else {
      root
        .querySelectorAll<HTMLElement>('.h5-reveal')
        .forEach((el) => el.classList.add('is-in'));
      finishCounters();
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [rootRef]);
};
