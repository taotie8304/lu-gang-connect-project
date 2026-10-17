// 鲁港通 - 办事浏览器会话服务（内置浏览器 P1）：开台/查询/关台 + 到期巡检，
// 每人同时最多一台；所有失败路径给用户可操作中文提示；计费结算留待 P2
import { MongoBuiltinBrowserSessions } from './schema';
import {
  closeCloudBrowserSession,
  closeCloudBrowserTab,
  createCloudBrowserSession,
  listCloudBrowserTabs,
  navigateCloudBrowserSession,
  newCloudBrowserTab,
  refreshCloudBrowserSession,
  reloadCloudBrowserSession,
  resizeCloudBrowserSession,
  selectCloudBrowserTab
} from './agentbay';
import { MongoUser } from '../user/schema';
import {
  BUILTIN_BROWSER_ALLOWED_USERNAMES,
  BUILTIN_BROWSER_SESSION_MAX_MINUTES
} from '@fastgpt/global/support/builtinBrowser/constant';
import { normalizeBuiltinBrowserUrl } from '@fastgpt/global/support/builtinBrowser/url';
import type {
  BuiltinBrowserCloseReason,
  BuiltinBrowserSessionStatus,
  BuiltinBrowserViewport,
  CloseBuiltinBrowserSessionResponse,
  CloseBuiltinBrowserTabResponse,
  GetBuiltinBrowserSessionStatusResponse,
  GetBuiltinBrowserTabsResponse,
  NavigateBuiltinBrowserSessionResponse,
  NewBuiltinBrowserTabResponse,
  OpenBuiltinBrowserSessionResponse,
  ReloadBuiltinBrowserSessionResponse,
  ResizeBuiltinBrowserSessionResponse,
  SelectBuiltinBrowserTabResponse
} from '@fastgpt/global/support/builtinBrowser/type';

const MINUTE_MS = 60 * 1000;
const MAX_SESSION_MS = BUILTIN_BROWSER_SESSION_MAX_MINUTES * MINUTE_MS;
const SWEEP_INTERVAL_MS = 60 * 1000;

/** 关台原因 → 会话终态 */
const END_STATUS_MAP: Record<BuiltinBrowserCloseReason, BuiltinBrowserSessionStatus> = {
  user: 'closed',
  timeout: 'expired',
  error: 'error'
};

/** 剩余分钟（向上取整，最小 1 分钟） */
const calcRemainingMinutes = (expiresAt: Date, now: Date) =>
  Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / MINUTE_MS));

/** 用户标签索引下限：0 为隐藏占位标签，不对前端开放 */
const MIN_VISIBLE_TAB_INDEX = 1;
const isValidTabIndex = (index: number) =>
  Number.isInteger(index) && index >= MIN_VISIBLE_TAB_INDEX;

/** 查找进行中且未过期的会话；无会话/已过期返回 null（不触发关台，由巡检兜底） */
const findActiveSession = async (tmbId: string, now: Date) => {
  const doc = await MongoBuiltinBrowserSessions.findOne({ tmbId, status: 'active' }).lean();
  if (!doc || doc.expiresAt.getTime() <= now.getTime()) {
    return null;
  }
  return doc;
};

/** 使用时长（向上取整，最小 1 分钟；不足 1 分钟按 1 分钟计） */
const calcDurationMinutes = (durationMs: number) => Math.max(1, Math.ceil(durationMs / MINUTE_MS));

/** 结束一条进行中会话记录（状态/原因/时长一并落库，P2 结算依据） */
const endSessionRecord = async ({
  docId,
  openTime,
  closeReason,
  now
}: {
  docId: string;
  openTime: Date;
  closeReason: BuiltinBrowserCloseReason;
  now: Date;
}) => {
  await MongoBuiltinBrowserSessions.updateOne(
    { _id: docId },
    {
      $set: {
        status: END_STATUS_MAP[closeReason],
        closeReason,
        closeTime: now,
        durationMs: now.getTime() - openTime.getTime()
      }
    }
  );
};

/** 开台：未过期会话刷新复用；已过期/被回收则关旧开新；并发双击撞唯一索引时复用胜者 */
export const openSession = async ({
  teamId,
  tmbId,
  viewport,
  now = new Date()
}: {
  teamId: string;
  tmbId: string;
  viewport?: BuiltinBrowserViewport;
  now?: Date;
}): Promise<OpenBuiltinBrowserSessionResponse> => {
  const existing = await MongoBuiltinBrowserSessions.findOne({ tmbId, status: 'active' }).lean();

  if (existing) {
    if (existing.expiresAt.getTime() > now.getTime()) {
      let freshResourceUrl: string | undefined;
      let recycled = false;
      try {
        const refreshed = await refreshCloudBrowserSession(existing.cloudSessionId);
        if (refreshed === null) {
          recycled = true;
        } else {
          freshResourceUrl = refreshed.resourceUrl;
        }
      } catch {
        // 临时网络异常：沿用已记录地址，不打断用户
      }

      if (!recycled) {
        if (freshResourceUrl && freshResourceUrl !== existing.resourceUrl) {
          await MongoBuiltinBrowserSessions.updateOne(
            { _id: existing._id },
            { $set: { resourceUrl: freshResourceUrl } }
          );
        }
        // 鲁港通 - 按当前面板尺寸重新贴合云端画面（复用可能来自刷新恢复/再次打开，尺寸未必一致）
        if (viewport) {
          await resizeCloudBrowserSession(existing.cloudSessionId, viewport);
        }
        return {
          resourceUrl: freshResourceUrl ?? existing.resourceUrl,
          remainingMinutes: calcRemainingMinutes(existing.expiresAt, now),
          expiresAt: existing.expiresAt.toISOString(),
          reused: true
        };
      }

      // 云端已回收：旧单标记异常后走新建
      await endSessionRecord({
        docId: existing._id,
        openTime: existing.openTime,
        closeReason: 'error',
        now
      });
    } else {
      // 到达时长上限：关云端、旧单标记到期后走新建
      await closeCloudBrowserSession(existing.cloudSessionId);
      await endSessionRecord({
        docId: existing._id,
        openTime: existing.openTime,
        closeReason: 'timeout',
        now
      });
    }
  }

  const cloud = await createCloudBrowserSession(viewport);
  const expiresAt = new Date(now.getTime() + MAX_SESSION_MS);

  try {
    await MongoBuiltinBrowserSessions.insertOne({
      teamId,
      tmbId,
      cloudSessionId: cloud.cloudSessionId,
      resourceUrl: cloud.resourceUrl,
      status: 'active',
      openTime: now,
      expiresAt,
      createTime: now,
      updateTime: now
    });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      // 并发双击：回收本次新建的云端会话，复用先写入的胜者
      await closeCloudBrowserSession(cloud.cloudSessionId);
      const winner = await MongoBuiltinBrowserSessions.findOne({ tmbId, status: 'active' }).lean();
      if (winner) {
        let winnerUrl = winner.resourceUrl;
        try {
          const refreshed = await refreshCloudBrowserSession(winner.cloudSessionId);
          if (refreshed?.resourceUrl) {
            winnerUrl = refreshed.resourceUrl;
          }
        } catch {
          // 沿用胜者已记录地址
        }
        if (viewport) {
          await resizeCloudBrowserSession(winner.cloudSessionId, viewport);
        }
        return {
          resourceUrl: winnerUrl,
          remainingMinutes: calcRemainingMinutes(winner.expiresAt, now),
          expiresAt: winner.expiresAt.toISOString(),
          reused: true
        };
      }
      throw new Error('开台失败，请稍后重试');
    }
    throw error;
  }

  return {
    resourceUrl: cloud.resourceUrl,
    remainingMinutes: calcRemainingMinutes(expiresAt, now),
    expiresAt: expiresAt.toISOString(),
    reused: false
  };
};

/** 查询当前会话：到期时请求内即时兜底关台，再返回 active=false */
export const getSessionStatus = async ({
  tmbId,
  now = new Date()
}: {
  tmbId: string;
  now?: Date;
}): Promise<GetBuiltinBrowserSessionStatusResponse> => {
  const doc = await MongoBuiltinBrowserSessions.findOne({ tmbId, status: 'active' }).lean();
  if (!doc) {
    return { active: false };
  }
  if (doc.expiresAt.getTime() <= now.getTime()) {
    await closeCloudBrowserSession(doc.cloudSessionId);
    await endSessionRecord({
      docId: doc._id,
      openTime: doc.openTime,
      closeReason: 'timeout',
      now
    });
    return { active: false };
  }
  return {
    active: true,
    resourceUrl: doc.resourceUrl,
    remainingMinutes: calcRemainingMinutes(doc.expiresAt, now),
    expiresAt: doc.expiresAt.toISOString()
  };
};

/** 视口跟随：面板尺寸变化后让云端画面重新贴合；无会话/已过期/云端失败均静默 resized=false */
export const resizeSession = async ({
  tmbId,
  viewport,
  now = new Date()
}: {
  tmbId: string;
  viewport: BuiltinBrowserViewport;
  now?: Date;
}): Promise<ResizeBuiltinBrowserSessionResponse> => {
  const doc = await MongoBuiltinBrowserSessions.findOne({ tmbId, status: 'active' }).lean();
  if (!doc || doc.expiresAt.getTime() <= now.getTime()) {
    return { resized: false };
  }
  const resized = await resizeCloudBrowserSession(doc.cloudSessionId, viewport);
  return { resized };
};

/** 网址跳转：面板网址栏请求云端浏览器导航到指定网址；
 * 网址非法 / 无进行中会话 / 已过期 / 云端失败均返回 navigated=false（前端提示，不上抛） */
export const navigateSession = async ({
  tmbId,
  url,
  now = new Date()
}: {
  tmbId: string;
  url: string;
  now?: Date;
}): Promise<NavigateBuiltinBrowserSessionResponse> => {
  const target = normalizeBuiltinBrowserUrl(url);
  if (!target) {
    return { navigated: false };
  }
  const doc = await MongoBuiltinBrowserSessions.findOne({ tmbId, status: 'active' }).lean();
  if (!doc || doc.expiresAt.getTime() <= now.getTime()) {
    return { navigated: false };
  }
  const navigated = await navigateCloudBrowserSession(doc.cloudSessionId, target);
  return { navigated };
};

/** 网页原地刷新：在当前标签重新打开同一网址，不重建查看器；无会话/已过期/云端失败均返回 reloaded=false */
export const reloadSession = async ({
  tmbId,
  now = new Date()
}: {
  tmbId: string;
  now?: Date;
}): Promise<ReloadBuiltinBrowserSessionResponse> => {
  const doc = await findActiveSession(tmbId, now);
  if (!doc) {
    return { reloaded: false };
  }
  const reloaded = await reloadCloudBrowserSession(doc.cloudSessionId);
  return { reloaded };
};

/** 关台（幂等）：无进行中会话返回 closed=false */
export const closeSession = async ({
  tmbId,
  now = new Date()
}: {
  tmbId: string;
  now?: Date;
}): Promise<CloseBuiltinBrowserSessionResponse> => {
  const doc = await MongoBuiltinBrowserSessions.findOne({ tmbId, status: 'active' }).lean();
  if (!doc) {
    return { closed: false };
  }
  await closeCloudBrowserSession(doc.cloudSessionId);
  await endSessionRecord({
    docId: doc._id,
    openTime: doc.openTime,
    closeReason: 'user',
    now
  });
  return {
    closed: true,
    durationMinutes: calcDurationMinutes(now.getTime() - doc.openTime.getTime())
  };
};

/** 标签页列表：无进行中会话/云端失败均返回空列表（前端静默） */
export const getTabsSession = async ({
  tmbId,
  now = new Date()
}: {
  tmbId: string;
  now?: Date;
}): Promise<GetBuiltinBrowserTabsResponse> => {
  const doc = await findActiveSession(tmbId, now);
  if (!doc) {
    return { tabs: [] };
  }
  const tabs = await listCloudBrowserTabs(doc.cloudSessionId);
  return { tabs: tabs ?? [] };
};

/** 新建标签（云端自动选中空白页）：无会话/失败返回空列表 */
export const newTabSession = async ({
  tmbId,
  now = new Date()
}: {
  tmbId: string;
  now?: Date;
}): Promise<NewBuiltinBrowserTabResponse> => {
  const doc = await findActiveSession(tmbId, now);
  if (!doc) {
    return { tabs: [] };
  }
  const tabs = await newCloudBrowserTab(doc.cloudSessionId);
  return { tabs: tabs ?? [] };
};

/** 切换标签：非法索引（含隐藏占位 0）直接拒绝，不触碰云端 */
export const selectTabSession = async ({
  tmbId,
  index,
  now = new Date()
}: {
  tmbId: string;
  index: number;
  now?: Date;
}): Promise<SelectBuiltinBrowserTabResponse> => {
  if (!isValidTabIndex(index)) {
    return { selected: false, tabs: [] };
  }
  const doc = await findActiveSession(tmbId, now);
  if (!doc) {
    return { selected: false, tabs: [] };
  }
  const selected = await selectCloudBrowserTab(doc.cloudSessionId, index);
  const tabs = await listCloudBrowserTabs(doc.cloudSessionId);
  return { selected, tabs: tabs ?? [] };
};

/** 关闭标签：关掉最后一个用户标签时自动补一个空白标签，保证面板始终有可输入页面 */
export const closeTabSession = async ({
  tmbId,
  index,
  now = new Date()
}: {
  tmbId: string;
  index: number;
  now?: Date;
}): Promise<CloseBuiltinBrowserTabResponse> => {
  if (!isValidTabIndex(index)) {
    return { closed: false, tabs: [] };
  }
  const doc = await findActiveSession(tmbId, now);
  if (!doc) {
    return { closed: false, tabs: [] };
  }
  const closed = await closeCloudBrowserTab(doc.cloudSessionId, index);
  let tabs = (await listCloudBrowserTabs(doc.cloudSessionId)) ?? [];
  if (closed && tabs.length === 0) {
    tabs = (await newCloudBrowserTab(doc.cloudSessionId)) ?? [];
  }
  return { closed, tabs };
};

/** 到期巡检：关掉全部超时未关的云端会话并标记到期，返回处理条数 */
export const sweepOverdueSessions = async ({
  now = new Date()
}: { now?: Date } = {}): Promise<number> => {
  const overdue = await MongoBuiltinBrowserSessions.find({
    status: 'active',
    expiresAt: { $lte: now }
  }).lean();

  for (const doc of overdue) {
    await closeCloudBrowserSession(doc.cloudSessionId);
    await endSessionRecord({
      docId: doc._id,
      openTime: doc.openTime,
      closeReason: 'timeout',
      now
    });
  }
  return overdue.length;
};

let sweeperStarted = false;

/** 进程内到期巡检（路由首次调用时启动一次；不放在模块加载期，避免构建期副作用） */
export const ensureBuiltinBrowserSweeper = () => {
  if (sweeperStarted) return;
  sweeperStarted = true;
  const timer = setInterval(() => {
    sweepOverdueSessions().catch(() => {
      // 巡检失败下一轮自动重试
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
};

/** 灰度门槛：管理员直通；其余按用户名白名单放行，名单外给内测中文提示 */
export const assertBuiltinBrowserUser = async ({
  userId,
  isRoot
}: {
  userId: string;
  isRoot: boolean;
}): Promise<void> => {
  if (isRoot) return;
  const user = await MongoUser.findById(userId).lean();
  if (user && BUILTIN_BROWSER_ALLOWED_USERNAMES.includes(user.username)) return;
  throw new Error('该功能正在内测中，暂未对你开放');
};
