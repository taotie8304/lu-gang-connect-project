// 鲁港通 - 办事浏览器云端会话封装（内置浏览器 P1）：唯一接触底层云浏览器 SDK 的模块，
// 对外只暴露白牌语义（会话 ID / 画面地址），不向业务层泄露底层服务商细节
import type { AgentBay } from 'wuying-agentbay-sdk';
import type {
  BuiltinBrowserTab,
  BuiltinBrowserViewport
} from '@fastgpt/global/support/builtinBrowser/type';
import { BUILTIN_BROWSER_HEIGHT_EXTRA_PX } from '@fastgpt/global/support/builtinBrowser/constant';

const NOT_CONFIGURED_MESSAGE = '办事浏览器服务未配置，请联系管理员开通';
const CLOUD_UNAVAILABLE_MESSAGE = '办事浏览器暂时不可用，请稍后再试';

const CLOUD_LABEL = 'lugang-builtin-browser';

/** 未传面板尺寸时的默认视口（与右栏面板默认宽 480 一致） */
const DEFAULT_VIEWPORT = { width: 480, height: 800 };

const VIEWPORT_WIDTH_MIN = 320;
const VIEWPORT_WIDTH_MAX = 1600;
const VIEWPORT_HEIGHT_MIN = 240;
const VIEWPORT_HEIGHT_MAX = 1400;

/** 云窗口外框与页面视口的固定差值（探针 probe32 实测 outer − inner = 10 × 100） */
const WINDOW_CHROME_WIDTH_PX = 10;
const WINDOW_CHROME_HEIGHT_PX = 100;

/** 隐藏占位标签：上游 select index 0 判定缺陷，用户标签统一从 1 开始 */
const HIDDEN_TAB_INDEX = 0;
const MAX_TAB_INDEX = 32;

/** 云端窗口几何存档：看门狗按此钉住窗口位置与尺寸 */
const WINDOW_GEOMETRY_FILE = '/tmp/lugang-wd-geom';

const RESIZE_RETRY_DELAY_MS = 400;
const VIEWPORT_TOLERANCE_PX = 1;

/** 鲁港通 - 云端调用超时与慢日志阈值（A1 卡死缓解）：
 * 慢调用不再无限挂起请求线程，超时后调用方立即按失败处理 */
const CLOUD_CALL_TIMEOUT_MS = 12_000;
const CLOUD_CALL_SLOW_MS = 2_000;
const WATCHDOG_COMMAND_TIMEOUT_MS = 8_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 云端调用超时 + 慢日志：超时按失败上抛（底层请求可能仍在继续，但不阻塞调用方） */
const withCloudTimeout = async <T>(
  label: string,
  task: () => Promise<T>,
  timeoutMs = CLOUD_CALL_TIMEOUT_MS
): Promise<T> => {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`云端调用超时（${label}），请稍后重试`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    const elapsed = Date.now() - startedAt;
    if (elapsed >= CLOUD_CALL_SLOW_MS) {
      console.warn(`[builtin-browser] slow cloud call: ${label} ${elapsed}ms`);
    }
  }
};

/** 开台分阶段耗时日志：线上定位「打开慢」卡在哪一步 */
const logOpenStage = (stage: string, startedAt: number) => {
  console.log(`[builtin-browser] open stage ${stage} ${Date.now() - startedAt}ms`);
};

/** 面板视口（CSS 像素）→ 云端页面视口：高度加余量让页面底缘落到裁切窗下缘之外
 *（前端按实测几何裁掉查看器外框，见 global 裁切常数），取整并夹取到合理范围 */
const toCloudViewport = (viewport?: BuiltinBrowserViewport) => {
  const width = Math.round(viewport?.width ?? DEFAULT_VIEWPORT.width);
  const height =
    Math.round(viewport?.height ?? DEFAULT_VIEWPORT.height) + BUILTIN_BROWSER_HEIGHT_EXTRA_PX;
  return {
    width: Math.min(VIEWPORT_WIDTH_MAX, Math.max(VIEWPORT_WIDTH_MIN, width)),
    height: Math.min(VIEWPORT_HEIGHT_MAX, Math.max(VIEWPORT_HEIGHT_MIN, height))
  };
};

/** 云端页面视口 → 云窗口外框：窗口比页面多出固定外框，面板加宽时窗口同步加宽，
 * 避免「页面变了窗口没变」导致画面右侧/底部露出桌面背景 */
const toCloudWindowSize = (viewport: { width: number; height: number }) => ({
  width: viewport.width + WINDOW_CHROME_WIDTH_PX,
  height: viewport.height + WINDOW_CHROME_HEIGHT_PX
});

type CloudSessionLike = {
  callMcpTool: (
    toolName: string,
    args?: Record<string, unknown>
  ) => Promise<{ success?: boolean; data?: unknown } | undefined>;
  command: { executeCommand: (cmd: string) => Promise<unknown> };
};

/** 带超时的会话查询：失败/超时返回 null（调用方按云端不可用处理） */
const getCloudSession = async (ab: AgentBay, cloudSessionId: string) => {
  try {
    const got = await withCloudTimeout(`ab.get ${cloudSessionId}`, () => ab.get(cloudSessionId));
    return got.success && got.session ? got.session : null;
  } catch {
    return null;
  }
};

/** 带超时的 MCP 工具调用：统一超时与慢日志口径 */
const callCloudTool = (
  session: CloudSessionLike,
  toolName: string,
  args?: Record<string, unknown>
) => withCloudTimeout(`callMcpTool ${toolName}`, () => session.callMcpTool(toolName, args));

/** 带超时的云端命令（看门狗/几何同步等兜底能力，失败静默由调用方处理） */
const runCloudCommand = (session: CloudSessionLike, label: string, command: string) =>
  withCloudTimeout(
    `executeCommand ${label}`,
    () => session.command.executeCommand(command),
    WATCHDOG_COMMAND_TIMEOUT_MS
  );

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

/** 鲁港通 - 钉窗看门狗脚本 v3：按几何存档把 playwright 窗口钉在 (10,10) 与指定尺寸；
 * 页面视口由 browser_resize 单独控制，两者同步后画面才能始终贴合面板
 *（纯 bash + wmctrl，base64 落盘规避转义） */
const WATCHDOG_SCRIPT = [
  '#!/bin/bash',
  '# 鲁港通 - 看门狗 v3：按 /tmp/lugang-wd-geom 钉住 playwright 窗口位置与尺寸',
  'while true; do',
  `  if read -r W H < ${WINDOW_GEOMETRY_FILE} 2>/dev/null && [ -n "$W" ] && [ -n "$H" ]; then`,
  "    for ID in $(wmctrl -lGx | grep -i playwright | awk '{print $1}'); do",
  '      wmctrl -i -r "$ID" -e 0,10,10,"$W","$H"',
  '    done',
  '  fi',
  '  sleep 0.5',
  'done',
  ''
].join('\n');

/** 幂等部署看门狗：停旧 → base64 落盘 → setsid 后台启动；
 * 失败静默（钉窗为兜底能力，不阻断开台） */
const deployWindowWatchdog = async (session: CloudSessionLike): Promise<void> => {
  try {
    const scriptBase64 = Buffer.from(WATCHDOG_SCRIPT, 'utf8').toString('base64');
    await runCloudCommand(
      session,
      'watchdog-stop',
      'for p in $(ps -eo pid,cmd | awk \'/[l]ugang-wd/ {print $1}\'); do kill "$p" 2>/dev/null; done'
    );
    await runCloudCommand(
      session,
      'watchdog-deploy',
      `echo '${scriptBase64}' | base64 -d > /tmp/lugang-wd.sh && chmod +x /tmp/lugang-wd.sh`
    );
    await runCloudCommand(
      session,
      'watchdog-start',
      'setsid nohup bash /tmp/lugang-wd.sh </dev/null >/dev/null 2>&1 & echo $! > /tmp/lugang-wd.pid'
    );
  } catch {
    // 静默：部署失败不阻断开台
  }
};

/** 同步云窗口外框：先更新看门狗几何存档，再立即应用到现有窗口；
 * 失败静默（看门狗与请求时校验仍会兜底） */
const syncWindowGeometry = async (
  session: CloudSessionLike,
  viewport: { width: number; height: number }
): Promise<void> => {
  try {
    const windowSize = toCloudWindowSize(viewport);
    await runCloudCommand(
      session,
      'geom-store',
      `printf '%s %s\\n' ${windowSize.width} ${windowSize.height} > ${WINDOW_GEOMETRY_FILE}.tmp && mv ${WINDOW_GEOMETRY_FILE}.tmp ${WINDOW_GEOMETRY_FILE}`
    );
    await runCloudCommand(
      session,
      'geom-apply',
      `for ID in $(wmctrl -lGx | grep -i playwright | awk '{print $1}'); do wmctrl -i -r "$ID" -e 0,10,10,${windowSize.width},${windowSize.height}; done`
    );
  } catch {
    // 静默：窗口贴合为兜底能力，不阻断 resize
  }
};

/** 读取云端页面实际视口：校验 resize 是否真正生效（工具返回成功但页面尺寸未跟上） */
const readPageViewport = async (
  session: CloudSessionLike
): Promise<{ width: number; height: number } | null> => {
  try {
    const result = await callCloudTool(session, 'browser_evaluate', {
      function: '() => JSON.stringify({ width: window.innerWidth, height: window.innerHeight })'
    });
    if (result?.success !== true) return null;
    const match = String(result.data ?? '').match(
      /\{\s*"width"\s*:\s*(\d+)\s*,\s*"height"\s*:\s*(\d+)\s*\}/
    );
    if (!match) return null;
    return { width: Number(match[1]), height: Number(match[2]) };
  } catch {
    return null;
  }
};

const viewportMatches = (
  actual: { width: number; height: number },
  target: { width: number; height: number }
) =>
  Math.abs(actual.width - target.width) <= VIEWPORT_TOLERANCE_PX &&
  Math.abs(actual.height - target.height) <= VIEWPORT_TOLERANCE_PX;

/** 应用页面视口：resize → 校验实际视口，不一致或失败补一次；随后同步窗口外框。
 * 校验工具不可用时以 resize 结果为准；全部失败静默返回 false */
const applyViewport = async (
  session: CloudSessionLike,
  target: { width: number; height: number }
): Promise<boolean> => {
  const resize = () =>
    callCloudTool(session, 'browser_resize', target)
      .then((result) => result?.success === true)
      .catch(() => false);

  let resized = await resize();
  let actual = await readPageViewport(session);
  if (!resized || (actual && !viewportMatches(actual, target))) {
    await delay(RESIZE_RETRY_DELAY_MS);
    resized = await resize();
    actual = await readPageViewport(session);
  }

  await syncWindowGeometry(session, target);
  return actual ? viewportMatches(actual, target) : resized;
};

/** 开台：创建云端浏览器会话并初始化到空白可用状态；初始化失败即回收并给通用提示 */
export const createCloudBrowserSession = async (
  viewport?: BuiltinBrowserViewport
): Promise<{
  cloudSessionId: string;
  resourceUrl: string;
}> => {
  const startedAt = Date.now();
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
  logOpenStage('created', startedAt);

  const session = created.session;
  const initialized = await session.browser.initializeAsync({}).catch(() => false);
  const resourceUrl = session.resourceUrl;
  if (!initialized || !resourceUrl) {
    await closeCloudBrowserSession(session.sessionId);
    throw new Error(CLOUD_UNAVAILABLE_MESSAGE);
  }
  logOpenStage('initialized', startedAt);

  // 鲁港通 - 空白起始页：连续两次新建标签，第 0 个作为隐藏占位（上游无法切到 index 0），
  // 第 1 个是用户可用的空白标签；用户自行输入网址，打开更快
  await callCloudTool(session, 'browser_tabs', { action: 'new' }).catch(() => undefined);
  await callCloudTool(session, 'browser_tabs', { action: 'new' }).catch(() => undefined);
  logOpenStage('tabs-ready', startedAt);

  // 鲁港通 - 视口适配与看门狗互不依赖，并行执行缩短开台等待（失败均静默）
  await Promise.all([
    applyViewport(session, toCloudViewport(viewport)),
    deployWindowWatchdog(session)
  ]);
  logOpenStage('viewport-watchdog', startedAt);

  return { cloudSessionId: session.sessionId, resourceUrl };
};

/** 视口跟随：把页面视口与云窗口外框一起调整到与面板一致；
 * 失败静默返回 false，不上抛 */
export const resizeCloudBrowserSession = async (
  cloudSessionId: string,
  viewport: BuiltinBrowserViewport
): Promise<boolean> => {
  try {
    const ab = await getClient();
    const session = await getCloudSession(ab, cloudSessionId);
    if (!session) {
      return false;
    }
    return await applyViewport(session, toCloudViewport(viewport));
  } catch {
    return false;
  }
};

/** 网址跳转：在现有会话内导航到指定网址（调用方须先归一化校验）；失败静默返回 false */
export const navigateCloudBrowserSession = async (
  cloudSessionId: string,
  url: string
): Promise<boolean> => {
  try {
    const ab = await getClient();
    const session = await getCloudSession(ab, cloudSessionId);
    if (!session) {
      return false;
    }
    const result = await callCloudTool(session, 'browser_navigate', { url });
    return result?.success === true;
  } catch {
    return false;
  }
};

/** 解析 browser_tabs 返回的 Markdown 文本（list / new 通用） */
export const parseCloudBrowserTabs = (text: string): BuiltinBrowserTab[] => {
  const tabs: BuiltinBrowserTab[] = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^-\s+(\d+):\s*(\(current\))?\s*\[(.*?)\]\s*\((.*)\)\s*$/);
    if (!match) continue;
    tabs.push({
      index: Number(match[1]),
      current: Boolean(match[2]),
      title: match[3].trim(),
      url: match[4].trim()
    });
  }
  return tabs;
};

/** 只保留用户标签（隐藏占位 index 0 不下发前端） */
const toVisibleTabs = (text: string) =>
  parseCloudBrowserTabs(text).filter((tab) => tab.index > HIDDEN_TAB_INDEX);

const isValidTabIndex = (index: number) =>
  Number.isInteger(index) && index > HIDDEN_TAB_INDEX && index <= MAX_TAB_INDEX;

/** 标签页列表：无会话/云端失败返回 null（调用方按空列表处理） */
export const listCloudBrowserTabs = async (
  cloudSessionId: string
): Promise<BuiltinBrowserTab[] | null> => {
  try {
    const ab = await getClient();
    const session = await getCloudSession(ab, cloudSessionId);
    if (!session) return null;
    const result = await callCloudTool(session, 'browser_tabs', { action: 'list' });
    if (result?.success !== true) return null;
    return toVisibleTabs(String(result.data ?? ''));
  } catch {
    return null;
  }
};

/** 新建标签（自动选中空白页）：返回最新用户标签；失败返回 null */
export const newCloudBrowserTab = async (
  cloudSessionId: string
): Promise<BuiltinBrowserTab[] | null> => {
  try {
    const ab = await getClient();
    const session = await getCloudSession(ab, cloudSessionId);
    if (!session) return null;
    const result = await callCloudTool(session, 'browser_tabs', { action: 'new' });
    if (result?.success !== true) return null;
    return toVisibleTabs(String(result.data ?? ''));
  } catch {
    return null;
  }
};

/** 切换标签：仅允许用户标签（index ≥ 1，绕开上游 index 0 缺陷）；失败返回 false */
export const selectCloudBrowserTab = async (
  cloudSessionId: string,
  index: number
): Promise<boolean> => {
  if (!isValidTabIndex(index)) return false;
  try {
    const ab = await getClient();
    const session = await getCloudSession(ab, cloudSessionId);
    if (!session) return false;
    const result = await callCloudTool(session, 'browser_tabs', { action: 'select', index });
    return result?.success === true;
  } catch {
    return false;
  }
};

/** 关闭标签：仅允许用户标签（index ≥ 1）；失败返回 false */
export const closeCloudBrowserTab = async (
  cloudSessionId: string,
  index: number
): Promise<boolean> => {
  if (!isValidTabIndex(index)) return false;
  try {
    const ab = await getClient();
    const session = await getCloudSession(ab, cloudSessionId);
    if (!session) return false;
    const result = await callCloudTool(session, 'browser_tabs', { action: 'close', index });
    return result?.success === true;
  } catch {
    return false;
  }
};

/** 网页原地刷新：重新导航到当前用户标签网址，不再重连查看器；空白页直接视为成功 */
export const reloadCloudBrowserSession = async (cloudSessionId: string): Promise<boolean> => {
  try {
    const ab = await getClient();
    const session = await getCloudSession(ab, cloudSessionId);
    if (!session) return false;
    const listed = await callCloudTool(session, 'browser_tabs', { action: 'list' });
    if (listed?.success !== true) return false;
    const current = toVisibleTabs(String(listed.data ?? '')).find((tab) => tab.current);
    if (!current) return false;
    // 鲁港通 - 空白页没有可刷新内容，直接返回成功，避免多余导航
    if (!current.url || current.url === 'about:blank') return true;
    const navigated = await callCloudTool(session, 'browser_navigate', { url: current.url });
    return navigated?.success === true;
  } catch {
    return false;
  }
};

/** 刷新画面地址：返回 null 表示云端会话已被回收（非临时故障，调用方据此重开） */
export const refreshCloudBrowserSession = async (
  cloudSessionId: string
): Promise<{ resourceUrl: string } | null> => {
  const ab = await getClient();
  // 鲁港通 - 此处超时/网络异常须上抛：调用方据此沿用旧地址，不能误判为「已回收」
  const got = await withCloudTimeout(`ab.get ${cloudSessionId}`, () => ab.get(cloudSessionId));
  if (!got.success || !got.session || !got.session.resourceUrl) {
    return null;
  }
  return { resourceUrl: got.session.resourceUrl };
};

/** 关台：尽力而为，任何失败都不上抛（云端到期会自行回收） */
export const closeCloudBrowserSession = async (cloudSessionId: string): Promise<void> => {
  try {
    const ab = await getClient();
    const session = await getCloudSession(ab, cloudSessionId);
    if (session) {
      await withCloudTimeout(`session.delete ${cloudSessionId}`, () => session.delete());
    }
  } catch {
    // 忽略：关台失败不影响用户侧体验
  }
};
