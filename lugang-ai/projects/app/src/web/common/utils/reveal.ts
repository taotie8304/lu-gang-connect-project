export type RevealOptions = {
  root: HTMLElement;
  selector: string;
  /** 命中时要加的 class；只做回调（如统计带触发数字滚动）时可省略 */
  activeClass?: string;
  /** 触发线比例，默认 0.92 */
  lineRatio?: number;
  /** 每个节点命中的回调，保证只触发一次 */
  onReveal?: (el: HTMLElement) => void;
};

/**
 * 鲁港通 - 首屏渐入/统计触发绑定。
 * 语言切换会重建文案节点、首帧布局与字体也可能后到，一次性 IntersectionObserver 会漏掉这些节点，
 * 导致元素永久 opacity: 0；这里用 DOM 变更重扫 + 多种兜底事件保证可见性。
 */
export const bindReveal = ({
  root,
  selector,
  activeClass,
  lineRatio = 0.92,
  onReveal
}: RevealOptions) => {
  const pending = new Set<HTMLElement>();
  const seen = new WeakSet<HTMLElement>();

  const scan = () => {
    const top = root.getBoundingClientRect().top;
    const viewport = root.clientHeight || window.innerHeight;
    const line = top + viewport * lineRatio;

    root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (seen.has(el) || (activeClass && el.classList.contains(activeClass))) {
        pending.delete(el);
        seen.add(el);
        return;
      }
      pending.add(el);
    });

    pending.forEach((el) => {
      if (!el.isConnected) {
        pending.delete(el);
        return;
      }
      if (el.getBoundingClientRect().top < line) {
        if (activeClass) el.classList.add(activeClass);
        pending.delete(el);
        seen.add(el);
        onReveal?.(el);
      }
    });
  };

  const observer =
    typeof MutationObserver !== 'undefined' ? new MutationObserver(() => scan()) : undefined;
  observer?.observe(root, { childList: true, subtree: true });

  root.addEventListener('scroll', scan, { passive: true });
  window.addEventListener('scroll', scan, { passive: true, capture: true });
  window.addEventListener('resize', scan);
  window.addEventListener('pageshow', scan);
  const frame = requestAnimationFrame(scan);
  const delayed = window.setTimeout(scan, 400);
  if (document.fonts?.ready) void document.fonts.ready.then(scan);

  scan();

  return () => {
    observer?.disconnect();
    root.removeEventListener('scroll', scan);
    window.removeEventListener('scroll', scan, true);
    window.removeEventListener('resize', scan);
    window.removeEventListener('pageshow', scan);
    cancelAnimationFrame(frame);
    window.clearTimeout(delayed);
  };
};
