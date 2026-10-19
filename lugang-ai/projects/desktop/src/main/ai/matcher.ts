// 鲁港通 - AI 元素语义定位：优先快照引用，失效时按名称/占位符/文本重定位
export type AiElementView = {
  ref: string;
  role: string;
  name: string;
  tag: string;
  type?: string;
  placeholder?: string;
  text?: string;
  autocomplete?: string;
  sensitive?: boolean;
  disabled?: boolean;
  visible?: boolean;
};

export type AiTargetRequest = {
  ref?: string;
  target?: string;
};

export type AiTargetMatch =
  | { kind: 'matched'; element: AiElementView; score: number }
  | { kind: 'ambiguous'; candidates: AiElementView[] }
  | { kind: 'not_found' };

const normalizeText = (input?: string): string =>
  (input ?? '')
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。！？、；：""''（）()【】[\]<>《》.!?,;:'"]/g, '');

const scoreElement = (element: AiElementView, query: string): number => {
  const name = normalizeText(element.name);
  const placeholder = normalizeText(element.placeholder);
  const text = normalizeText(element.text);
  const role = normalizeText(`${element.role}${element.type ?? ''}`);
  if (!query) return 0;
  if (name === query) return 100;
  if (name.includes(query)) return 80;
  if (placeholder.includes(query)) return 70;
  if (text.includes(query)) return 60;
  if (role.includes(query)) return 40;
  return 0;
};

export const matchAiTarget = (
  elements: AiElementView[],
  request: AiTargetRequest
): AiTargetMatch => {
  if (request.ref) {
    const byRef = elements.find((element) => element.ref === request.ref);
    if (byRef) return { kind: 'matched', element: byRef, score: 1000 };
  }

  const query = normalizeText(request.target);
  if (!query) return { kind: 'not_found' };

  const ranked = elements
    .filter((element) => element.visible !== false)
    .map((element) => ({ element, score: scoreElement(element, query) }))
    .filter((item) => item.score >= 40)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) return { kind: 'not_found' };

  const contenders = ranked.filter((item) => best.score - item.score <= 5);
  if (contenders.length > 1) {
    return { kind: 'ambiguous', candidates: contenders.map((item) => item.element) };
  }
  return { kind: 'matched', element: best.element, score: best.score };
};

const SENSITIVE_PATTERN =
  /密码|验证码|动态码|短信码|支付密码|卡号|信用卡|安全码|cvv|cvc|\botp\b|password|passwd|\bpin\b|one-?time|verification\s*code/i;

const SENSITIVE_AUTOCOMPLETE = /cc-number|cc-csc|one-time-code|current-password|new-password/i;

export const isSensitiveElement = (element: AiElementView): boolean => {
  if (element.type === 'password') return true;
  if (SENSITIVE_AUTOCOMPLETE.test(element.autocomplete ?? '')) return true;
  return SENSITIVE_PATTERN.test(
    [element.name, element.placeholder, element.text].filter(Boolean).join(' ')
  );
};

const HIGH_RISK_PATTERN =
  /提交|确认提交|支付|付款|购买|下单|转账|汇款|发布|删除|注销|立即购买|settle|submit|pay\s*now|purchase|publish|delete|transfer/i;

export const isHighRiskActionLabel = (label?: string): boolean =>
  HIGH_RISK_PATTERN.test(label ?? '');
