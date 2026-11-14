import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bindReveal } from '@/web/common/utils/reveal';

const rect = (top: number, height = 100): DOMRect =>
  ({
    top,
    bottom: top + height,
    left: 0,
    right: 100,
    width: 100,
    height,
    x: 0,
    y: top,
    toJSON: () => ({})
  }) as DOMRect;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('bindReveal', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect(0, 800));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('reveals nodes already inside the trigger line', () => {
    const el = document.createElement('section');
    el.className = 'h5-reveal';
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(100));
    root.appendChild(el);

    bindReveal({ root, selector: '.h5-reveal', activeClass: 'is-in' });

    expect(el.classList.contains('is-in')).toBe(true);
  });

  it('reveals dynamically added nodes after a rescan', async () => {
    bindReveal({ root, selector: '.h5-reveal', activeClass: 'is-in' });

    const el = document.createElement('section');
    el.className = 'h5-reveal';
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(120));
    root.appendChild(el);

    await flush();

    expect(el.classList.contains('is-in')).toBe(true);
  });

  it('calls onReveal only once per node', () => {
    const onReveal = vi.fn();
    const el = document.createElement('div');
    el.className = 'stats';
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(200));
    root.appendChild(el);

    bindReveal({ root, selector: '.stats', onReveal });

    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(el.classList.contains('is-in')).toBe(false);

    root.dispatchEvent(new Event('scroll'));
    root.dispatchEvent(new Event('scroll'));

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('reveals a pending node when it scrolls into the trigger line', () => {
    const el = document.createElement('section');
    el.className = 'h5-reveal';
    const spy = vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(5000));
    root.appendChild(el);

    bindReveal({ root, selector: '.h5-reveal', activeClass: 'is-in' });
    expect(el.classList.contains('is-in')).toBe(false);

    spy.mockReturnValue(rect(100));
    root.dispatchEvent(new Event('scroll'));

    expect(el.classList.contains('is-in')).toBe(true);
  });

  it('stops processing after cleanup', async () => {
    const onReveal = vi.fn();
    const dispose = bindReveal({ root, selector: '.h5-reveal', activeClass: 'is-in', onReveal });
    dispose();

    const el = document.createElement('section');
    el.className = 'h5-reveal';
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(100));
    root.appendChild(el);

    await flush();
    expect(() => root.dispatchEvent(new Event('scroll'))).not.toThrow();
    expect(el.classList.contains('is-in')).toBe(false);
    expect(onReveal).not.toHaveBeenCalled();
  });
});
