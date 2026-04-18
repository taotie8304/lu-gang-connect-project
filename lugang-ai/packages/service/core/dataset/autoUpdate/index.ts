// 鲁港通 - 自动更新模块导出
export * from './scraper';
export * from './detector';
export * from './downloader';
export * from './scheduler';

// 初始化自动更新功能
import { startAutoUpdateScheduler } from './scheduler';

// 在服务启动时自动启动定时任务
export function initAutoUpdate() {
  startAutoUpdateScheduler();
}
