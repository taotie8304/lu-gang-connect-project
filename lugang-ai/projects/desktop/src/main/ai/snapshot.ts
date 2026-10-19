// 鲁港通 - AI 页面快照：模型只看到受控、截断且去除敏感输入值的页面信息
import { isSensitiveElement, type AiElementView } from './matcher';

export const AI_SNAPSHOT_MAX_ELEMENTS = 300;
export const AI_SNAPSHOT_TEXT_LIMIT = 6000;
export const AI_SNAPSHOT_FULL_TEXT_LIMIT = 20000;

export type AiPageScroll = {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  pageHeight: number;
};

export type AiPageElement = {
  ref: string;
  role: string;
  name: string;
  tag: string;
  type?: string;
  placeholder?: string;
  text?: string;
  value?: string;
  autocomplete?: string;
  href?: string;
  checked?: boolean;
  disabled?: boolean;
  visible?: boolean;
  inViewport?: boolean;
  rect?: { x: number; y: number; width: number; height: number };
};

export type AiPageSnapshot = {
  url: string;
  title: string;
  text: string;
  scroll: AiPageScroll;
  elements: AiPageElement[];
  textTruncated?: boolean;
  elementsTruncated?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clip = (value: unknown, max: number): string => {
  if (typeof value !== 'string') return '';
  return value.length > max ? value.slice(0, max) : value;
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.round(value);
};

const toOptionalBool = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

/** 只保留 http(s) 的源与路径，查询串与锚点可能含令牌，一律不进入模型上下文与审计 */
export const sanitizeSnapshotUrl = (input: unknown): string => {
  if (typeof input !== 'string') return '';
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
};

const sanitizeRect = (value: unknown): AiPageElement['rect'] => {
  if (!isRecord(value)) return undefined;
  const x = toNumber(value.x);
  const y = toNumber(value.y);
  const width = toNumber(value.width);
  const height = toNumber(value.height);
  if (width <= 0 || height <= 0) return undefined;
  return { x, y, width, height };
};

const sanitizeElement = (raw: unknown): AiPageElement | null => {
  if (!isRecord(raw)) return null;
  const ref = clip(raw.ref, 32);
  if (!/^e\d{1,4}$/.test(ref)) return null;
  if (raw.visible === false) return null;

  const element: AiPageElement = {
    ref,
    role: clip(raw.role, 40) || 'generic',
    name: clip(raw.name, 200),
    tag: clip(raw.tag, 20).toLowerCase() || 'div'
  };

  if (typeof raw.type === 'string') element.type = clip(raw.type, 20).toLowerCase();
  if (typeof raw.placeholder === 'string') element.placeholder = clip(raw.placeholder, 200);
  if (typeof raw.text === 'string') element.text = clip(raw.text, 200);
  if (typeof raw.autocomplete === 'string') element.autocomplete = clip(raw.autocomplete, 60);
  if (typeof raw.href === 'string') element.href = clip(raw.href, 300);

  const checked = toOptionalBool(raw.checked);
  if (checked !== undefined) element.checked = checked;
  const disabled = toOptionalBool(raw.disabled);
  if (disabled !== undefined) element.disabled = disabled;
  if (raw.visible === true) element.visible = true;
  const inViewport = toOptionalBool(raw.inViewport);
  if (inViewport !== undefined) element.inViewport = inViewport;
  const rect = sanitizeRect(raw.rect);
  if (rect) element.rect = rect;

  const view: AiElementView = {
    ref,
    role: element.role,
    name: element.name,
    tag: element.tag,
    type: element.type,
    placeholder: element.placeholder,
    text: element.text,
    autocomplete: element.autocomplete,
    visible: true
  };
  if (!isSensitiveElement(view) && typeof raw.value === 'string') {
    element.value = clip(raw.value, 500);
  }
  return element;
};

export const normalizeAiSnapshot = (
  raw: unknown,
  options: { fullText?: boolean } = {}
): AiPageSnapshot => {
  const record = isRecord(raw) ? raw : {};
  const rawElements = Array.isArray(record.elements) ? record.elements : [];
  const elements = rawElements
    .slice(0, AI_SNAPSHOT_MAX_ELEMENTS)
    .map(sanitizeElement)
    .filter((item): item is AiPageElement => item !== null);
  const textLimit = options.fullText ? AI_SNAPSHOT_FULL_TEXT_LIMIT : AI_SNAPSHOT_TEXT_LIMIT;
  const rawText = typeof record.text === 'string' ? record.text : '';
  const rawScroll = isRecord(record.scroll) ? record.scroll : {};

  return {
    url: sanitizeSnapshotUrl(record.url),
    title: clip(record.title, 200),
    text: clip(rawText, textLimit),
    textTruncated: record.textTruncated === true || rawText.length > textLimit,
    elements,
    elementsTruncated:
      record.elementsTruncated === true || rawElements.length > AI_SNAPSHOT_MAX_ELEMENTS,
    scroll: {
      x: toNumber(rawScroll.x),
      y: toNumber(rawScroll.y),
      viewportWidth: toNumber(rawScroll.viewportWidth),
      viewportHeight: toNumber(rawScroll.viewportHeight),
      pageHeight: toNumber(rawScroll.pageHeight)
    }
  };
};

export const snapshotChanged = (before: AiPageSnapshot, after: AiPageSnapshot): boolean => {
  if (before.url !== after.url) return true;
  if (before.text !== after.text) return true;
  if (before.elements.length !== after.elements.length) return true;
  return before.elements.some((element, index) => {
    const next = after.elements[index];
    return (
      element.ref !== next.ref ||
      element.name !== next.name ||
      element.value !== next.value ||
      element.checked !== next.checked ||
      element.disabled !== next.disabled
    );
  });
};

export const snapshotContains = (snapshot: AiPageSnapshot, expected: string): boolean => {
  const needle = expected.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    snapshot.title,
    snapshot.text,
    ...snapshot.elements.flatMap((element) => [
      element.name,
      element.placeholder ?? '',
      element.text ?? '',
      element.value ?? ''
    ])
  ]
    .join('\n')
    .toLowerCase();
  return haystack.includes(needle);
};
