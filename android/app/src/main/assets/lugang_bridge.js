// 鲁港通 - 注入脚本：只做标准 Web 行为与本机能力的转接，不改动页面结构
(function () {
  if (window.__LUGANG_ANDROID__) return;
  window.__LUGANG_ANDROID__ = true;
  if (window.top !== window) return;

  var INTERNAL_HOST = 'www.airscend.com';

  function bridge() {
    return window.LugangApp || null;
  }

  function absolute(url) {
    try {
      return new URL(url, location.href).href;
    } catch (error) {
      return null;
    }
  }

  function isInternal(url) {
    var abs = absolute(url);
    if (!abs) return false;
    try {
      var parsed = new URL(abs);
      return parsed.protocol === 'https:' && parsed.hostname === INTERNAL_HOST;
    } catch (error) {
      return false;
    }
  }

  var originalOpen = window.open;
  window.open = function (url, target, features) {
    if (!url) return originalOpen ? originalOpen.call(window, url, target, features) : null;
    var abs = absolute(url);
    if (abs && isInternal(abs)) {
      location.href = abs;
      return null;
    }
    var api = bridge();
    if (api && api.openExternal && abs) api.openExternal(abs);
    return null;
  };

  document.addEventListener('click', function (event) {
    var element = event.target;
    while (element && element.tagName !== 'A') element = element.parentElement;
    if (!element || !element.hasAttribute) return;
    if (element.target !== '_blank') return;
    var href = element.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') return;
    var abs = absolute(href);
    if (!abs) return;
    if (isInternal(abs)) {
      event.preventDefault();
      location.href = abs;
      return;
    }
    var api = bridge();
    if (api && api.openExternal) {
      event.preventDefault();
      api.openExternal(abs);
    }
  }, true);
})();
