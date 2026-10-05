// 鲁港通 - 搜索源解析单元测试：DDG 跳转链接解码 + HTML/lite 结构解析（mock，不真联网）
import { describe, it, expect } from 'vitest';
import { resolveDDGUrl, parseDDG, parseBing, resolveBingUrl } from '../src/search-provider';

describe('resolveDDGUrl 跳转包裹链接解码', () => {
  it('解码 //duckduckgo.com/l/?uddg=... 形式（需求 11.2 用例）', () => {
    expect(
      resolveDDGUrl(
        '//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.gov.hk%2Fx&rut=1'
      )
    ).toBe('https://www.gov.hk/x');
  });

  it('解码 https 形式的 uddg 包裹链接', () => {
    expect(
      resolveDDGUrl(
        'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fhk01.com%2Fa%3Fid%3D1&rut=zzz'
      )
    ).toBe('https://hk01.com/a?id=1');
  });

  it('普通直链原样返回（补全协议、规范化）', () => {
    expect(resolveDDGUrl('https://www.gov.hk/tc/')).toBe(
      'https://www.gov.hk/tc/'
    );
    expect(resolveDDGUrl('//www.ird.gov.hk/')).toBe('https://www.ird.gov.hk/');
  });

  it('空串与异常输入安全返回', () => {
    expect(resolveDDGUrl('')).toBe('');
    expect(resolveDDGUrl('   ')).toBe('');
  });
});

describe('parseDDG 主接口 html.duckduckgo.com 结构', () => {
  const html = `
  <html><body>
    <div class="result results_links_deep web-result result--more">
      <h2 class="result__title">
        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.gov.hk%2Ftc%2F&rut=a">香港政府一站通</a>
      </h2>
      <a class="result__snippet" href="#">政府 入口 網站   的摘要</a>
    </div>
    <div class="result web-result">
      <h2 class="result__title">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fhk01.com%2Farticle&rut=b">港聞報道</a>
      </h2>
      <div class="result__snippet">新聞媒體摘要</div>
    </div>
  </body></html>`;

  it('解析出标题/真实URL/摘要，并折叠空白', () => {
    const results = parseDDG(html);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: '香港政府一站通',
      url: 'https://www.gov.hk/tc/',
      snippet: '政府 入口 網站 的摘要'
    });
    expect(results[1].url).toBe('https://hk01.com/article');
    expect(results[1].snippet).toBe('新聞媒體摘要');
  });

  it('去重相同真实 URL', () => {
    const dup = `
      <div class="result web-result"><h2><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgov.hk%2Fa&rut=1">A</a></h2><div class="result__snippet">x</div></div>
      <div class="result web-result"><h2><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgov.hk%2Fa&rut=2">A2</a></h2><div class="result__snippet">y</div></div>`;
    expect(parseDDG(dup)).toHaveLength(1);
  });
});

describe('parseDDG 降级接口 lite.duckduckgo.com 表格结构', () => {
  const lite = `
  <html><body><form><table>
    <tr><td><a class="result-link" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.immd.gov.hk%2F&rut=l1">入境事務處</a></td></tr>
    <tr><td class="result-snippet">入境政策摘要</td></tr>
    <tr><td><a class="result-link" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.tvb.com%2F&rut=l2">TVB</a></td></tr>
    <tr><td class="result-snippet">電視台摘要</td></tr>
  </table></form></body></html>`;

  it('按顺序配对 result-link 与 result-snippet', () => {
    const results = parseDDG(lite);
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://www.immd.gov.hk/');
    expect(results[0].title).toBe('入境事務處');
    expect(results[0].snippet).toBe('入境政策摘要');
    expect(results[1].url).toBe('https://www.tvb.com/');
  });
});

describe('parseDDG 异常/反爬页兜底', () => {
  it('空 HTML 返回空数组', () => {
    expect(parseDDG('')).toEqual([]);
  });
  it('验证页/无结果选择器返回空数组（触发上层 lite 降级）', () => {
    expect(parseDDG('<html><body>anomaly / challenge page</body></html>')).toEqual(
      []
    );
  });
});

// ============================================================
// 鲁港通 - Bing 必应搜索源（生产默认源）解析测试
// ============================================================

describe('resolveBingUrl 链接解析', () => {
  it('普通直链原样返回（补全协议）', () => {
    expect(resolveBingUrl('https://www.gov.hk/tc/')).toBe(
      'https://www.gov.hk/tc/'
    );
    expect(resolveBingUrl('//www.ird.gov.hk/')).toBe('https://www.ird.gov.hk/');
  });

  it('ck/a 跳转包裹链接解码出真实 URL（a1 + base64url）', () => {
    const target = 'https://www.gov.hk/tc/';
    const b64url =
      'a1' +
      Buffer.from(target)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    const wrapped = `https://www.bing.com/ck/a?u=${encodeURIComponent(
      b64url
    )}&ntb=1`;
    expect(resolveBingUrl(wrapped)).toBe(target);
  });

  it('空串与异常输入安全返回', () => {
    expect(resolveBingUrl('')).toBe('');
    expect(resolveBingUrl('   ')).toBe('');
  });
});

describe('parseBing 结果页解析', () => {
  const html = `
  <html><body><ol id="b_results">
    <li class="b_algo">
      <h2><a href="https://www.gov.hk/tc/residents/">香港政府一站通</a></h2>
      <div class="b_caption"><p>政府 入口 網站 的摘要</p></div>
    </li>
    <li class="b_algo">
      <h2><a href="https://hk01.com/article/1">港聞報道</a></h2>
      <div class="b_caption"><p>新聞媒體摘要</p></div>
    </li>
  </ol></body></html>`;

  it('解析出标题/URL/摘要并折叠空白', () => {
    const results = parseBing(html);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: '香港政府一站通',
      url: 'https://www.gov.hk/tc/residents/',
      snippet: '政府 入口 網站 的摘要'
    });
    expect(results[1].url).toBe('https://hk01.com/article/1');
    expect(results[1].snippet).toBe('新聞媒體摘要');
  });

  it('去重相同 URL', () => {
    const dup = `
      <li class="b_algo"><h2><a href="https://gov.hk/a">A</a></h2><div class="b_caption"><p>x</p></div></li>
      <li class="b_algo"><h2><a href="https://gov.hk/a">A2</a></h2><div class="b_caption"><p>y</p></div></li>`;
    expect(parseBing(dup)).toHaveLength(1);
  });

  it('空 HTML/验证页/无结果选择器返回空数组（触发上层重试）', () => {
    expect(parseBing('')).toEqual([]);
    expect(parseBing('<html><body>challenge page</body></html>')).toEqual([]);
  });
});
