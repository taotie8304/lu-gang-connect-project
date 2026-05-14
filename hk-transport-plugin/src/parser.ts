// 鲁港通 - 问题解析模块

import { ParsedQuestion } from './types';
import { findKnownLocationsInText } from './stop-db';

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

  // 地标 / 商圈 / 景点
  '香港立法会': ['香港立法会', '立法会', '香港立法會', '立法會', 'legco', 'legislative council'],
  '维多利亚港': ['维多利亚港', '维港', '維多利亞港', '維港', 'victoria harbour'],
  '太平山顶': ['太平山顶', '山顶', '太平山頂', '山頂', 'the peak', 'victoria peak'],
  '星光大道': ['星光大道', '星光大道', 'avenue of stars'],
  '海港城': ['海港城', 'harbour city', 'harbor city'],
  '时代广场': ['时代广场', '時代廣場', 'times square'],
  '太古广场': ['太古广场', '太古廣場', 'pacific place'],
  '朗豪坊': ['朗豪坊', 'langham place'],
  '又一城': ['又一城', 'festival walk'],
  '兰桂坊': ['兰桂坊', '蘭桂坊', 'lan kwai fong', 'lankwai fong'],
  '庙街': ['庙街', '廟街', 'temple street'],
  '女人街': ['女人街', 'ladies market', 'ladies street'],
  '香港大学': ['香港大学', '香港大學', '港大', 'hku'],

  // 港岛区
  '尖沙咀': ['尖沙咀', '尖沙嘴', 'tsim sha tsui', 'tst', '尖沙咀站', '尖沙咀地铁站', '尖沙咀地鐵站', '尖沙咀巴士站', '尖沙嘴站'],
  '铜锣湾': ['铜锣湾', '銅鑼灣', 'causeway bay', '铜锣湾站', '铜锣湾地铁站', '銅鑼灣站', '銅鑼灣地鐵站', 'causeway bay station'],
  '中环': ['中环', '中環', 'central', '中环站', '中环地铁站', '中環站', '中環地鐵站', 'central station'],
  '金钟': ['金钟', '金鐘', 'admiralty', '金钟站', '金钟地铁站', '金鐘站', '金鐘地鐵站', 'admiralty station'],
  '湾仔': ['湾仔', '灣仔', 'wan chai'],
  '北角': ['北角', 'north point'],
  '香港机场': ['香港机场', '机场', '香港機場', '機場', 'hong kong airport', 'hk airport', 'airport station', '机场站', '机场地铁站', '機場站', '機場地鐵站'],

  // 九龙区
  '旺角': ['旺角', 'mong kok', '旺角站', '旺角地铁站', '旺角地鐵站', 'mong kok station'],
  '九龙塘': ['九龙塘', '九龍塘', 'kowloon tong', '九龙塘站', '九龙塘地铁站', '九龍塘站', '九龍塘地鐵站'],
  '红磡': ['红磡', '紅磡', 'hung hom', '红磡站', '红磡地铁站', '紅磡站', '紅磡地鐵站', 'hung hom station'],
  '油麻地': ['油麻地', '油麻地', '油蔴地', 'yaumatei', 'yau ma tei'],
  '佐敦': ['佐敦', 'jordan'],
  '深水埗': ['深水埗', 'sham shui po', 'ssp'],
  '太子': ['太子', 'prince edward'],
  '观塘': ['观塘', '觀塘', 'kwun tong', '观塘站', '观塘地铁站', '觀塘站', '觀塘地鐵站'],
  '黄大仙': ['黄大仙', '黃大仙', 'wong tai sin'],

  // 新界区
  '沙田': ['沙田', 'sha tin', '沙田站', '沙田地鐵站', 'sha tin station'],
  '大埔': ['大埔', 'tai po', '大埔站', '大埔墟站', '大埔墟地鐵站'],
  '元朗': ['元朗', 'yuen long', '元朗站', '元朗地鐵站', 'yuen long station'],
  '屯门': ['屯门', '屯門', 'tuen mun', '屯门站', '屯门地铁站', '屯門站', '屯門地鐵站'],
  '荃湾': ['荃湾', '荃灣', 'tsuen wan', '荃湾站', '荃湾地铁站', '荃灣站', '荃灣地鐵站'],
  '将军澳': ['将军澳', '將軍澳', 'tseung kwan o', '将军澳站', '将军澳地铁站', '將軍澳站', '將軍澳地鐵站'],
  '上水': ['上水', 'sheung shui', '上水站', '上水地鐵站', 'sheung shui station'],
  '粉岭': ['粉岭', '粉嶺', 'fanling', '粉岭站', '粉岭地鐵站', '粉嶺站', '粉嶺地鐵站'],
  '西贡': ['西贡', '西貢', 'sai kung'],

  // 离岛区
  '东涌': ['东涌', '東涌', 'tung chung', '东涌站', '东涌地铁站', '東涌站', '東涌地鐵站', 'tung chung station'],
  '赤柱': ['赤柱', 'stanley'],
  '浅水湾': ['浅水湾', '淺水灣', 'repulse bay'],
  '大屿山': ['大屿山', '大嶼山', 'lantau'],
  '梅窝': ['梅窝', '梅窩', 'mui wo'],
  '坪洲': ['坪洲', 'peng chau'],
  '长洲': ['长洲', '長洲', 'cheung chau'],
  '南丫岛': ['南丫岛', '南丫島', 'lamma island'],

  // 新界东 / 沙田区
  '石门': ['石门', '石門', 'shek mun', '石门站', '石門站', '石门地铁站', '石門地鐵站', '石门巴士站', '石門巴士站', '石门巴士总站', '石門巴士總站', 'shek mun station'],
  '硕门邨': ['硕门邨', '硕门', '碩門邨', '碩門', '碩門邨'],
  '马鞍山': ['马鞍山', '馬鞍山', 'ma on shan'],
  '大围': ['大围', '大圍', 'tai wai', '大围站', '大围地铁站', '大圍站', '大圍地鐵站'],
  '火炭': ['火炭', 'fo tan', '火炭站', '火炭地鐵站'],
  '第一城': ['第一城', 'city one'],
  '白石角': ['白石角', 'pak shek kok'],
  '科学园': ['科学园', '科學園', 'science park'],

  // 屯门 / 元朗区
  '屯门码头': ['屯门码头', '屯門碼頭', 'tuen mun pier'],
  '天水围': ['天水围', '天水圍', 'tin shui wai'],
  '洪水桥': ['洪水桥', '洪水橋', 'hung shui kiu'],
  '锦田': ['锦田', '錦田', 'kam tin'],
  '流浮山': ['流浮山', 'lau fau shan'],
  '兆康': ['兆康', 'siu hong'],
  '朗屏': ['朗屏', 'long ping'],

  // 葵青区 / 荃湾区
  '青衣': ['青衣', 'tsing yi', '青衣站', '青衣地鐵站', 'tsing yi station'],
  '葵涌': ['葵涌', 'kwai chung'],
  '葵芳': ['葵芳', 'kwai fong'],
  '荔景': ['荔景', 'lai king', '荔景站', '荔景地鐵站'],
  '大窝口': ['大窝口', '大窩口', 'tai wo hau'],
  '深井': ['深井', 'sham tseng'],

  // 离岛补充
  '逸东邨': ['逸东邨', '逸东', '逸東邨', '逸東', 'yat tung'],
  '东荟城': ['东荟城', '東薈城', 'citygate'],
  '机场': ['机场', '機場', 'airport'],
  '博览馆': ['博览馆', '博覽館', 'asiaworld-expo'],
  '欣澳': ['欣澳', 'sunny bay', '欣澳站', '欣澳地鐵站', 'sunny bay station'],

  // 九龙东 / 新九龙
  '九龙湾': ['九龙湾', '九龍灣', 'kowloon bay', '九龙湾站', '九龙湾地铁站', '九龍灣站', '九龍灣地鐵站'],
  '牛头角': ['牛头角', '牛頭角', 'ngau tau kok'],
  '蓝田': ['蓝田', '藍田', 'lam tin', '蓝田站', '蓝田地鐵站', '藍田站'],
  '油塘': ['油塘', 'yau tong', '油塘站', '油塘地鐵站'],
  '调景岭': ['调景岭', '調景嶺', 'tiu keng leng', '调景岭站', '调景岭地铁站', '調景嶺站', '調景嶺地鐵站'],
  '坑口': ['坑口', 'hang hau', '坑口站', '坑口地鐵站'],
  '宝琳': ['宝琳', '寶琳', 'po lam', '宝琳站', '宝琳地鐵站', '寶琳站'],
  '康城': ['康城', 'lohas park'],
  '启德': ['启德', '啟德', 'kai tak'],
  '彩虹': ['彩虹', 'choi hung', '彩虹站', '彩虹地鐵站'],
  '钻石山': ['钻石山', '鑽石山', 'diamond hill', '钻石山站', '钻石山地铁站', '鑽石山站', '鑽石山地鐵站'],

  // 九龙西补充
  '九龙城': ['九龙城', '九龍城', 'kowloon city'],
  '土瓜湾': ['土瓜湾', '土瓜灣', 'to kwa wan'],
  '何文田': ['何文田', 'ho man tin'],
  '黄埔': ['黄埔', '黃埔', 'whampoa'],
  '柯士甸': ['柯士甸', 'austin'],
  '奥运': ['奥运', '奧運', 'olympic'],
  '南昌': ['南昌', 'nam cheong'],
  '长沙湾': ['长沙湾', '長沙灣', 'cheung sha wan'],
  '石硖尾': ['石硖尾', '石硤尾', 'shek kip mei'],
  '乐富': ['乐富', '樂富', 'lok fu'],

  // 港岛补充
  '柴湾': ['柴湾', '柴灣', 'chai wan'],
  '筲箕湾': ['筲箕湾', '筲箕灣', 'shau kei wan'],
  '鲗鱼涌': ['鲗鱼涌', '鰂魚涌', 'quarry bay'],
  '跑马地': ['跑马地', '跑馬地', 'happy valley'],
  '坚尼地城': ['坚尼地城', '堅尼地城', 'kennedy town'],
  '西营盘': ['西营盘', '西營盤', 'sai ying pun'],
  '上环': ['上环', '上環', 'sheung wan'],
  '天后': ['天后', 'tin hau'],
  '炮台山': ['炮台山', 'fortress hill'],

  // 新界北
  '古洞': ['古洞', 'kwu tung'],
  '落马洲支线': ['落马洲支线', '落馬洲支線', 'lok ma chau spur line'],
  '打鼓岭': ['打鼓岭', '打鼓嶺', 'ta kwu ling'],

  // 交通枢纽
  '九龙站': ['九龙站', '九龍站', 'kowloon station'],
  '青衣站': ['青衣站', 'tsing yi station'],
  '香港站': ['香港站', 'hong kong station'],
  '红磡站': ['红磡站', '紅磡站', 'hung hom station'],
  '九龙塘站': ['九龙塘站', '九龍塘站', 'kowloon tong station'],
  '大学站': ['大学站', '大學站', 'university station'],

  // 特殊地点
  '麼地道': ['麼地道', '么地道', 'mody road'],

  // 迪士尼/海洋公园补充后缀变体
  '迪士尼乐园': ['迪士尼乐园', '迪士尼', '迪士尼樂園', 'disneyland', '迪士尼站', '迪士尼地铁站', '迪士尼地鐵站', 'disneyland resort station'],
  '海洋公园': ['海洋公园', '海洋公園', 'ocean park', '海洋公园站', '海洋公园地铁站', '海洋公園站', '海洋公園地鐵站'],

  // MTR 缺失站补充
  '美孚': ['美孚', '美孚站', '美孚地鐵站'],

  // === 常见地标/商场/大厦（用户常用口语名称） ===
  '崇光百货': ['崇光百货', '崇光百貨', 'sogo', '铜锣湾sogo', '銅鑼灣sogo', 'sogo百货', 'sogo百貨'],
  '希慎广场': ['希慎广场', '希慎廣場', 'hysan place', 'hysan'],
  '利园': ['利园', '利園', 'lee gardens'],
  '置地广场': ['置地广场', '置地廣場', 'landmark'],
  'IFC': ['ifc', '国际金融中心', '國際金融中心', 'ifc mall'],
  'ICC': ['icc', '环球贸易广场', '環球貿易廣場'],
  'Elements': ['elements', '圆方', '圓方'],
  'K11': ['k11', 'k11 musea', 'k11购物艺术馆'],
  'MegaBox': ['megabox', 'mega box'],
  'APM': ['apm', 'apm商场', 'apm商場'],
  '新城市广场': ['新城市广场', '新城市廣場', 'new town plaza'],
  '奥海城': ['奥海城', '奧海城', 'olympic city'],
  '德福广场': ['德福广场', '德福廣場', 'telford plaza'],
  '荷里活广场': ['荷里活广场', '荷里活廣場', 'plaza hollywood'],
  'MOKO': ['moko', '新世纪广场', '新世紀廣場'],
  'PopCorn': ['popcorn', 'popcorn商场'],
  'ELEMENTS圆方': ['elements圆方', '圓方商場'],
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
// 地点名称提取（反向架构：全文扫描优先，正则兜底）
// ============================================================

/**
 * 从用户问题中提取起点和终点
 * 
 * 策略（按优先级）：
 * 1. 全文扫描 stop-db（9461站点）+ LOCATION_ALIASES 词典，找出所有命中地点
 * 2. 根据命中数量和上下文关键词（"从""到""往""由"）判断起终点
 * 3. 如果全文扫描无结果，降级到正则表达式模式匹配
 */
export function extractLocations(question: string): { origin?: string; destination?: string } {
  const q = question.trim();
  if (!q) return {};

  // === 策略 1：全文扫描已知站点（优先） ===
  
  // 先扫描 LOCATION_ALIASES 词典（地标/商圈/口岸，优先级最高）
  const aliasMatches: Array<{ pos: number; name: string; priority: number; end: number }> = [];
  for (const [canonical, aliases] of Object.entries(LOCATION_ALIASES)) {
    for (const alias of aliases) {
      const pos = q.toLowerCase().indexOf(alias.toLowerCase());
      if (pos >= 0) {
        const end = pos + alias.length;
        // 跳过被已有匹配完全包含的情况（如"九龙站"被"西九龙站"包含）
        const isContained = aliasMatches.some(m =>
          pos >= m.pos && end <= m.end && m.name !== canonical
        );
        if (!isContained) {
          aliasMatches.push({ pos, name: canonical, priority: -1, end });
        }
        break;
      }
    }
  }

  // 再扫描 stop-db 全量站点索引（9461站点）
  const foundLocs = findKnownLocationsInText(q);

  // 合并两个来源，按位置排序
  // 统一为 { pos, name, priority, end } 结构
  interface MatchEntry {
    pos: number;
    name: string;
    priority: number;
    end: number;
  }

  const allEntries: MatchEntry[] = [
    ...aliasMatches,
    ...foundLocs.map(f => ({
      pos: f.position,
      name: f.canonicalName,
      priority: f.priority,
      end: f.position + f.matchLen,
    })),
  ].sort((a, b) => a.pos - b.pos);

  // 去重：跳过被已有匹配完全包含的短匹配（如"九龙站"被"西九龙站"包含）
  const uniqueMatches: Array<{ pos: number; name: string }> = [];
  for (const m of allEntries) {
    const isContained = uniqueMatches.length > 0 && uniqueMatches.some(u => {
      const uIdx = allEntries.findIndex(e => e.pos === u.pos && e.name === u.name);
      if (uIdx < 0) return false;
      const uEnd = allEntries[uIdx].end;
      return m.pos >= u.pos && m.end <= uEnd && m.name !== u.name;
    });
    if (isContained) continue;

    const existingIdx = uniqueMatches.findIndex(u => u.pos === m.pos);
    if (existingIdx >= 0) {
      const existing = allEntries.find(e => e.pos === uniqueMatches[existingIdx].pos);
      if (existing && m.priority < existing.priority) {
        uniqueMatches[existingIdx] = { pos: m.pos, name: m.name };
      }
    } else {
      uniqueMatches.push({ pos: m.pos, name: m.name });
    }
  }

  // 根据命中数量判断
  if (uniqueMatches.length >= 2) {
    // 命中 ≥ 2 个地点：需要识别方向词分隔的地点组
    // 例如："从东涌逸东邨到沙田石门硕门邨" → origin="东涌逸东邨", destination="沙田石门硕门邨"
    
    // 查找方向词位置
    const directionWords = [
      { pattern: /[从從由]/g, type: 'from' as const },
      { pattern: /[到往去]/g, type: 'to' as const },
    ];
    
    interface DirectionMarker {
      pos: number;
      type: 'from' | 'to';
    }
    
    const markers: DirectionMarker[] = [];
    for (const { pattern, type } of directionWords) {
      let match;
      while ((match = pattern.exec(q)) !== null) {
        markers.push({ pos: match.index, type });
      }
    }
    markers.sort((a, b) => a.pos - b.pos);
    
    // 如果有方向词，按方向词分组地点
    if (markers.length > 0) {
      const originGroup: string[] = [];
      const destinationGroup: string[] = [];
      
      // 找到第一个"到/往/去"的位置作为分界点
      const toMarker = markers.find(m => m.type === 'to');
      const splitPos = toMarker ? toMarker.pos : Infinity;
      
      // 将地点分配到起点组或终点组
      for (const match of uniqueMatches) {
        if (match.pos < splitPos) {
          // 在"到"之前的地点 → 起点组
          originGroup.push(match.name);
        } else {
          // 在"到"之后的地点 → 终点组
          destinationGroup.push(match.name);
        }
      }
      
      // 合并复合地名（连续地点用空格连接）
      const origin = originGroup.length > 0 ? originGroup.join('') : undefined;
      const destination = destinationGroup.length > 0 ? destinationGroup.join('') : undefined;
      
      if (origin && destination) {
        return { origin, destination };
      } else if (origin) {
        return { origin };
      } else if (destination) {
        return { destination };
      }
    }
    
    // 无方向词的降级逻辑：取前两个
    const first = uniqueMatches[0];
    const second = uniqueMatches[1];
    return { origin: first.name, destination: second.name };
  } else if (uniqueMatches.length === 1) {
    // 命中 = 1 个地点：根据上下文判断是起点还是终点
    const loc = uniqueMatches[0];
    const before = q.substring(0, loc.pos);
    const after = q.substring(loc.pos + loc.name.length);

    // "到/往/去 + 地点" → 终点
    if (/[到往去]/.test(before)) {
      return { destination: loc.name };
    }
    // "从/由 + 地点" → 起点
    if (/[从從由]/.test(before)) {
      return { origin: loc.name };
    }
    // "地点 + 开出/出发" → 起点
    if (/(?:开出|開出|出发|出發)/.test(after)) {
      return { origin: loc.name };
    }
    // 默认：单地点视为终点（"去尖沙咀"场景）
    return { destination: loc.name };
  }

  // === 策略 2：全文扫描无结果，降级到正则模式匹配（兜底） ===
  return extractLocationsByRegex(q);
}

/**
 * 正则模式匹配（兜底策略）
 * 当全文扫描无法命中已知站点时使用
 */
function extractLocationsByRegex(q: string): { origin?: string; destination?: string } {
  // 模式1：从/從 A 到 B / 由 A 到 B / 由 A 去 B / A 到 B / A 去 B
  const zhPatterns = [
    /[从從]\s*(.+?)\s*到\s*(.+?)(?:\s*怎么走|\s*怎麼走|\s*怎么去|\s*怎麼去|\s*坐什么|\s*坐什麼|\s*搭什么|\s*搭什麼|\s*路线|\s*路線|\s*$)/,
    /由\s*(.+?)\s*(?:到|去)\s*(.+?)(?:\s*怎么走|\s*怎麼走|\s*怎么去|\s*怎麼去|\s*坐什么|\s*坐什麼|\s*搭什么|\s*搭什麼|\s*路线|\s*路線|\s*$)/,
    // "A 到 B" 不带前置词，要求 A 和 B 非空、A 至少 1 字；末尾可选怎么走/路线
    /^([^到去从由]+?)\s*(?:到|去)\s*([^到去从由]+?)(?:\s*怎么走|\s*怎麼走|\s*怎么去|\s*怎麼去|\s*坐什么|\s*坐什麼|\s*搭什么|\s*搭什麼|\s*路线|\s*路線|\s*$)/,
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
      const origin = resolveLocation(match[1].trim()) || match[1].trim();
      const destination = resolveLocation(match[2].trim()) || match[2].trim();
      return { origin, destination };
    }
  }

  // 模式4：去 B / 到 B（只有终点）
  const destOnlyPatterns = [
    /(?:去|到|想去|想到|要去|要到)\s*(.+?)(?:\s*怎么走|\s*怎麼走|\s*怎么去|\s*怎麼去|\s*$)/,
    /(?:how to get to|go to|get to)\s+(.+?)(?:\s*$|\s*\?)/i,
  ];

  // 尝试双地点模式（从A到B / A到B / from A to B）
  for (const pattern of [...zhPatterns, ...enPatterns]) {
    const match = q.match(pattern);
    if (match) {
      const origin = resolveLocation(match[1].trim()) || match[1].trim();
      const destination = resolveLocation(match[2].trim()) || match[2].trim();
      return { origin, destination };
    }
  }

  // 尝试单终点模式
  for (const pattern of destOnlyPatterns) {
    const match = q.match(pattern);
    if (match) {
      const destination = resolveLocation(match[1].trim()) || match[1].trim();
      return { destination };
    }
  }

  // 最后尝试：在问题中搜索已知地点名称（LOCATION_ALIASES 词典）
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
// 路线编号提取
// ============================================================

/**
 * 从查询文本中提取巴士/小巴路线编号
 * 香港路线格式：纯数字(1, 101)、数字+字母(238X, 270A)、字母+数字(B1, A21, N29)
 */
export function extractRouteNumbers(text: string): string[] {
  const lower = text.toLowerCase();
  const matches = new Set<string>();
  const patterns = [
    /\b([a-z]?\d+[a-z]?)\b/gi,   // KMB/CTB: 238X, B1, A21
    /\b([a-z]{1,2}\d+)\b/gi,     // NLB/GMB: 44A, NR38
  ];
  for (const pattern of patterns) {
    for (const m of lower.matchAll(pattern)) {
      const route = m[1].toUpperCase();
      if (route.length >= 1 && route.length <= 6) {
        matches.add(route);
      }
    }
  }
  return Array.from(matches);
}

// ============================================================
// ETA 查询识别
// ============================================================

const ETA_KEYWORDS = [
  '下一班', '下一輛', '到站时间', '到站時間', '几点到', '幾點到',
  '多久到', '幾時到', 'eta', 'arrival time', 'coming',
];

/**
 * 检测查询是否是关于实时到站时间（ETA）的问题
 */
export function isETAQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return ETA_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

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
  const routeNumbers = extractRouteNumbers(question);
  const isETA = isETAQuery(question);

  return {
    origin: locations.origin,
    destination: locations.destination,
    transportPreference: transportPreference.length > 0 ? transportPreference : undefined,
    timeRequirement,
    keywords: question.split(/[\s,，。.!！?？]+/).filter(Boolean),
    routeNumbers: routeNumbers.length > 0 ? routeNumbers : undefined,
    isETAQuery: isETA || undefined,
  };
}
