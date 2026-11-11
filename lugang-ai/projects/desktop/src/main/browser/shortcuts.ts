// 鲁港通 - 网页快捷键映射：主进程与渲染层共用同一套组合，映射本身保持纯函数便于测试
export type BrowserShortcutInput = {
  type: string;
  key: string;
  control?: boolean;
  meta?: boolean;
  alt?: boolean;
  isAutoRepeat?: boolean;
};

export type BrowserShortcutAction =
  | 'back'
  | 'forward'
  | 'find'
  | 'new-tab'
  | 'close-tab'
  | 'focus-url'
  | 'reload'
  | 'print'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset';

export const resolveBrowserShortcut = (
  input: BrowserShortcutInput
): BrowserShortcutAction | null => {
  if (input.type !== 'keyDown' || input.isAutoRepeat) return null;
  const key = input.key.toLowerCase();
  const ctrl = Boolean(input.control || input.meta);
  if (input.alt && !ctrl) {
    if (key === 'arrowleft') return 'back';
    if (key === 'arrowright') return 'forward';
    return null;
  }
  if (!ctrl) return null;
  switch (key) {
    case 'f':
      return 'find';
    case 't':
      return 'new-tab';
    case 'w':
      return 'close-tab';
    case 'l':
      return 'focus-url';
    case 'r':
      return 'reload';
    case 'p':
      return 'print';
    case '=':
    case '+':
    case 'add':
      return 'zoom-in';
    case '-':
    case '_':
    case 'subtract':
      return 'zoom-out';
    case '0':
      return 'zoom-reset';
    default:
      return null;
  }
};
