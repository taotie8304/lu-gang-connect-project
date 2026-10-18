import { describe, expect, it } from 'vitest';
import { parsePermissionStore, permissionKey } from '../src/main/permissionStore';

describe('permissionKey', () => {
  it('按站点与权限组合', () => {
    expect(permissionKey('https://a.com', 'media')).toBe('https://a.com|media');
  });
});

describe('parsePermissionStore', () => {
  it('非对象输入返回空表', () => {
    expect(parsePermissionStore(null)).toEqual({});
    expect(parsePermissionStore([])).toEqual({});
    expect(parsePermissionStore('bad')).toEqual({});
  });

  it('只保留 allow/deny', () => {
    expect(
      parsePermissionStore({
        'https://a.com|media': 'allow',
        'https://b.com|geolocation': 'deny',
        'https://c.com|usb': 'maybe',
        'https://d.com|hid': 1
      })
    ).toEqual({
      'https://a.com|media': 'allow',
      'https://b.com|geolocation': 'deny'
    });
  });
});
