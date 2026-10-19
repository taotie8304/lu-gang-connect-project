// 鲁港通 - AI 页面脚本：在标签页内枚举可见交互元素、读取文本、定位与执行受控动作
import {
  AI_SNAPSHOT_FULL_TEXT_LIMIT,
  AI_SNAPSHOT_MAX_ELEMENTS,
  AI_SNAPSHOT_TEXT_LIMIT
} from './snapshot';

export const AI_PAGE_HELPERS_SOURCE = String.raw`(() => {
  if (globalThis.__lugangAi) return;
  var REF_ATTR = 'data-lugang-ai-ref';
  var SELECTOR = 'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"],[role="textbox"],[role="combobox"],[contenteditable=""],[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
  var textOf = function (el) {
    var text = el.innerText || el.textContent || '';
    return String(text).replace(/\s+/g, ' ').trim();
  };
  var clip = function (value, max) {
    var text = String(value == null ? '' : value);
    return text.length > max ? text.slice(0, max) : text;
  };
  var styleOf = function (el) {
    try { return globalThis.getComputedStyle ? getComputedStyle(el) : null; } catch (error) { return null; }
  };
  var isVisible = function (el) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (node.getAttribute('aria-hidden') === 'true') return false;
      var style = styleOf(node);
      if (style && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse')) return false;
      node = node.parentElement;
    }
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    var ownStyle = styleOf(el);
    return !(ownStyle && ownStyle.opacity !== '' && Number(ownStyle.opacity) === 0);
  };
  var isFileInput = function (el) {
    return !!el && el.tagName && el.tagName.toLowerCase() === 'input' &&
      String(el.getAttribute('type') || '').toLowerCase() === 'file';
  };
  var inViewport = function (el) {
    var rect = el.getBoundingClientRect();
    var height = globalThis.innerHeight || 0;
    var width = globalThis.innerWidth || 0;
    return rect.bottom >= 0 && rect.top <= height && rect.right >= 0 && rect.left <= width;
  };
  var labelOf = function (el) {
    var labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      var parts = labelledby.split(/\s+/).map(function (id) {
        var node = document.getElementById(id);
        return node ? textOf(node) : '';
      }).filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
    }
    var aria = el.getAttribute('aria-label');
    if (aria) return aria.trim();
    var id = el.getAttribute('id');
    if (id) {
      var labels = document.querySelectorAll('label[for]');
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].getAttribute('for') === id) {
          var labelText = textOf(labels[i]);
          if (labelText) return labelText;
        }
      }
    }
    var host = el.closest ? el.closest('label') : null;
    if (host) {
      var hostText = textOf(host);
      if (hostText) return hostText;
    }
    var placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder.trim();
    var title = el.getAttribute('title');
    if (title) return title.trim();
    var alt = el.getAttribute('alt');
    if (alt) return alt.trim();
    var tag = el.tagName.toLowerCase();
    var type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'input' && (type === 'button' || type === 'submit' || type === 'reset')) {
      var value = el.value;
      if (value) return String(value).trim();
    }
    return clip(textOf(el), 100);
  };
  var roleOf = function (el) {
    var explicit = el.getAttribute('role');
    if (explicit) return explicit;
    var tag = el.tagName.toLowerCase();
    var type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'file') return 'button';
      if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
      return 'textbox';
    }
    if (el.isContentEditable || el.getAttribute('contenteditable') === '' || el.getAttribute('contenteditable') === 'true') return 'textbox';
    return 'generic';
  };
  var isSensitive = function (el) {
    var type = (el.getAttribute('type') || '').toLowerCase();
    var autocomplete = el.getAttribute('autocomplete') || '';
    return type === 'password' || /cc-number|cc-csc|one-time-code|current-password|new-password/i.test(autocomplete);
  };
  var describe = function (el, ref) {
    var tag = el.tagName.toLowerCase();
    var type = (el.getAttribute('type') || '').toLowerCase();
    var autocomplete = el.getAttribute('autocomplete') || '';
    var sensitive = isSensitive(el);
    var item = {
      ref: ref,
      role: roleOf(el),
      name: clip(labelOf(el), 100),
      tag: tag,
      autocomplete: autocomplete,
      disabled: !!el.disabled,
      visible: true,
      inViewport: inViewport(el)
    };
    if (type) item.type = type;
    var placeholder = el.getAttribute('placeholder');
    if (placeholder) item.placeholder = clip(placeholder.trim(), 100);
    if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') {
      var text = textOf(el);
      if (text) item.text = clip(text, 100);
    }
    // 鲁港通 - 文件入口的 value 会带本机伪装路径，快照一律不返回
    if (!sensitive && type !== 'file' && 'value' in el && el.value != null) {
      item.value = clip(el.value, 200);
    }
    if (tag === 'a') {
      var href = el.getAttribute('href');
      if (href) item.href = clip(href, 300);
    }
    if (type === 'checkbox' || type === 'radio') item.checked = !!el.checked;
    if (tag === 'select' && el.value != null) item.value = clip(el.value, 200);
    return item;
  };
  var findByRef = function (ref) {
    var nodes = document.querySelectorAll('[' + REF_ATTR + ']');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute(REF_ATTR) === ref) return nodes[i];
    }
    return null;
  };
  var snapshot = function (options) {
    options = options || {};
    var maxElements = Math.max(1, Math.min(500, options.maxElements || 300));
    var maxText = Math.max(200, Math.min(20000, options.maxText || 6000));
    var previous = document.querySelectorAll('[' + REF_ATTR + ']');
    for (var i = 0; i < previous.length; i++) previous[i].removeAttribute(REF_ATTR);
    var nodes = document.querySelectorAll(SELECTOR);
    var list = [];
    for (var j = 0; j < nodes.length && list.length < maxElements; j++) {
      var el = nodes[j];
      // 鲁港通 - 文件入口通常被样式隐藏，但仍是可上传的有效入口
      if (!isFileInput(el) && !isVisible(el)) continue;
      var ref = 'e' + (list.length + 1);
      el.setAttribute(REF_ATTR, ref);
      list.push(describe(el, ref));
    }
    var body = document.body;
    var bodyText = body ? (body.innerText || body.textContent || '') : '';
    var normalized = String(bodyText).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    var doc = document.documentElement;
    return {
      url: location.href,
      title: document.title || '',
      text: normalized.length > maxText ? normalized.slice(0, maxText) : normalized,
      textTruncated: normalized.length > maxText,
      elements: list,
      elementsTruncated: list.length >= maxElements && nodes.length > list.length,
      scroll: {
        x: Math.round(globalThis.scrollX || 0),
        y: Math.round(globalThis.scrollY || 0),
        viewportWidth: Math.round(globalThis.innerWidth || 0),
        viewportHeight: Math.round(globalThis.innerHeight || 0),
        pageHeight: Math.round((doc && doc.scrollHeight) || 0)
      }
    };
  };
  var resolve = function (ref, options) {
    var el = findByRef(ref);
    if (!el || !el.isConnected) return { found: false };
    if (options && options.scrollIntoView) {
      var box = el.getBoundingClientRect();
      var outside = box.bottom < 0 || box.top > (globalThis.innerHeight || 0) || box.right < 0 || box.left > (globalThis.innerWidth || 0);
      if (outside && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
    }
    var rect = el.getBoundingClientRect();
    var result = {
      found: true,
      visible: isVisible(el),
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
    var inputType = (el.getAttribute('type') || '').toLowerCase();
    if (!isSensitive(el) && inputType !== 'file' && 'value' in el && el.value != null) result.value = clip(el.value, 500);
    else if (el.isContentEditable) result.value = clip(textOf(el), 500);
    if (typeof el.checked === 'boolean') result.checked = el.checked;
    return result;
  };
  var prepareInput = function (ref) {
    var el = findByRef(ref);
    if (!el || !el.isConnected) return { ok: false, reason: 'not_found' };
    var tag = el.tagName.toLowerCase();
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    var editable = tag === 'textarea' || el.isContentEditable || (tag === 'input' && !/^(button|submit|reset|checkbox|radio|file|hidden|image)$/.test(type));
    if (!editable) return { ok: false, reason: 'not_editable' };
    if (typeof el.focus === 'function') el.focus();
    var before = '';
    if (tag === 'input' || tag === 'textarea') {
      before = String(el.value == null ? '' : el.value);
      try {
        if (typeof el.select === 'function') el.select();
        else if (typeof el.setSelectionRange === 'function') el.setSelectionRange(0, before.length);
      } catch (error) {
        // 鲁港通 - number/date 等输入类型不支持全选时，仍允许聚焦后用键盘全选替换
      }
    } else {
      before = textOf(el);
      var range = document.createRange();
      range.selectNodeContents(el);
      var selection = globalThis.getSelection ? getSelection() : null;
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    return { ok: true, value: before, editable: true };
  };
  var selectOption = function (ref, option) {
    var el = findByRef(ref);
    if (!el || !el.isConnected) return { ok: false, reason: 'not_found' };
    if (el.tagName.toLowerCase() !== 'select') return { ok: false, reason: 'not_select' };
    var wanted = String(option).trim().toLowerCase();
    var options = Array.prototype.slice.call(el.options || []);
    var labels = options.map(function (item) { return clip(textOf(item), 100); });
    var foundIndex = -1;
    for (var i = 0; i < options.length; i++) {
      if (String(options[i].value).trim().toLowerCase() === wanted) { foundIndex = i; break; }
    }
    if (foundIndex < 0) {
      for (var j = 0; j < options.length; j++) {
        if (labels[j].toLowerCase() === wanted) { foundIndex = j; break; }
      }
    }
    if (foundIndex < 0) {
      for (var k = 0; k < options.length; k++) {
        if (labels[k].toLowerCase().indexOf(wanted) !== -1) { foundIndex = k; break; }
      }
    }
    if (foundIndex < 0) return { ok: false, reason: 'option_not_found', options: labels.slice(0, 20) };
    var chosen = options[foundIndex];
    el.value = chosen.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: el.value, text: labels[foundIndex] };
  };
  var fileInput = function (ref) {
    var el = findByRef(ref);
    if (!el || !el.isConnected) return { found: false };
    if (!isFileInput(el)) return { found: true, isFile: false };
    var files = el.files ? Array.prototype.slice.call(el.files) : [];
    return {
      found: true,
      isFile: true,
      multiple: !!el.multiple,
      accept: clip(el.getAttribute('accept') || '', 200),
      count: files.length,
      names: files.slice(0, 5).map(function (file) {
        return clip(file && file.name, 120);
      })
    };
  };
  var scrollState = function () {
    var doc = document.documentElement;
    return {
      x: Math.round(globalThis.scrollX || 0),
      y: Math.round(globalThis.scrollY || 0),
      viewportWidth: Math.round(globalThis.innerWidth || 0),
      viewportHeight: Math.round(globalThis.innerHeight || 0),
      pageHeight: Math.round((doc && doc.scrollHeight) || 0)
    };
  };
  var scroll = function (direction, amount) {
    var before = scrollState();
    var step = typeof amount === 'number' && amount > 0 ? amount : Math.round((globalThis.innerHeight || 600) * 0.8);
    if (direction === 'top') globalThis.scrollTo(0, 0);
    else if (direction === 'bottom') globalThis.scrollTo(0, (document.documentElement && document.documentElement.scrollHeight) || 0);
    else if (typeof globalThis.scrollBy === 'function') globalThis.scrollBy(0, direction === 'up' ? -step : step);
    var after = scrollState();
    return { before: before, after: after, changed: before.x !== after.x || before.y !== after.y };
  };
  globalThis.__lugangAi = {
    snapshot: snapshot,
    resolve: resolve,
    prepareInput: prepareInput,
    selectOption: selectOption,
    fileInput: fileInput,
    scroll: scroll
  };
})()`;

const wrap = (body: string): string => `(() => { ${AI_PAGE_HELPERS_SOURCE}; return ${body}; })()`;

export const buildAiSnapshotExpression = (options: { fullText?: boolean } = {}): string =>
  wrap(
    `globalThis.__lugangAi.snapshot(${JSON.stringify({
      maxElements: AI_SNAPSHOT_MAX_ELEMENTS,
      maxText: options.fullText ? AI_SNAPSHOT_FULL_TEXT_LIMIT : AI_SNAPSHOT_TEXT_LIMIT
    })})`
  );

export const buildAiResolveExpression = (
  ref: string,
  options: { scrollIntoView?: boolean } = {}
): string =>
  wrap(
    `globalThis.__lugangAi.resolve(${JSON.stringify(ref)}, ${JSON.stringify({
      scrollIntoView: options.scrollIntoView === true
    })})`
  );

export const buildAiPrepareInputExpression = (ref: string): string =>
  wrap(`globalThis.__lugangAi.prepareInput(${JSON.stringify(ref)})`);

export const buildAiSelectExpression = (ref: string, option: string): string =>
  wrap(`globalThis.__lugangAi.selectOption(${JSON.stringify(ref)}, ${JSON.stringify(option)})`);

export const buildAiFileStateExpression = (ref: string): string =>
  wrap(`globalThis.__lugangAi.fileInput(${JSON.stringify(ref)})`);

export const buildAiScrollExpression = (direction: string, amount?: number): string =>
  wrap(
    `globalThis.__lugangAi.scroll(${JSON.stringify(direction)}, ${
      typeof amount === 'number' ? JSON.stringify(amount) : 'undefined'
    })`
  );
