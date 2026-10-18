import { describe, expect, it } from 'vitest';
import { decideMainWindowPermission } from '../src/main/mainWindowPermissions';

const appOrigin = 'https://www.airscend.com';

describe('decideMainWindowPermission', () => {
  it('应用源允许剪贴板读取与写入', () => {
    expect(
      decideMainWindowPermission({
        permission: 'clipboard-sanitized-write',
        requestingOrigin: appOrigin,
        appOrigin
      })
    ).toBe(true);
    expect(
      decideMainWindowPermission({
        permission: 'clipboard-read',
        requestingOrigin: appOrigin,
        appOrigin
      })
    ).toBe(true);
  });

  it('应用源仍拒绝摄像头、定位与通知', () => {
    for (const permission of ['media', 'geolocation', 'notifications']) {
      expect(
        decideMainWindowPermission({
          permission,
          requestingOrigin: appOrigin,
          appOrigin
        })
      ).toBe(false);
    }
  });

  it('站外来源请求剪贴板拒绝', () => {
    expect(
      decideMainWindowPermission({
        permission: 'clipboard-sanitized-write',
        requestingOrigin: 'https://evil.example.com',
        appOrigin
      })
    ).toBe(false);
  });

  it('非法来源拒绝', () => {
    expect(
      decideMainWindowPermission({
        permission: 'clipboard-sanitized-write',
        requestingOrigin: '',
        appOrigin
      })
    ).toBe(false);
    expect(
      decideMainWindowPermission({
        permission: 'clipboard-sanitized-write',
        requestingOrigin: 'not-a-url',
        appOrigin
      })
    ).toBe(false);
    expect(
      decideMainWindowPermission({
        permission: 'clipboard-sanitized-write',
        requestingOrigin: 'file:///c:/a.html',
        appOrigin
      })
    ).toBe(false);
  });

  it('appOrigin 带尾斜杠仍识别应用源', () => {
    expect(
      decideMainWindowPermission({
        permission: 'clipboard-sanitized-write',
        requestingOrigin: appOrigin,
        appOrigin: 'https://www.airscend.com/'
      })
    ).toBe(true);
  });
});
