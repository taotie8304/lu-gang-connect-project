import { useEffect, useState } from 'react';

// 鲁港通 - 首页欢迎语「普通话 → 粤语 → 英文」三语循环轮播。
// 文案走 i18n key（chat:home.slogan.*），四个语言包内的值刻意保持一致：
// 轮播内容本身即三种语言，与用户当前界面语言无关，故不随界面语言变化。
const SLOGAN_KEYS = ['home.slogan.mandarin', 'home.slogan.cantonese', 'home.slogan.english'] as const;

/** 每条欢迎语的停留时长（毫秒） */
const ROTATE_INTERVAL = 4000;
/** 淡出/淡入过渡时长（毫秒），需与样式 transition 保持一致 */
export const LUGANG_SLOGAN_FADE_DURATION = 300;

type UseLugangHomeSloganProps = {
  /** 后台已配置 slogan 时应关闭轮播，直接展示配置值 */
  enabled: boolean;
};

/**
 * 首页欢迎语轮播：按 普通话 → 粤语 → 英文 顺序循环，切换时先淡出再淡入。
 * enabled 为 false 时不启动定时器，isVisible 恒为 true。
 * @returns sloganKey 当前应展示的 i18n key；isVisible 淡入淡出开关
 */
export const useLugangHomeSlogan = ({ enabled }: UseLugangHomeSloganProps) => {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const rotateTimer = setInterval(() => {
      setIsVisible(false);
      fadeTimer = setTimeout(() => {
        setIndex((prev) => (prev + 1) % SLOGAN_KEYS.length);
        setIsVisible(true);
      }, LUGANG_SLOGAN_FADE_DURATION);
    }, ROTATE_INTERVAL);

    return () => {
      clearInterval(rotateTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [enabled]);

  return { sloganKey: SLOGAN_KEYS[index], isVisible };
};
