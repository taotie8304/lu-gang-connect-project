// 鲁港通 - 价格页改版：新增文案必须在简繁英韩四个语种同时补齐，避免线上出现 key 或空文案
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['zh-CN', 'zh-Hant', 'en', 'ko-KR'] as const;

const REQUIRED_KEYS = [
  'extra_points.one_time',
  'extra_points.unit_price',
  'extra_points.feature_permanent',
  'extra_points.feature_universal',
  'extra_points.feature_deep_qa',
  'extra_points.buy_now',
  'extra_points.recommended',
  'extra_points.bonus_tag',
  'corp.eyebrow',
  'corp.headline',
  'corp.desc',
  'corp.price_text',
  'corp.price_note',
  'corp.cta',
  'corp.cap_1_title',
  'corp.cap_1_desc',
  'corp.cap_2_title',
  'corp.cap_2_desc',
  'corp.cap_3_title',
  'corp.cap_3_desc',
  'corp.cap_4_title',
  'corp.cap_4_desc',
  'corp.cases_label',
  'corp.case_1_title',
  'corp.case_1_desc',
  'corp.case_2_title',
  'corp.case_2_desc',
  'corp.case_3_title',
  'corp.case_3_desc',
  'corp.case_4_title',
  'corp.case_4_desc',
  'corp.feat_members',
  'corp.feat_payment',
  'corp.feat_support',
  'corp.feat_custom'
] as const;

const loadPriceJson = (locale: (typeof LOCALES)[number]) =>
  JSON.parse(readFileSync(resolve(`packages/web/i18n/${locale}/price.json`), 'utf8')) as Record<
    string,
    string
  >;

describe('价格页改版文案四语种完整性', () => {
  it.each(LOCALES)('%s 包含全部新增 key 且文案非空', (locale) => {
    const dict = loadPriceJson(locale);
    const missing = REQUIRED_KEYS.filter((key) => !dict[key] || !dict[key].trim());
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('%s 的占位符保持可用', (locale) => {
    const dict = loadPriceJson(locale);
    expect(dict['extra_points.unit_price']).toContain('{{price}}');
    expect(dict['extra_points.feature_deep_qa']).toContain('{{count}}');
    expect(dict['extra_points.bonus_tag']).toContain('{{count}}');
  });
});
