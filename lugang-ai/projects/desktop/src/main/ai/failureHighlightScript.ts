// 鲁港通 - AI 失败标注：在页面视图内画目标/遮挡框与顶部说明条，9 秒后自动消失
import type { AiFailureHighlight } from './executor';

export const AI_FAILURE_HIGHLIGHT_DURATION_MS = 9000;

const HOST_ID = 'lugang-ai-failure-highlight';

// 鲁港通 - 页面可能带严格 CSP，样式全部走 CSSOM 赋值，不插入 style 标签
const pageScript = String.raw`(() => {
  var data = __LUGANG_HIGHLIGHT__;
  var doc = document;
  var HOST_ID = '__HOST_ID__';
  var DURATION = __DURATION__;
  var old = doc.getElementById(HOST_ID);
  if (old && old.parentNode) old.parentNode.removeChild(old);
  if (globalThis.__lugangAiFailureTimer) {
    clearTimeout(globalThis.__lugangAiFailureTimer);
    globalThis.__lugangAiFailureTimer = 0;
  }
  if (!doc.body) return false;

  var host = doc.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('data-lugang-ai-failure-highlight', '1');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  var clip = function (value, max) {
    var text = String(value == null ? '' : value);
    return text.length > max ? text.slice(0, max) + '…' : text;
  };
  var labelBase = 'position:absolute;top:-22px;left:-2px;white-space:nowrap;font-size:12px;line-height:1;padding:4px 8px;border-radius:4px;color:#fff;box-shadow:0 2px 6px rgba(31,49,66,0.18);';

  var addFrame = function (rect, color, background, label) {
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return;
    var frame = doc.createElement('div');
    frame.style.cssText = 'position:absolute;box-sizing:border-box;border:2px dashed ' + color + ';background:' + background + ';border-radius:5px;';
    frame.style.left = Math.round(rect.x) + 'px';
    frame.style.top = Math.round(rect.y) + 'px';
    frame.style.width = Math.round(rect.width) + 'px';
    frame.style.height = Math.round(rect.height) + 'px';
    var tag = doc.createElement('span');
    tag.setAttribute('data-lugang-ai-highlight-label', '1');
    tag.style.cssText = labelBase + 'background:' + color + ';';
    tag.textContent = label;
    // 目标贴近页面顶部时把标签放进框内，避免被视口裁掉
    if (Math.round(rect.y) < 26) tag.style.top = '2px';
    frame.appendChild(tag);
    root.appendChild(frame);
  };

  if (data.kind === 'covered' || data.kind === 'target') {
    addFrame(data.target, '#CC5B4E', 'rgba(204,91,78,0.07)', 'AI 要操作的位置');
  }
  if (data.kind === 'covered') {
    var coverLabel = data.coverName ? '遮挡层：' + clip(data.coverName, 40) : '遮挡层';
    addFrame(data.cover, '#C08A2E', 'rgba(192,138,46,0.06)', coverLabel);
  }

  var banner = doc.createElement('div');
  banner.setAttribute('data-lugang-ai-highlight-banner', '1');
  banner.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);width:min(440px,calc(100% - 40px));box-sizing:border-box;display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border-radius:9px;background:#FFF7F5;border:1px solid rgba(204,91,78,0.35);box-shadow:0 10px 26px rgba(31,49,66,0.14);pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;';

  var icon = doc.createElement('span');
  icon.textContent = '!';
  icon.style.cssText = 'flex:none;color:#CC5B4E;font-size:15px;font-weight:700;line-height:20px;';

  var body = doc.createElement('div');
  body.style.cssText = 'flex:1;min-width:0;';
  var title = doc.createElement('b');
  title.textContent = 'AI 没能完成这一步';
  title.style.cssText = 'display:block;font-size:13px;color:#9E3E33;margin-bottom:2px;';
  var text = doc.createElement('p');
  text.setAttribute('data-lugang-ai-highlight-message', '1');
  text.textContent = clip(data.message, 300);
  text.style.cssText = 'margin:0;font-size:12px;color:#7A5A52;line-height:1.55;word-break:break-word;';
  body.appendChild(title);
  body.appendChild(text);

  var close = doc.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', '关闭说明');
  close.style.cssText = 'flex:none;border:0;background:transparent;color:#B08B82;font-size:13px;line-height:1;padding:2px 4px;cursor:pointer;pointer-events:auto;';

  var remove = function () {
    if (globalThis.__lugangAiFailureTimer) {
      clearTimeout(globalThis.__lugangAiFailureTimer);
      globalThis.__lugangAiFailureTimer = 0;
    }
    var node = doc.getElementById(HOST_ID);
    if (node && node.parentNode) node.parentNode.removeChild(node);
  };
  close.addEventListener('click', remove);

  banner.appendChild(icon);
  banner.appendChild(body);
  banner.appendChild(close);
  root.appendChild(banner);
  doc.body.appendChild(host);

  globalThis.__lugangAiFailureTimer = setTimeout(remove, DURATION);
  return true;
})()`;

export const buildAiFailureHighlightExpression = (highlight: AiFailureHighlight): string =>
  pageScript
    .replace('__HOST_ID__', HOST_ID)
    .replace('__DURATION__', String(AI_FAILURE_HIGHLIGHT_DURATION_MS))
    // 鲁港通 - 用函数替换避免文案中的 $& 等被当成替换模板
    .replace('__LUGANG_HIGHLIGHT__', () => JSON.stringify(highlight));

export const buildAiClearFailureHighlightExpression = (): string =>
  `(() => {
  var host = document.getElementById(${JSON.stringify(HOST_ID)});
  if (host && host.parentNode) host.parentNode.removeChild(host);
  if (globalThis.__lugangAiFailureTimer) {
    clearTimeout(globalThis.__lugangAiFailureTimer);
    globalThis.__lugangAiFailureTimer = 0;
  }
  return true;
})()`;
