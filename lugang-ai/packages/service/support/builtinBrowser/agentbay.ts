// 鲁港通 - 办事浏览器云端会话封装（内置浏览器 P1）：唯一接触底层云浏览器 SDK 的模块，
// 对外只暴露白牌语义（会话 ID / 画面地址），不向业务层泄露底层服务商细节
import type { AgentBay } from 'wuying-agentbay-sdk';
import type { BuiltinBrowserViewport } from '@fastgpt/global/support/builtinBrowser/type';

const NOT_CONFIGURED_MESSAGE = '办事浏览器服务未配置，请联系管理员开通';
const CLOUD_UNAVAILABLE_MESSAGE = '办事浏览器暂时不可用，请稍后再试';

const CLOUD_LABEL = 'lugang-builtin-browser';

/** 起始页：香港政府一站通（实测自动落到简体「本港居民」主页） */
const START_URL = 'https://www.gov.hk/';

/** 未传面板尺寸时的默认视口（与右栏面板默认宽 480 一致） */
const DEFAULT_VIEWPORT = { width: 480, height: 800 };

const VIEWPORT_WIDTH_MIN = 320;
const VIEWPORT_WIDTH_MAX = 1600;
const VIEWPORT_HEIGHT_MIN = 240;
const VIEWPORT_HEIGHT_MAX = 1400;

/** 云窗口顶部为固定高度的标签栏+地址栏（约 77px），视口过高时底部会被查看器裁切；
 * 84 = UI 余量 77 + 安全边际 7（四角标记探针实测：减 84 后画面完整无裁切） */
const UI_CHROME_RESERVE_PX = 84;

/** 面板视口（CSS 像素）→ 云端窗口尺寸：取整、减去 UI 余量、夹取到合理范围 */
const toCloudViewport = (viewport?: BuiltinBrowserViewport) => {
  const width = Math.round(viewport?.width ?? DEFAULT_VIEWPORT.width);
  const height =
    Math.round(viewport?.height ?? DEFAULT_VIEWPORT.height) - UI_CHROME_RESERVE_PX;
  return {
    width: Math.min(VIEWPORT_WIDTH_MAX, Math.max(VIEWPORT_WIDTH_MIN, width)),
    height: Math.min(VIEWPORT_HEIGHT_MAX, Math.max(VIEWPORT_HEIGHT_MIN, height))
  };
};

let clientPromise: Promise<AgentBay> | null = null;

/** 懒加载 SDK 客户端单例：密钥缺失给可操作中文提示；日志级别收紧防鉴权地址外泄 */
const getClient = async (): Promise<AgentBay> => {
  const apiKey = process.env.AGENTBAY_API_KEY;
  if (!apiKey) {
    throw new Error(NOT_CONFIGURED_MESSAGE);
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      const { AgentBay, setLogLevel } = await import('wuying-agentbay-sdk');
      setLogLevel('ERROR');
      return new AgentBay({ apiKey });
    })().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
};

/** 是否已完成云端服务配置（路由门槛与前端提示用） */
export const isBuiltinBrowserConfigured = () => Boolean(process.env.AGENTBAY_API_KEY);

/** 开台：创建云端浏览器会话并初始化到可用状态；初始化失败即回收并给通用提示 */
export const createCloudBrowserSession = async (
  viewport?: BuiltinBrowserViewport
): Promise<{
  cloudSessionId: string;
  resourceUrl: string;
}> => {
  const ab = await getClient();
  const { CreateSessionParamsClass } = await import('wuying-agentbay-sdk');

  let created: Awaited<ReturnType<AgentBay['create']>>;
  try {
    created = await ab.create(
      new CreateSessionParamsClass({
        imageId: 'browser_latest',
        labels: { app: CLOUD_LABEL }
      })
    );
  } catch {
    throw new Error(CLOUD_UNAVAILABLE_MESSAGE);
  }
  if (!created.success || !created.session) {
    throw new Error(CLOUD_UNAVAILABLE_MESSAGE);
  }

  const session = created.session;
  const initialized = await session.browser.initializeAsync({}).catch(() => false);
  const resourceUrl = session.resourceUrl;
  if (!initialized || !resourceUrl) {
    await closeCloudBrowserSession(session.sessionId);
    throw new Error(CLOUD_UNAVAILABLE_MESSAGE);
  }

  // 鲁港通 - 全新会话直接调整窗口会报「无打开页面」，须先导航到起始页，再按面板尺寸适配；
  // 两步均为尽力而为，失败不阻断开台
  await session.callMcpTool('browser_navigate', { url: START_URL }).catch(() => undefined);
  await session.callMcpTool('browser_resize', toCloudViewport(viewport)).catch(() => undefined);

  return { cloudSessionId: session.sessionId, resourceUrl };
};

/** 视口跟随：把进行中会话的云窗口调整到与面板一致；失败静默返回 false，不上抛 */
export const resizeCloudBrowserSession = async (
  cloudSessionId: string,
  viewport: BuiltinBrowserViewport
): Promise<boolean> => {
  try {
    const ab = await getClient();
    const got = await ab.get(cloudSessionId);
    if (!got.success || !got.session) {
      return false;
    }
    const result = await got.session.callMcpTool('browser_resize', toCloudViewport(viewport));
    return result?.success === true;
  } catch {
    return false;
  }
};

/** 刷新画面地址：返回 null 表示云端会话已被回收（非临时故障，调用方据此重开） */
export const refreshCloudBrowserSession = async (
  cloudSessionId: string
): Promise<{ resourceUrl: string } | null> => {
  const ab = await getClient();
  const got = await ab.get(cloudSessionId);
  if (!got.success || !got.session || !got.session.resourceUrl) {
    return null;
  }
  return { resourceUrl: got.session.resourceUrl };
};

/** 关台：尽力而为，任何失败都不上抛（云端到期会自行回收） */
export const closeCloudBrowserSession = async (cloudSessionId: string): Promise<void> => {
  try {
    const ab = await getClient();
    const got = await ab.get(cloudSessionId);
    if (got.success && got.session) {
      await got.session.delete();
    }
  } catch {
    // 忽略：关台失败不影响用户侧体验
  }
};
