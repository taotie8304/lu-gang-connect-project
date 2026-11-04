// 鲁港通 - 智能体记忆候选提取纯逻辑（敏感信息过滤、频控、输出解析、去重）
import { UserMemoryMaxContentLength } from './constants';

export const UserMemoryCandidateMaxPerExtract = 3;
export const UserMemoryExtractRoundInterval = 3;
export const UserMemoryExtractDailyLimit = 20;
export const UserMemoryCandidateExpireDays = 7;
export const UserMemoryIgnoreDedupeDays = 30;

/** 身份证、银行卡、护照、密码/验证码、生物特征等一律不进入记忆 */
const sensitivePatterns: RegExp[] = [
  /(?<!\d)\d{17}[\dXx](?!\d)/,
  /(?<!\d)\d{16,19}(?!\d)/,
  /(?<![A-Za-z])[A-Za-z]\d{8}(?![A-Za-z0-9])/,
  /密码|口令|验证码|动态码|短信码/,
  /指纹|人脸|虹膜|声纹|生物特征/
];

export const containsSensitiveMemory = (text: string) =>
  sensitivePatterns.some((pattern) => pattern.test(text));

/** 归一化用于重复判定：忽略大小写、空白、标点与符号 */
export const normalizeMemoryText = (text: string) =>
  text.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

const normalizeCandidateText = (text: string) =>
  text.replace(/\s+/g, ' ').trim().slice(0, UserMemoryMaxContentLength);

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const extractJsonValue = (raw: string): unknown => {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!cleaned) return undefined;

  const direct = parseJson(cleaned);
  if (direct !== undefined) return direct;

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const parsed = parseJson(arrayMatch[0]);
    if (parsed !== undefined) return parsed;
  }

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    const parsed = parseJson(objectMatch[0]);
    if (parsed !== undefined) return parsed;
  }

  return undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (value && typeof value === 'object') {
    const memories = (value as { memories?: unknown }).memories;
    if (Array.isArray(memories)) {
      return memories.filter((item): item is string => typeof item === 'string');
    }
  }
  return [];
};

/** 解析模型输出，容忍代码块、对象包裹与夹杂说明文字 */
export const parseMemoryExtractionOutput = (raw: string): string[] => {
  const items = toStringArray(extractJsonValue(raw));
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const text = normalizeCandidateText(item);
    if (!text) continue;

    const key = normalizeMemoryText(text);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(text);
    if (result.length >= UserMemoryCandidateMaxPerExtract) break;
  }

  return result;
};

const isSameOrContained = (normalized: string, others: string[]) =>
  others.some(
    (other) =>
      other === normalized ||
      (normalized.length >= 3 && other.includes(normalized)) ||
      (other.length >= 3 && normalized.includes(other))
  );

/** 过滤与已有记忆/近期忽略/待确认重复的候选，并对候选之间去重 */
export const filterNewMemoryCandidates = ({
  candidates,
  existingMemories,
  recentIgnoredContents,
  pendingContents
}: {
  candidates: string[];
  existingMemories: string[];
  recentIgnoredContents: string[];
  pendingContents: string[];
}): string[] => {
  const blocked = [...existingMemories, ...recentIgnoredContents, ...pendingContents]
    .map(normalizeMemoryText)
    .filter(Boolean);
  const accepted: string[] = [];
  const acceptedKeys: string[] = [];

  for (const candidate of candidates) {
    const text = normalizeCandidateText(candidate);
    if (!text) continue;

    const key = normalizeMemoryText(text);
    if (!key || isSameOrContained(key, blocked) || isSameOrContained(key, acceptedKeys)) continue;

    accepted.push(text);
    acceptedKeys.push(key);
  }

  return accepted;
};

/** 首轮尝试提取，之后每 3 轮一次 */
export const shouldExtractOnRound = (roundCount: number) =>
  roundCount > 0 && roundCount % UserMemoryExtractRoundInterval === 1;
