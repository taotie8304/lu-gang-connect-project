/**
 * 鲁港通 - 系统内容常量测试（D11）
 * 锁定：locale→key 映射与回退纯函数、map/派生映射完整性契约、
 * terms_of_use_zh-CN 缺 map 的 bug 修复（改为 opencc 派生）、真实法律内容 vs 占位符。
 *
 * 说明：controller 的 opencc 派生（deriveZhCN）依赖 Mongo，属集成范畴不在此单测；
 * 繁→简转换本身已由 packages/service/common/string/cjkNormalizer.property.test.ts 覆盖。
 */
import { describe, it, expect } from 'vitest';
import {
  SystemContentKeyEnum,
  systemContentKeyMap,
  systemContentZhCNBaseMap,
  resolveSystemContentKey
} from './constant';

const allEnumValues = Object.values(SystemContentKeyEnum) as string[];

describe('resolveSystemContentKey - locale→key 映射与回退', () => {
  it('zh-Hant 使用基准 key（无后缀）', () => {
    expect(resolveSystemContentKey('terms_of_use', 'zh-Hant')).toBe(SystemContentKeyEnum.termsOfUse);
    expect(resolveSystemContentKey('privacy_policy', 'zh-Hant')).toBe(
      SystemContentKeyEnum.privacyPolicy
    );
    expect(resolveSystemContentKey('data_collection', 'zh-Hant')).toBe(
      SystemContentKeyEnum.dataCollection
    );
  });

  it('zh-CN 命中 _zh-CN 本地化 key', () => {
    expect(resolveSystemContentKey('terms_of_use', 'zh-CN')).toBe(
      SystemContentKeyEnum.termsOfUseZhCN
    );
    expect(resolveSystemContentKey('privacy_policy', 'zh-CN')).toBe(
      SystemContentKeyEnum.privacyPolicyZhCN
    );
    expect(resolveSystemContentKey('data_collection', 'zh-CN')).toBe(
      SystemContentKeyEnum.dataCollectionZhCN
    );
  });

  it('en 命中 _en 本地化 key', () => {
    expect(resolveSystemContentKey('terms_of_use', 'en')).toBe(SystemContentKeyEnum.termsOfUseEn);
    expect(resolveSystemContentKey('privacy_policy', 'en')).toBe(
      SystemContentKeyEnum.privacyPolicyEn
    );
    expect(resolveSystemContentKey('data_collection', 'en')).toBe(
      SystemContentKeyEnum.dataCollectionEn
    );
  });

  it('ko-KR 无系统内容，回退英文 _en（修复：不再落到繁体基准）', () => {
    expect(resolveSystemContentKey('terms_of_use', 'ko-KR')).toBe(SystemContentKeyEnum.termsOfUseEn);
    expect(resolveSystemContentKey('privacy_policy', 'ko-KR')).toBe(
      SystemContentKeyEnum.privacyPolicyEn
    );
    expect(resolveSystemContentKey('data_collection', 'ko-KR')).toBe(
      SystemContentKeyEnum.dataCollectionEn
    );
  });

  it('无对应本地化版本 / 未知基准 key 时原样回退（不抛错、不返回 undefined）', () => {
    expect(resolveSystemContentKey('nonexistent_key', 'zh-CN')).toBe('nonexistent_key');
    expect(resolveSystemContentKey('nonexistent_key', 'en')).toBe('nonexistent_key');
    expect(resolveSystemContentKey('nonexistent_key', 'zh-Hant')).toBe('nonexistent_key');
  });
});

describe('systemContentKeyMap / 派生映射完整性契约', () => {
  it('枚举共 9 个 key（3 类内容 × 繁/简/英）', () => {
    expect(allEnumValues).toHaveLength(9);
  });

  it('每个枚举 key 要么在 map 有自有默认，要么登记为 zh-CN 派生（二者必居其一）', () => {
    for (const key of allEnumValues) {
      const covered = key in systemContentKeyMap || key in systemContentZhCNBaseMap;
      expect(covered, `key ${key} 既不在 map 也不在派生表`).toBe(true);
    }
  });

  it('terms_of_use_zh-CN 缺 map 的 bug 已修复：改为登记派生表，基准指向繁体', () => {
    // 修复前：terms_of_use_zh-CN 在枚举但不在 map，getSystemContent 直接返回 null（简体用户看不到条款）
    expect(systemContentZhCNBaseMap[SystemContentKeyEnum.termsOfUseZhCN]).toBe(
      SystemContentKeyEnum.termsOfUse
    );
    // 派生 key 不内嵌简体大 blob（避免重复维护 ~270 行法律文本）
    expect(SystemContentKeyEnum.termsOfUseZhCN in systemContentKeyMap).toBe(false);
  });

  it('派生表的每个基准 key 必须在 map 中存在（保证派生有源）', () => {
    for (const baseKey of Object.values(systemContentZhCNBaseMap)) {
      if (!baseKey) continue;
      expect(baseKey in systemContentKeyMap, `派生基准 ${baseKey} 不在 map`).toBe(true);
    }
  });
});

describe('默认内容：真实法律文本 vs 占位符', () => {
  const PLACEHOLDER_MARKERS = ['待管理員配置', '待管理员配置', 'to be configured'];
  const isPlaceholder = (content: string) => PLACEHOLDER_MARKERS.some((m) => content.includes(m));

  it('使用条款繁体/英文为真实法律内容（非占位符，含关键条款要素）', () => {
    const hant = systemContentKeyMap[SystemContentKeyEnum.termsOfUse].defaultContent;
    const en = systemContentKeyMap[SystemContentKeyEnum.termsOfUseEn].defaultContent;
    expect(isPlaceholder(hant)).toBe(false);
    expect(isPlaceholder(en)).toBe(false);
    // 关键法律要素抽查（文本本身不改，仅锁定存在性）
    expect(hant).toContain('HKIAC');
    expect(hant).toContain('service@airscend.com');
    expect(en).toContain('HKIAC');
    expect(en.length).toBeGreaterThan(1000);
  });

  it('隐私政策/资料收集声明为占位符（待管理员配置）', () => {
    expect(isPlaceholder(systemContentKeyMap[SystemContentKeyEnum.privacyPolicy].defaultContent)).toBe(
      true
    );
    expect(
      isPlaceholder(systemContentKeyMap[SystemContentKeyEnum.dataCollection].defaultContent)
    ).toBe(true);
    expect(isPlaceholder(systemContentKeyMap[SystemContentKeyEnum.privacyPolicyEn].defaultContent)).toBe(
      true
    );
  });

  it('map 中每个条目都有 label/defaultTitle/defaultContent 三字段且内容非空', () => {
    for (const [key, entry] of Object.entries(systemContentKeyMap)) {
      expect(typeof entry.label, `${key}.label`).toBe('string');
      expect(typeof entry.defaultTitle, `${key}.defaultTitle`).toBe('string');
      expect(typeof entry.defaultContent, `${key}.defaultContent`).toBe('string');
      expect(entry.defaultContent.length, `${key}.defaultContent 非空`).toBeGreaterThan(0);
    }
  });
});
