// 鲁港通 - 检测页面是否存在模态层：Chakra 模态会覆盖原生浏览器视图，需要临时隐藏视图
import { useEffect, useState } from 'react';

const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"]';

export const usePageOverlayOpen = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const check = () => setOpen(!!document.querySelector(MODAL_SELECTOR));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['role', 'aria-modal']
    });
    return () => observer.disconnect();
  }, []);

  return open;
};
