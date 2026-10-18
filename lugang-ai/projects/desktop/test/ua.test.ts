import { expect, it } from 'vitest';
import { stripElectronFromUserAgent } from '../src/shared/ua';

it('去掉 Electron 与客户端标识并压缩空格', () => {
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Electron/44.9.0 lugang-desktop/0.1.0';
  expect(stripElectronFromUserAgent(ua)).toBe(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
});

it('普通 UA 保持不变', () => {
  const ua = 'Mozilla/5.0 Chrome/120.0.0.0';
  expect(stripElectronFromUserAgent(ua)).toBe(ua);
});
