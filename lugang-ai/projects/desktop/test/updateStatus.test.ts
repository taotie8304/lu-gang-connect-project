import { describe, expect, it } from 'vitest';
import {
  canInstallUpdate,
  createInitialUpdateStatus,
  markUpdateAvailable,
  markUpdateDownloaded,
  markUpdateError,
  markUpdateNotAvailable,
  startUpdateCheck
} from '../src/main/updateStatus';

const base = createInitialUpdateStatus({ supported: true, currentVersion: '0.6.0' });

describe('createInitialUpdateStatus', () => {
  it('打包环境下未检查时为空闲状态', () => {
    expect(base).toEqual({ state: 'idle', currentVersion: '0.6.0' });
  });

  it('开发环境标记为不支持并保留当前版本', () => {
    expect(createInitialUpdateStatus({ supported: false, currentVersion: '0.6.0' })).toEqual({
      state: 'unsupported',
      currentVersion: '0.6.0'
    });
  });
});

describe('startUpdateCheck', () => {
  it('空闲时进入检查中', () => {
    expect(startUpdateCheck(base)).toEqual({ state: 'checking', currentVersion: '0.6.0' });
  });

  it('失败后允许重试', () => {
    const failed = markUpdateError(base);
    expect(failed.state).toBe('error');
    expect(startUpdateCheck(failed).state).toBe('checking');
  });

  it('开发环境不进入检查中', () => {
    const unsupported = createInitialUpdateStatus({ supported: false, currentVersion: '0.6.0' });
    expect(startUpdateCheck(unsupported)).toBe(unsupported);
  });

  it('下载中与已下载时不重复检查', () => {
    const downloading = markUpdateAvailable(base, '0.7.0');
    expect(startUpdateCheck(downloading)).toBe(downloading);
    const downloaded = markUpdateDownloaded(downloading, '0.7.0');
    expect(startUpdateCheck(downloaded)).toBe(downloaded);
  });
});

describe('更新结果状态', () => {
  it('发现新版本时记录版本号并进入下载中', () => {
    expect(markUpdateAvailable(startUpdateCheck(base), '0.7.0')).toEqual({
      state: 'downloading',
      currentVersion: '0.6.0',
      latestVersion: '0.7.0'
    });
  });

  it('没有新版本时回到最新状态并清掉旧版本号', () => {
    const downloading = markUpdateAvailable(base, '0.7.0');
    expect(markUpdateNotAvailable(downloading)).toEqual({
      state: 'up-to-date',
      currentVersion: '0.6.0'
    });
  });

  it('下载完成后才允许重启安装', () => {
    expect(canInstallUpdate(base)).toBe(false);
    expect(canInstallUpdate(markUpdateAvailable(base, '0.7.0'))).toBe(false);
    const downloaded = markUpdateDownloaded(startUpdateCheck(base), '0.7.0');
    expect(downloaded).toEqual({
      state: 'downloaded',
      currentVersion: '0.6.0',
      latestVersion: '0.7.0'
    });
    expect(canInstallUpdate(downloaded)).toBe(true);
  });

  it('出错时保留当前版本，便于面板继续显示', () => {
    expect(markUpdateError(markUpdateAvailable(base, '0.7.0'))).toEqual({
      state: 'error',
      currentVersion: '0.6.0'
    });
  });
});
