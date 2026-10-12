// 鲁港通 - 域名过滤算法单元测试（覆盖需求文档 11.2 全部必测用例）
import { describe, it, expect } from 'vitest';
import {
  normalizeHost,
  classify,
  judge,
  filterResults
} from '../src/domain-filter';
import type { RawSearchResult } from '../src/types';

function raw(url: string, title = 't'): RawSearchResult {
  return { title, url, snippet: 's' };
}

describe('normalizeHost 主机名规范化', () => {
  it('去掉前导 www. 并转小写', () => {
    expect(normalizeHost('https://www.gov.hk/tc/')).toBe('gov.hk');
    expect(normalizeHost('HTTPS://WWW.GOV.HK/EN')).toBe('gov.hk');
  });
  it('非法 URL 返回空串', () => {
    expect(normalizeHost('not a url')).toBe('');
  });
});

describe('classify 来源分类（A-H 白名单）', () => {
  it('A 政府 *.gov.hk', () => {
    expect(classify('www.gov.hk')).toBe('gov');
    expect(classify('info.gov.hk')).toBe('gov');
    expect(classify('ird.gov.hk')).toBe('gov');
  });
  it('B 公营机构', () => {
    expect(classify('hkex.com.hk')).toBe('public');
    expect(classify('mtr.com.hk')).toBe('public');
    expect(classify('sfc.hk')).toBe('public');
  });
  it('C 学术（后缀 + 显式大学 + 子域）', () => {
    expect(classify('hku.hk')).toBe('academic');
    expect(classify('fac.hku.hk')).toBe('academic');
    expect(classify('xxx.edu.hk')).toBe('academic');
    expect(classify('www.polyu.edu.hk')).toBe('academic');
  });
  it('D 非盈利 *.org.hk', () => {
    expect(classify('hkcss.org.hk')).toBe('nonprofit');
    expect(classify('redcross.org.hk')).toBe('nonprofit');
  });
  it('E 正规新闻媒体', () => {
    expect(classify('hk01.com')).toBe('news');
    expect(classify('on.cc')).toBe('news');
  });
  it('F 电视台', () => {
    expect(classify('tvb.com')).toBe('tv');
    expect(classify('rthk.hk')).toBe('tv');
  });
  it('G 金融机构（银行/保险/证券基金）', () => {
    expect(classify('www.hsbc.com.hk')).toBe('finance');
    expect(classify('bochk.com')).toBe('finance');
    expect(classify('aia.com.hk')).toBe('finance');
    expect(classify('futuhk.com')).toBe('finance');
    expect(classify('mox.com')).toBe('finance');
  });
  it('H 医疗机构', () => {
    expect(classify('www.hksh.com')).toBe('medical');
    expect(classify('gleneagles.hk')).toBe('medical');
    expect(classify('hkma.org')).toBe('medical');
  });
  it('未知域名分类为 other', () => {
    expect(classify('random-blog.com')).toBe('other');
  });
});

describe('judge - official 模式（默认拒绝策略）', () => {
  it('政府/公营/学术/非盈利/金融/医疗/媒体/电视台放行，reason=whitelist', () => {
    expect(judge('https://www.gov.hk/', 'official')).toMatchObject({
      allow: true,
      reason: 'whitelist',
      sourceType: 'gov'
    });
    expect(judge('https://hkex.com.hk/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'public'
    });
    expect(judge('https://hku.hk/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'academic'
    });
    expect(judge('https://hkcss.org.hk/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'nonprofit'
    });
    expect(judge('https://hk01.com/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'news'
    });
    expect(judge('https://tvb.com/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'tv'
    });
    expect(
      judge('https://www.hsbc.com.hk/accounts/', 'official')
    ).toMatchObject({
      allow: true,
      reason: 'whitelist',
      sourceType: 'finance'
    });
    expect(judge('https://www.hksh.com/', 'official')).toMatchObject({
      allow: true,
      reason: 'whitelist',
      sourceType: 'medical'
    });
  });

  it('社交媒体硬拒绝，reason=social-media', () => {
    expect(judge('https://facebook.com/x', 'official')).toMatchObject({
      allow: false,
      reason: 'social-media'
    });
    expect(judge('https://youtube.com/watch?v=x', 'official')).toMatchObject({
      allow: false,
      reason: 'social-media'
    });
    expect(judge('https://x.com/somegov', 'official')).toMatchObject({
      allow: false,
      reason: 'social-media'
    });
  });

  it('营销平台拒绝，reason=marketing', () => {
    expect(judge('https://klook.com/activity', 'official')).toMatchObject({
      allow: false,
      reason: 'marketing'
    });
    expect(judge('https://tripadvisor.com/', 'official')).toMatchObject({
      allow: false,
      reason: 'marketing'
    });
  });

  it('未知域名默认拒绝，reason=not-whitelisted', () => {
    expect(judge('https://random-blog.com/a', 'official')).toMatchObject({
      allow: false,
      reason: 'not-whitelisted'
    });
    expect(judge('https://some-shop.com/', 'official')).toMatchObject({
      allow: false,
      reason: 'not-whitelisted'
    });
  });

  it('非法 URL 拒绝，reason=invalid-url', () => {
    expect(judge('bad url', 'official').allow).toBe(false);
    expect(judge('bad url', 'official').reason).toBe('invalid-url');
  });

  it('大小写规范化：WWW.GOV.HK 仍放行', () => {
    expect(judge('HTTPS://WWW.GOV.HK/TC', 'official')).toMatchObject({
      allow: true,
      sourceType: 'gov'
    });
  });
});

describe('judge - open 模式（香港本地生活小助手：完全不过滤）', () => {
  it('社交媒体放行', () => {
    expect(judge('https://facebook.com/x', 'open')).toMatchObject({
      allow: true,
      reason: 'open-scope'
    });
    expect(judge('https://youtube.com/watch?v=x', 'open').allow).toBe(true);
    expect(judge('https://x.com/gov', 'open').allow).toBe(true);
  });
  it('营销平台放行', () => {
    expect(judge('https://klook.com/', 'open')).toMatchObject({
      allow: true,
      reason: 'open-scope'
    });
    expect(judge('https://tripadvisor.com/', 'open').allow).toBe(true);
  });
  it('未知域名也放行', () => {
    expect(judge('https://random-blog.com/', 'open').allow).toBe(true);
  });
  it('权威来源在 open 模式同样放行', () => {
    expect(judge('https://www.gov.hk/', 'open').allow).toBe(true);
  });
});

describe('filterResults 批量过滤', () => {
  const input: RawSearchResult[] = [
    raw('https://www.gov.hk/a', 'gov'),
    raw('https://hk01.com/b', 'news'),
    raw('https://facebook.com/c', 'social'),
    raw('https://klook.com/d', 'marketing'),
    raw('https://random-blog.com/e', 'other')
  ];

  it('official：只保留白名单 2 条，拒绝 3 条并带 reason', () => {
    const { allowed, rejected } = filterResults(input, 'official');
    expect(allowed.map((r) => r.source)).toEqual(['gov.hk', 'hk01.com']);
    expect(allowed.map((r) => r.sourceType)).toEqual(['gov', 'news']);
    expect(rejected).toHaveLength(3);
    expect(rejected.map((r) => r.reason)).toEqual([
      'social-media',
      'marketing',
      'not-whitelisted'
    ]);
  });

  it('open：全部 5 条放行', () => {
    const { allowed, rejected } = filterResults(input, 'open');
    expect(allowed).toHaveLength(5);
    expect(rejected).toHaveLength(0);
  });
});

// ============================================================
// 鲁港通 - 大陆地域档（region=cn）：山东支线专用，域名清单全部来自百炼实测命中
// ============================================================
describe('classify - 大陆白名单（region=cn）', () => {
  it('I 中央国家机关与部委', () => {
    expect(classify('gov.cn', 'cn')).toBe('gov'); // 鲁港通 - 中国政府网（www 已剥离）
    expect(classify('www.gov.cn', 'cn')).toBe('gov');
    expect(classify('ndrc.gov.cn', 'cn')).toBe('gov');
    expect(classify('mohrss.gov.cn', 'cn')).toBe('gov');
    expect(classify('fgk.chinatax.gov.cn', 'cn')).toBe('gov');
    expect(classify('kunming.pbc.gov.cn', 'cn')).toBe('gov');
    expect(classify('qwgzyj.gqb.gov.cn', 'cn')).toBe('gov');
    expect(classify('s.nia.gov.cn', 'cn')).toBe('gov');
  });

  it('J 山东省级与各地市政务', () => {
    expect(classify('shandong.gov.cn', 'cn')).toBe('gov');
    expect(classify('m.shandong.gov.cn', 'cn')).toBe('gov');
    expect(classify('hrss.shandong.gov.cn', 'cn')).toBe('gov');
    expect(classify('commerce.shandong.gov.cn', 'cn')).toBe('gov');
    expect(classify('shandong.chinatax.gov.cn', 'cn')).toBe('gov');
    expect(classify('wfgxzwfw.sd.gov.cn', 'cn')).toBe('gov');
    expect(classify('jinan.gov.cn', 'cn')).toBe('gov');
    expect(classify('zwfw.jinan.gov.cn', 'cn')).toBe('gov');
    expect(classify('qingdao.gov.cn', 'cn')).toBe('gov');
    expect(classify('rsj.weifang.gov.cn', 'cn')).toBe('gov');
    expect(classify('china-zibo.gov.cn', 'cn')).toBe('gov');
  });

  it('K 山东高校', () => {
    expect(classify('sdu.edu.cn', 'cn')).toBe('academic');
    expect(classify('ise.sdu.edu.cn', 'cn')).toBe('academic');
    expect(classify('ouc.edu.cn', 'cn')).toBe('academic');
    expect(classify('physics.qdu.edu.cn', 'cn')).toBe('academic');
    expect(classify('qust.edu.cn', 'cn')).toBe('academic');
  });

  it('外省政务与聚合站不得进入大陆白名单', () => {
    expect(classify('zhsi.zhuhai.gov.cn', 'cn')).toBe('other');
    expect(classify('qb.fujian.gov.cn', 'cn')).toBe('other');
    expect(classify('hsa.gd.gov.cn', 'cn')).toBe('other');
    expect(classify('baike.baidu.com', 'cn')).toBe('other');
    expect(classify('m.jn.bendibao.com', 'cn')).toBe('other');
    expect(classify('m.anjuke.com', 'cn')).toBe('other');
  });

  it('gov.cn 只精确匹配国务院门户，不得放行任意 *.gov.cn', () => {
    expect(classify('zhuhai.gov.cn', 'cn')).toBe('other');
    expect(classify('zhangzhou.gov.cn', 'cn')).toBe('other');
  });

  // 鲁港通 - 严格档口径：税务总局只留总局本级与政策法规库，省局属外省政务，须拒绝
  it('税务总局仅放行总局本级与政策法规库，外省税务局拒绝', () => {
    expect(classify('chinatax.gov.cn', 'cn')).toBe('gov');
    expect(classify('www.chinatax.gov.cn', 'cn')).toBe('gov');
    expect(classify('fgk.chinatax.gov.cn', 'cn')).toBe('gov');
    expect(classify('shandong.chinatax.gov.cn', 'cn')).toBe('gov');
    expect(classify('guangdong.chinatax.gov.cn', 'cn')).toBe('other');
    expect(classify('beijing.chinatax.gov.cn', 'cn')).toBe('other');
    expect(classify('hainan.chinatax.gov.cn', 'cn')).toBe('other');
    expect(classify('shanghai.chinatax.gov.cn', 'cn')).toBe('other');
    expect(classify('fujian.chinatax.gov.cn', 'cn')).toBe('other');
    expect(classify('heilongjiang.chinatax.gov.cn', 'cn')).toBe('other');
  });

  // 鲁港通 - 2026-10-12 补测：site:<host> 取主机自身标题确认属山东后补入
  it('J 实测确认的山东区县政务网（第二批）', () => {
    expect(classify('chengyang.gov.cn', 'cn')).toBe('gov'); // 青岛市城阳区
    expect(classify('www.chengyang.gov.cn', 'cn')).toBe('gov');
    expect(classify('qdsn.gov.cn', 'cn')).toBe('gov'); // 青岛市市南区
    expect(classify('zoucheng.gov.cn', 'cn')).toBe('gov'); // 济宁邹城市
    expect(classify('yishui.gov.cn', 'cn')).toBe('gov'); // 临沂市沂水县
  });

  // 鲁港通 - 拼音近似的外省域名，凭印象极易误放行；实测标题已确认属外省
  it('外省同名近似域名不得进入清单', () => {
    expect(classify('laiwu.gov.cn', 'cn')).toBe('other'); // 湖南临武县（非山东莱芜）
    expect(classify('cnts.gov.cn', 'cn')).toBe('other'); // 广东台山市
    expect(classify('ningde.gov.cn', 'cn')).toBe('other'); // 福建宁德
    expect(classify('wenzhou.gov.cn', 'cn')).toBe('other'); // 浙江温州
    expect(classify('fuqing.gov.cn', 'cn')).toBe('other'); // 福建福清
    expect(classify('jinjiang.gov.cn', 'cn')).toBe('other'); // 福建晋江
  });

  it('香港档不受大陆清单影响（零回归）', () => {
    expect(classify('shandong.gov.cn')).toBe('other');
    expect(classify('sdu.edu.cn')).toBe('other');
    expect(classify('gov.cn')).toBe('other');
    expect(classify('www.gov.hk')).toBe('gov');
  });
});

describe('judge - 地域档 region=cn', () => {
  it('cn+official：山东政务放行', () => {
    expect(judge('https://hrss.shandong.gov.cn/a', 'official', 'cn')).toMatchObject({
      allow: true,
      reason: 'whitelist',
      sourceType: 'gov'
    });
    expect(judge('https://jinan.gov.cn/', 'official', 'cn').allow).toBe(true);
    expect(judge('https://ise.sdu.edu.cn/', 'official', 'cn')).toMatchObject({
      allow: true,
      sourceType: 'academic'
    });
  });

  it('cn+official：外省政务与营销默认拒绝', () => {
    expect(judge('https://zhangzhou.gov.cn/', 'official', 'cn')).toMatchObject({
      allow: false,
      reason: 'not-whitelisted'
    });
    expect(judge('https://baike.baidu.com/item/x', 'official', 'cn')).toMatchObject({
      allow: false,
      reason: 'not-whitelisted'
    });
    expect(judge('https://m.jn.bendibao.com/', 'official', 'cn')).toMatchObject({
      allow: false,
      reason: 'not-whitelisted'
    });
    // 鲁港通 - v1.3.0 生产实测泄漏项：外省税务局必须落在拒绝侧
    expect(judge('https://guangdong.chinatax.gov.cn/webapps1/gdsw/mzsw_zcfgwj/', 'official', 'cn')).toMatchObject({
      allow: false,
      reason: 'not-whitelisted'
    });
  });

  it('cn+official：社交媒体仍硬拒绝', () => {
    expect(judge('https://mp.weixin.qq.com/s/x', 'official', 'cn')).toMatchObject({
      allow: false,
      reason: 'social-media'
    });
  });

  it('cn 档不返回香港来源（山东题不得引香港文件）', () => {
    expect(judge('https://www.gov.hk/', 'official', 'cn').allow).toBe(false);
    expect(judge('https://www.hsbc.com.hk/', 'official', 'cn').allow).toBe(false);
  });

  it('默认档仍是香港，行为与现状一致', () => {
    expect(judge('https://hkex.com.hk/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'public'
    });
    expect(judge('https://shandong.gov.cn/', 'official')).toMatchObject({
      allow: false,
      reason: 'not-whitelisted'
    });
  });

  it('cn+open：完全不过滤', () => {
    expect(judge('https://m.jn.bendibao.com/', 'open', 'cn')).toMatchObject({
      allow: true,
      reason: 'open-scope'
    });
  });
});

describe('filterResults - 大陆档', () => {
  const cnInput: RawSearchResult[] = [
    raw('https://zwfw.jinan.gov.cn/a', 'jinan'),
    raw('https://commerce.shandong.gov.cn/b', 'shandong'),
    raw('https://zhangzhou.gov.cn/c', 'other-province'),
    raw('https://mp.weixin.qq.com/s/d', 'wechat'),
    raw('https://www.gov.hk/e', 'hk-gov')
  ];

  it('cn：只保留山东官方 2 条', () => {
    const { allowed, rejected } = filterResults(cnInput, 'official', 'cn');
    expect(allowed.map((r) => r.source)).toEqual([
      'zwfw.jinan.gov.cn',
      'commerce.shandong.gov.cn'
    ]);
    expect(rejected).toHaveLength(3);
    expect(rejected.map((r) => r.reason)).toEqual([
      'not-whitelisted',
      'social-media',
      'not-whitelisted'
    ]);
  });

  it('默认（香港）：同批只保留香港官方 1 条', () => {
    const { allowed } = filterResults(cnInput, 'official');
    expect(allowed.map((r) => r.source)).toEqual(['gov.hk']);
  });
});
