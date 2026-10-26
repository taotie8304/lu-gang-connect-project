// 鲁港通 - 表单字段标签清洗与类型推断
import type { FormFieldKind } from './types';

export const MAX_FORM_LABEL_LENGTH = 40;

export const cleanLabel = (text: string): string =>
  text
    .replace(/[_＿]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[:：]\s*$/, '')
    .trim();

export const isValidLabel = (label: string): boolean =>
  label.length > 0 &&
  label.length <= MAX_FORM_LABEL_LENGTH &&
  !/^[\d.,\s%-]+$/.test(label) &&
  !/[_＿]{2,}/.test(label);

export const kindForLabel = (label: string): FormFieldKind =>
  /日期|时间|出生|年月日|date/i.test(label) ? 'date' : 'text';

export const findLabelField = (
  text: string
): { label: string; labelEnd: number } | undefined => {
  const separator = text.search(/[:：]/);
  if (separator <= 0) return undefined;

  const label = text.slice(0, separator).replace(/\s+/g, ' ').trim();
  if (!isValidLabel(label)) return undefined;

  const rest = text.slice(separator + 1);
  const match = rest.match(/^(\s*)[_＿]{2,}\s*$/);
  if (!match) return undefined;

  return { label, labelEnd: separator + 1 + match[1].length };
};
