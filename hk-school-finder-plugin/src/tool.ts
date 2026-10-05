// 鲁港通 - 工具编排器：意图推断 → 数据获取（缓存/降级）→ 查询 → 格式化（来源标注/防重试）
// 依赖全部可注入（测试用 fixtures 桩）；生产入口见根目录 index.ts（SDK 薄封装）。
import { normalizeCjk } from './cjk';
import { getSource } from './config';
import { decodeBytes } from './decode';
import { createFetcher, type FetchBytes, type Fetcher } from './fetcher';
import {
  buildToolResult,
  formatDetail,
  formatList,
  formatNearby,
  formatNetPoa,
  formatNetSspaNet,
  formatNetSspaSchool,
  formatRegistration,
  formatSearch,
  formatStats,
  TIP_NO_RETRY_EMPTY,
  TIP_NO_RETRY_ERROR,
  TIP_STALE,
  type ToolResult,
} from './format';
import { resolveLocation } from './geocode';
import {
  enrichInput,
  inferIntent,
  isSchoolCountQuery,
  parseQueryText,
  type Intent,
  type ListType,
  type ParsedQuery,
  type ToolInput,
} from './router';
import {
  buildDetail,
  parseKgp,
  parsePsp,
  parseSsp,
  parseVacancy,
  type DetailSources,
} from './queries/detail';
import {
  filterKgSchemeByDistrict,
  filterNonAidedCccByDistrict,
  filterThroughTrainByDistrict,
  findDssFee,
  findK1NotJoining,
  findKgScheme,
  findNonAidedCcc,
  findThroughTrain,
  parseDssFee,
  parseK1NotJoining,
  parseKgScheme,
  parseNonAidedCcc,
  parseThroughTrain,
} from './queries/list';
import {
  findPoaByNet,
  findSspaByName,
  findSspaByNet,
  parsePoa,
  parseSspa,
  searchPoaByArea,
} from './queries/net';
import { queryNearbySchools } from './queries/nearby';
import {
  findRegistration,
  parseRegAccommodation,
  parseRegBasic,
  parseRegPremises,
} from './queries/registration';
import { matchCategoryWord, normalizeCategory, parseSchLoc, searchSchools } from './queries/search';
import { parseStudentStatsFromXlsx } from './queries/stats';

/** 生产缓存目录（插件容器 /tmp；测试注入临时目录） */
export const DEFAULT_CACHE_DIR = '/tmp/lugang-school-finder';

/** 编排依赖（测试注入桩；生产全部走默认实现） */
export interface ToolDeps {
  cacheDir?: string;
  fetchBytes?: FetchBytes;
  fetchJson?: (url: string) => Promise<unknown>;
  now?: () => number;
}

/** 取数过期标记（任一数据源降级旧缓存即记录，输出追加提示） */
interface StaleFlag {
  stale: boolean;
}

/**
 * 工具主入口：推断意图 → 执行 → 追加过期提示。
 * 所有异常收敛为可操作中文错误（error + 防重试 tips），不向模型抛裸栈。
 */
export async function runTool(input: ToolInput, deps: ToolDeps = {}): Promise<ToolResult> {
  // 鲁港通 - 原话兜底：仅 query 时先解析区域/级别并补齐（列表问法或纯区域级别词），再推断意图
  const enriched = enrichInput(input);
  const intent = inferIntent(enriched);
  if (!intent) return guidanceResult();

  const fetcher = createFetcher({
    cacheDir: deps.cacheDir ?? DEFAULT_CACHE_DIR,
    fetchBytes: deps.fetchBytes,
    now: deps.now,
  });
  const stale: StaleFlag = { stale: false };

  try {
    const result = await runIntent(intent, enriched, fetcher, stale, deps);
    if (stale.stale) result.tips.push(TIP_STALE);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return buildToolResult({
      summary: `香港学校资料查询未完成：${message}`,
      error: message,
      tips: [TIP_NO_RETRY_ERROR],
    });
  }
}

// ============================================================
// 数据获取（统一解码与过期标记；下载失败抛可操作中文错误由 runTool 收敛）
// ============================================================

async function loadText(sourceId: string, fetcher: Fetcher, stale: StaleFlag): Promise<string> {
  return decodeBytes(await loadBytes(sourceId, fetcher, stale));
}

async function loadBytes(sourceId: string, fetcher: Fetcher, stale: StaleFlag): Promise<Uint8Array> {
  const r = await fetcher.get(getSource(sourceId));
  if (r.stale) stale.stale = true;
  return r.data;
}

/** 可选源加载：失败返回 undefined（由 format 层以「官方数据未提供」标注，不编造） */
async function loadOptional<T>(load: () => Promise<T>): Promise<T | undefined> {
  try {
    return await load();
  } catch {
    return undefined;
  }
}

// ============================================================
// 意图分发（switch 穷尽七类意图）
// ============================================================

async function runIntent(
  intent: Intent,
  input: ToolInput,
  fetcher: Fetcher,
  stale: StaleFlag,
  deps: ToolDeps
): Promise<ToolResult> {
  switch (intent) {
    case 'nearby':
      return runNearby(input, fetcher, stale, deps);
    case 'search':
      return runSearch(input, fetcher, stale);
    case 'detail':
      return runDetail(input, fetcher, stale);
    case 'net':
      return runNet(input, fetcher, stale);
    case 'list':
      return runList(input, fetcher, stale);
    case 'stats':
      return runStats(input, fetcher, stale);
    case 'registration':
      return runRegistration(input, fetcher, stale);
  }
}

/** 附近学校：地点 → 坐标锚点（坐标文本/地标/18 区/校名兜底）→ 实时接口 → 格式化 */
async function runNearby(
  input: ToolInput,
  fetcher: Fetcher,
  stale: StaleFlag,
  deps: ToolDeps
): Promise<ToolResult> {
  const raw = (input.location ?? input.query ?? '').trim();
  if (!raw) return askFor('附近学校查询需要地点（如「尖沙咀」「沙田」或「纬度,经度」坐标）');

  let anchor = resolveLocation(raw);
  if (!anchor) {
    // 兜底：校名作锚点（需 SCH_LOC 全量记录；地标/区域未命中时才付出下载成本）
    const records = parseSchLoc(await loadText('sch_loc', fetcher, stale));
    anchor = resolveLocation(raw, records);
  }
  if (!anchor) {
    return buildToolResult({
      summary: `无法识别地点「${normalizeCjk(raw)}」。请提示用户改用 18 区区域名（如「沙田区」）、地标名（如「尖沙咀」），或直接提供「纬度,经度」坐标。`,
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }

  const schools = await queryNearbySchools({ anchor, level: input.level, fetchJson: deps.fetchJson });
  return formatNearby(schools, anchor.label);
}

/** 鲁港通 - 组合词条件解析：整句可拆为「区域/级别/办学类型」且剩余仅为类别修饰词时返回结构化条件
 * （如「油尖旺区直资中学」→ 区域+级别+直资；「喇沙书完」等校名类返回 undefined） */
function comboConditions(text: string): ToolInput | undefined {
  const parsed = parseQueryText(text);
  if (!parsed.district && !parsed.level && !parsed.category) return undefined;
  const catWord = matchCategoryWord(text)?.word;
  if (parsed.rest !== '' && (catWord === undefined || parsed.rest !== catWord)) return undefined;
  return { district: parsed.district, level: parsed.level, schoolCategory: parsed.category };
}

/** 学校搜索：校名关键词 / 区域 / 级别 / 办学类型（显式校名优先；query 已解析为条件时不再当校名） */
async function runSearch(input: ToolInput, fetcher: Fetcher, stale: StaleFlag): Promise<ToolResult> {
  const district = (input.district ?? '').trim();
  const category = normalizeCategory(input.schoolCategory ?? '');
  const rawQuery = (input.query ?? '').trim();
  // 鲁港通 - query 消耗判定：列表问法且解析出结构化条件时，整句按条件处理而非校名
  const parsedQ = rawQuery ? parseQueryText(rawQuery) : undefined;
  const consumed = Boolean(
    (input.schoolName ?? '').trim() === '' &&
      parsedQ !== undefined &&
      (parsedQ.district || parsedQ.level || parsedQ.category) &&
      (parsedQ.isListLike || parsedQ.rest === '')
  );
  const name = (input.schoolName ?? (consumed ? '' : rawQuery) ?? '').trim();
  if (!name && !district && input.level === undefined && !category) {
    return askFor('学校搜索需要校名关键词、区域、学校级别或办学类型（如「沙田区小学」「油尖旺区直资中学」）');
  }

  const records = parseSchLoc(await loadText('sch_loc', fetcher, stale));
  const result = searchSchools(records, {
    name: name || undefined,
    district: district || undefined,
    level: input.level,
    category,
  });
  // 鲁港通 - 组合词兜底：校名关键词无命中且整句可拆为「区域+类别+级别」时，按条件列表重查
  if (name && result.total === 0) {
    const combo = comboConditions(name);
    if (combo) {
      return runSearch(
        {
          district: district || combo.district,
          level: input.level ?? combo.level,
          schoolCategory: (input.schoolCategory ?? '').trim() || combo.schoolCategory,
        },
        fetcher,
        stale
      );
    }
  }
  return formatSearch(result, {
    name: name || undefined,
    district: district || undefined,
    level: input.level,
    category,
  });
}

/** 学校档案：精确校名（SCH_LOC）→ 未精确时按搜索候选给出；按级别挂载概览源（单源失败降级） */
async function runDetail(input: ToolInput, fetcher: Fetcher, stale: StaleFlag): Promise<ToolResult> {
  const name = (input.schoolName ?? input.query ?? '').trim();
  if (!name) return askFor('学校档案查询需要校名（如「喇沙书院」）');

  const records = parseSchLoc(await loadText('sch_loc', fetcher, stale));
  const norm = normalizeCjk(name);
  const lower = name.toLowerCase();
  let record = records.find(
    (r) => r.nameSimp === norm || (r.nameEn !== '' && r.nameEn.toLowerCase() === lower)
  );

  if (!record) {
    const search = searchSchools(records, { name, level: input.level });
    if (search.total !== 1) {
      // 鲁港通 - 组合词兜底：「油尖旺区直资中学」等「区域+类别+级别」组合词不是校名，转学校列表
      const combo = comboConditions(name);
      if (combo) return runSearch(combo, fetcher, stale);
      // 否则给候选列表（不替用户猜学校）
      return formatSearch(search, { name });
    }
    record = search.items[0];
  }

  // 按级别加载概览源；单源失败以 missing 标注（不编造、不影响主档案）
  const sources: DetailSources = {};
  if (record.level === 'kg') {
    sources.kgp = await loadOptional(async () => parseKgp(await loadText('kgp', fetcher, stale)));
    sources.vacancy = await loadOptional(async () =>
      parseVacancy(await loadText('k1k3_vacancy', fetcher, stale))
    );
  } else if (record.level === 'primary') {
    sources.psp = await loadOptional(async () => parsePsp(await loadText('psp', fetcher, stale)));
  } else if (record.level === 'secondary') {
    sources.ssp = await loadOptional(async () => parseSsp(await loadText('ssp', fetcher, stale)));
  }
  return formatDetail(buildDetail(record, sources));
}

/** 校网：poa（按区域/网编号）/ sspa（按校名/网编号） */
async function runNet(input: ToolInput, fetcher: Fetcher, stale: StaleFlag): Promise<ToolResult> {
  const type = input.netType ?? (input.schoolName ? 'sspa' : undefined);

  if (type === 'poa') {
    const raw = (input.district ?? input.query ?? input.location ?? '').trim();
    if (!raw) return askFor('小一校网查询需要区域名（如「沙田区」）或网编号（如「95」）');
    const list = parsePoa(await loadText('poa', fetcher, stale));
    if (/^\d{1,2}$/.test(raw)) {
      const hit = findPoaByNet(list, raw);
      return formatNetPoa(hit ? [hit] : [], raw);
    }
    return formatNetPoa(searchPoaByArea(list, raw), raw);
  }

  if (type === 'sspa') {
    const name = (input.schoolName ?? '').trim();
    const list = parseSspa(await loadText('sspa', fetcher, stale));
    if (name) return formatNetSspaSchool(findSspaByName(list, name), name);

    const raw = (input.query ?? '').trim();
    const token = /(?:HK|KL|NT)\s*\d/i.exec(raw);
    if (token) {
      const net = token[0].replace(/\s+/g, '').toUpperCase();
      return formatNetSspaNet(findSspaByNet(list, net), net);
    }
    if (raw) return formatNetSspaSchool(findSspaByName(list, raw), raw);
    return askFor('中学派位校网查询需要校名（如「喇沙书院」）或校网编号（如「HK1」）');
  }

  return askFor('校网查询需要说明类型：小一学校网（poa）或中学派位校网（sspa）');
}

/** 名单来源映射（五类 listType → 数据源 id） */
const LIST_SOURCE_ID: Record<ListType, string> = {
  through_train: 'through_train',
  dss_fee: 'dss_fee',
  kg_scheme: 'kg_scheme',
  k1_not_joining: 'k1_not_joining',
  non_aided_ccc: 'non_aided_ccc',
};

/** 鲁港通 - 名单类型兜底识别（原话关键词 → listType；仅在未显式传 listType 时使用） */
const LIST_TYPE_TRIGGERS: ReadonlyArray<readonly [RegExp, ListType]> = [
  [/一条龙/, 'through_train'],
  [/k1\s*收生|收生安排/, 'k1_not_joining'],
  [/非资助.*幼儿中心|附设.*幼儿中心/, 'non_aided_ccc'],
  [/免费优质|幼稚园教育计划|学券/, 'kg_scheme'],
  [/直资.*学费|学费表|收费表/, 'dss_fee'],
];

function inferListTypeFromText(text: string): ListType | undefined {
  const s = normalizeCjk((text ?? '').trim());
  if (!s) return undefined;
  for (const [re, type] of LIST_TYPE_TRIGGERS) if (re.test(s)) return type;
  return undefined;
}

/** 鲁港通 - 学费语义信号（原话含学费/收费字样时，dss_fee 名单逻辑优先，不做列校纠偏） */
const FEE_WORD_RE = /学费|收費|收费/;

/**
 * 鲁港通 - 名单纠偏判定：原话是否为「区域/级别/办学类型」清单问法（与 enrichInput 补齐口径一致）。
 * 用于模型误把「某区有哪些直资中学」映射为 dss_fee（直资学费名单）时降级为学校列表。
 */
function isConditionListQuery(parsed: ParsedQuery | undefined): boolean {
  if (!parsed) return false;
  if (!(parsed.isListLike || parsed.rest === '')) return false;
  return Boolean(parsed.district || parsed.level || parsed.category);
}

/** 名单查询：按类型取源 → 校名或区域过滤（不支持区域的类型给明确提示；未给类型时先兜底识别/降级列校） */
async function runList(input: ToolInput, fetcher: Fetcher, stale: StaleFlag): Promise<ToolResult> {
  // 鲁港通 - 未给名单类型：先从原话兜底识别；识别不到且问的是「区域/级别/办学类型」学校列表时降级搜索
  const rawQuery = (input.query ?? '').trim();
  const inferred = input.listType ?? inferListTypeFromText(rawQuery);
  if (!inferred) {
    const parsed = rawQuery ? parseQueryText(rawQuery) : undefined;
    if (parsed && (parsed.district || parsed.level || parsed.category)) {
      return runSearch(input, fetcher, stale);
    }
    return askFor(
      '未能确定名单类型（一条龙 / 直资学费 / 免费幼教计划 / K1 非计划 / 附设幼儿中心）；若为普通列校问题请补充区域/级别/办学类型'
    );
  }
  const type = inferred;

  // 鲁港通 - 列表问法/可解析条件的原话不作为校名（避免「沙田区有哪些小学」被当校名查找）
  const parsedQ = rawQuery ? parseQueryText(rawQuery) : undefined;
  const queryIsName =
    parsedQ === undefined ||
    (!parsedQ.isListLike && !parsedQ.district && !parsedQ.level && !parsedQ.category);
  const name = (input.schoolName ?? (queryIsName ? rawQuery : '') ?? '').trim();
  const district = (input.district ?? '').trim();
  const text = await loadText(LIST_SOURCE_ID[type], fetcher, stale);

  switch (type) {
    case 'through_train': {
      const list = parseThroughTrain(text);
      if (name) return formatList({ type, queryName: name, records: findThroughTrain(list, name) });
      if (district) return formatList({ type, district, records: filterThroughTrainByDistrict(list, district) });
      return askFor('一条龙名单查询需要校名或区域（如「沙田」）');
    }
    case 'dss_fee': {
      // 鲁港通 - 纠偏：模型可能把「某区有哪些直资中学」误传为 dss_fee 名单；
      // 原话为「区域/级别/类别」清单问法（非学费语义）且无校名时，降级为学校列表（一问即答）
      if (!name && !FEE_WORD_RE.test(normalizeCjk(rawQuery)) && isConditionListQuery(parsedQ)) {
        return runSearch(input, fetcher, stale);
      }
      const list = parseDssFee(text);
      if (name) return formatList({ type, queryName: name, records: findDssFee(list, name) });
      return askFor('直资学费查询需要校名（该名单不支持按区域筛选）');
    }
    case 'kg_scheme': {
      const list = parseKgScheme(text);
      if (name) return formatList({ type, queryName: name, records: findKgScheme(list, name) });
      if (district) return formatList({ type, district, records: filterKgSchemeByDistrict(list, district) });
      return askFor('幼教计划名单查询需要校名或区域（如「沙田」）');
    }
    case 'k1_not_joining': {
      const list = parseK1NotJoining(text);
      if (name) return formatList({ type, queryName: name, records: findK1NotJoining(list, name) });
      return askFor('K1 收生安排名单查询需要校名（该名单不支持按区域筛选）');
    }
    case 'non_aided_ccc': {
      const list = parseNonAidedCcc(text);
      if (name) return formatList({ type, queryName: name, records: findNonAidedCcc(list, name) });
      if (district) return formatList({ type, district, records: filterNonAidedCccByDistrict(list, district) });
      return askFor('附设幼儿中心查询需要校名或地区（如「荃湾」）');
    }
  }
}

/** 统计：学校数量问法（「有多少所 XX 学校」）→ 转搜索；否则学生人数统计（官方 XLSX「表3(b)」） */
async function runStats(input: ToolInput, fetcher: Fetcher, stale: StaleFlag): Promise<ToolResult> {
  const raw = (input.query ?? '').trim();
  // 鲁港通 - 数量分流：人数信号词已在 isSchoolCountQuery 内排除，「有多少所小学」不再误答学生人数
  if (raw && isSchoolCountQuery(raw)) return runSearch(input, fetcher, stale);
  const bytes = await loadBytes('tab0407', fetcher, stale);
  const stats = parseStudentStatsFromXlsx(bytes);
  const zone = (input.district ?? input.query ?? '').trim();
  return formatStats(stats, zone ? { zone } : { compare: true });
}

/** 注册资料：XML 三件套并行下载 → 解析 → 按校名聚合 */
async function runRegistration(input: ToolInput, fetcher: Fetcher, stale: StaleFlag): Promise<ToolResult> {
  const name = (input.schoolName ?? input.query ?? '').trim();
  if (!name) return askFor('注册资料查询需要校名（如「喇沙书院」）');

  const [basicXml, premisesXml, roomsXml] = await Promise.all([
    loadText('reg_basic', fetcher, stale),
    loadText('reg_premises', fetcher, stale),
    loadText('reg_accommodation', fetcher, stale),
  ]);
  const result = findRegistration(
    parseRegBasic(basicXml),
    parseRegPremises(premisesXml),
    parseRegAccommodation(roomsXml),
    name
  );
  return formatRegistration(result, name);
}

// ============================================================
// 参数不足 / 无法推断的追问文案（非最终结果，不加「防重试」措辞）
// ============================================================

function askFor(detail: string): ToolResult {
  return buildToolResult({
    summary: `查询信息不足：${detail}。请向用户补充询问后再调用本工具。`,
    tips: ['请先与用户确认具体查询对象后重新调用。'],
  });
}

function guidanceResult(): ToolResult {
  return buildToolResult({
    summary:
      '未能确定查询类型。请补充查询信息：校名（如「喇沙书院」）、区域+学校级别（如「沙田区小学」）、' +
      '地点（如「尖沙咀」附近）、名单类型（一条龙 / 直资学费 / 幼教计划 / K1 非计划 / 附设幼儿中心）、' +
      '校网（poa / sspa）或统计区域。',
    tips: ['请先与用户确认查询对象后重新调用。'],
  });
}
