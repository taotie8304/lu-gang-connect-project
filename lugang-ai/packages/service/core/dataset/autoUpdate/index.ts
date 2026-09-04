/**
 * 鲁港通 - 知识库自动更新模块导出（D8）
 *
 * 说明：调度入口 `runAutoUpdateTask` / `triggerAutoUpdate` 由官方 cron 机制
 *   （projects/app/src/service/common/system/cron.ts 的 setCron + checkTimerLock 分布式锁）注册调用，
 *   不再使用 node-cron，故此处不提供 initAutoUpdate / startAutoUpdateScheduler。
 */
export * from './hkGovApiConverter';
export * from './scraper';
export * from './detector';
export * from './downloader';
export * from './scheduler';
