// 鲁港通 - 问题解析模块

import { ParsedQuestion } from './types';

// ============================================================
// 地点名称词典（口岸、地标、车站等常见地点）
// ============================================================

const LOCATION_ALIASES: Record<string, string[]> = {
  // 口岸
  '落马洲口岸': ['落马洲口岸', '落马洲', '落馬洲口岸', '落馬洲', 'lok ma chau'],
  '福田口岸': ['福田口岸', '福田', '落马洲支线', '落馬洲支線', 'futian'],
  '罗湖口岸': ['罗湖口岸', '罗湖', '羅湖口岸', '羅湖', 'lo wu'],
  '深圳湾口岸': ['深圳湾口岸', '深圳湾', '深圳灣口岸', '深圳灣', 'shenzhen bay'],
  '港珠澳大桥口岸': ['港珠澳大桥口岸', '港珠澳大桥', '港珠澳大橋口岸', '港珠澳大橋', 'hzmb'],
  '西九龙站': ['西九龙站', '西九龙', '西九龍站', '西九龍', 'west kowloon'],
  '莲塘口岸': ['莲塘口岸', '莲塘', '蓮塘口岸', '蓮塘', 'heung yuen wai'],

  // 地标
  '香港立法会': ['香港立法会', '立法会', '香港立法會', '立法會', 'legco', 'legislative council'],
  '维多利亚港': ['维多利亚港', '维港', '維多利亞港', '維港', 'victoria harbour'],
  '太平山顶': ['太平山顶', '山顶', '太平山頂', '山頂', 'the peak', 'victoria peak'],
  '星光大道': ['星光大道', '星光大道', 'avenue of stars'],
  '迪士尼乐园': ['迪士尼乐园', '迪士尼', '迪士尼樂園', 'disneyland'],
  '海洋公园': ['海洋公园', '海洋公園', 'ocean park'],
  '尖沙咀': ['尖沙咀', '尖沙嘴', 'tsim sha tsui', 'tst'],
  '旺角': ['旺角', 'mong kok'],
  '铜锣湾': ['铜锣湾', '銅鑼灣', 'causeway bay'],
  '中环': ['中环', '中環', 'central'],
  '金钟': ['金钟', '金鐘', 'admiralty'],
  '湾仔': ['湾仔', '灣仔', 'wan chai'],
  '北角': ['北角', 'north point'],
  '香港机场': ['香港机场', '机场', '香港機場', '機場', 'hong kong airport', 'hk airport'],
  '九龙塘': ['九龙塘', '九龍塘', 'kowloon tong'],
  '红磡': ['红磡', '紅磡', 'hung hom'],
  '沙田': ['沙田', 'sha tin'],
  '大埔': ['大埔', 'tai po'],
  '元朗': ['元朗', 'yuen long'],
  '屯门': ['屯门', '屯門', 'tuen mun'],
  '荃湾': ['荃湾', '荃灣', 'tsuen wan'],
  '将军澳': ['将军澳', '將軍澳', 'tseung kwan o'],
  '东涌': ['东涌', '東涌', 'tung chung'],
  '上水': ['上水', 'sheung shui'],
  '粉岭': ['粉岭', '粉嶺', 'fanling'],
};

/**
 * 构建地点名称到标准名称的映射（小写）
 */
function buildLocationMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(LOCATION_ALIASES)) {
    for (const alias of aliases) {
      map.set(alias.toLowerCase(), canonical);
    }
  }
  return map;
}

const LOCATION_MAP = buildLocationMap();


// ============================================================
// 交通方式关键词（繁简体中文 + 英文）
// ============================================================

const TRANSPORT_KEYWORDS: Record<string, string[]> = {
  bus: [
    '巴士', '公交', '公車', '公车', 'bus',
    '九巴', 'kmb', '城巴', 'ctb', '新巴', 'nwfb',
    '龙运', '龍運', 'lwb'
  ],
  mtr: [
    '地铁', '地鐵', '港铁', '港鐵', 'mtr', 'metro', 'subway',
    '东铁', '東鐵', '西铁', '西鐵', '荃湾线', '荃灣線',
    '观塘线', '觀塘線', '港岛线', '港島線', '将军澳线', '將軍澳線',
    '东涌线', '東涌線', '迪士尼线', '迪士尼線', '南港岛线', '南港島線',
    '屯马线', '屯馬線', '机场快线', '機場快線'
  ],
  gmb: [
    '小巴', '小巴士', 'minibus', 'gmb',
    '专线小巴', '專線小巴', 'green minibus'
  ],
  nlb: [
    '新大屿山巴士', '新大嶼山巴士', 'nlb',
    '大屿山巴士', '大嶼山巴士'
  ],
  ferry: [
    '渡轮', '渡輪', 'ferry', '天星小轮', '天星小輪', 'star ferry'
  ],
  tram: [
    '电车', '電車', 'tram', '叮叮', '叮叮车', '叮叮車'
  ]
};

// ============================================================
// 时间关键词
// ============================================================

const TIME_KEYWORDS: Record<string, string[]> = {
  now: ['现在', '現在', 'now', '马上', '馬上', '立刻', '即刻'],
  morning: ['早上', '上午', 'morning', '早晨', '朝早'],
  evening: ['晚上', '下午', 'evening', 'afternoon', '傍晚', '黄昏', '黃昏'],
  peak: ['高峰', '繁忙', 'peak', 'rush hour', '上班时间', '上班時間', '下班时间', '下班時間']
};

// ============================================================
// 地点名称提取
// ============================================================

/**
 * 使用正则表达式从用户问题中提取起点和终点
 */
export function extractLocations(question: string): { origin?: string; destination?: string } {
  const q = question.trim();

  // 模式1：从/從 A 到 B / 由 A 到 B / 由 A 去 B
  const zhPatterns = [
    /[从從]\s*(.+?)\s*到\s*(.+?)(?:\s*怎么走|\s*怎麼走|\s*怎么去|\s*怎麼去|\s*坐什么|\s*坐什麼|\s*搭什么|\s*搭什麼|\s*路线|\s*路線|\s*$)/,
    /由\s*(.+?)\s*(?:到|去)\s*(.+?)(?:\s*怎么走|\s*怎麼走|\s*怎么去|\s*怎麼去|\s*坐什么|\s*坐什麼|\s*搭什么|\s*搭什麼|\s*路线|\s*路線|\s*$)/,
  ];

  // 模式2：英文 from A to B
  const enPatterns = [
    /from\s+(.+?)\s+to\s+(.+?)(?:\s*$|\s*\?|\s+how|\s+by)/i,
  ];

  // 模式3：A 附近...到 B / A ...到 B（隐含起点）
  const implicitOriginPatterns = [
    /(.+?)(?:附近|那边|那邊|这边|這邊).+?(?:到|去)\s*(.+?)(?:\s*$|\s*\?)/,
  ];

  for (const pattern of implicitOriginPatterns) {
    const match = q.match(pattern);
    if (match) {
      const origin = resolveLocation(match[1].trim());
      const destination = resolveLocation(match[2].trim());
      if (origin || destination) {
        return { origin: origin || match[1].trim(), destination: destination || match[2].trim() };
      }
    }
  }

  // 模式4：去 B / 到 B（只有终点）
  const destOnlyPatterns = [
    /(?:去|到|想去|想到|要去|要到)\s*(.+?)(?:\s*怎么走|\s*怎麼走|\s*怎么去|\s*怎麼去|\s*$)/,
    /(?:how to get to|go to|get to)\s+(.+?)(?:\s*$|\s*\?)/i,
  ];

  // 尝试双地点模式
  for (const pattern of [...zhPatterns, ...enPatterns]) {
    const match = q.match(pattern);
    if (match) {
      const origin = resolveLocation(match[1].trim());
      const destination = resolveLocation(match[2].trim());
      if (origin || destination) {
        return { origin: origin || match[1].trim(), destination: destination || match[2].trim() };
      }
    }
  }

  // 尝试单终点模式
  for (const pattern of destOnlyPatterns) {
    const match = q.match(pattern);
    if (match) {
      const destination = resolveLocation(match[1].trim());
      if (destination) {
        return { destination };
      }
    }
  }

  // 最后尝试：在问题中搜索已知地点名称
  return extractKnownLocations(q);
}

/**
 * 将用户输入的地点名称解析为标准名称
 */
export function resolveLocation(input: string): string | undefined {
  const lower = input.toLowerCase();
  // 精确匹配
  if (LOCATION_MAP.has(lower)) {
    return LOCATION_MAP.get(lower);
  }
  // 包含匹配：检查输入是否包含某个已知地点
  for (const [alias, canonical] of LOCATION_MAP.entries()) {
    if (lower.includes(alias) || alias.includes(lower)) {
      return canonical;
    }
  }
  return undefined;
}

/**
 * 在问题文本中搜索已知地点名称
 */
function extractKnownLocations(question: string): { origin?: string; destination?: string } {
  const lower = question.toLowerCase();
  const found: string[] = [];

  // 按别名长度降序排列，优先匹配更长的名称
  const sortedAliases = Array.from(LOCATION_MAP.entries())
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, canonical] of sortedAliases) {
    if (lower.includes(alias) && !found.includes(canonical)) {
      found.push(canonical);
      if (found.length >= 2) break;
    }
  }

  if (found.length >= 2) {
    return { origin: found[0], destination: found[1] };
  } else if (found.length === 1) {
    return { destination: found[0] };
  }
  return {};
}

// ============================================================
// 交通偏好识别
// ============================================================

/**
 * 从用户问题中识别交通方式偏好
 */
export function extractTransportPreference(question: string): string[] {
  const lower = question.toLowerCase();
  const found: string[] = [];

  for (const [type, keywords] of Object.entries(TRANSPORT_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      found.push(type);
    }
  }

  return found;
}

// ============================================================
// 时间需求识别
// ============================================================

/**
 * 从用户问题中识别时间需求
 */
export function extractTimeRequirement(question: string): string {
  const lower = question.toLowerCase();

  for (const [time, keywords] of Object.entries(TIME_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return time;
    }
  }

  return 'now';
}

// ============================================================
// 主解析函数
// ============================================================

/**
 * 解析用户的自然语言交通问题
 */
export function parseQuestion(question: string, _language: string): ParsedQuestion {
  const locations = extractLocations(question);
  const transportPreference = extractTransportPreference(question);
  const timeRequirement = extractTimeRequirement(question);

  return {
    origin: locations.origin,
    destination: locations.destination,
    transportPreference: transportPreference.length > 0 ? transportPreference : undefined,
    timeRequirement,
    keywords: question.split(/[\s,，。.!！?？]+/).filter(Boolean)
  };
}
