// 鲁港通 - 注入脚本：只做标准 Web 行为与本机能力的转接，不改动页面结构
(function () {
  if (window.__LUGANG_ANDROID__) return;
  window.__LUGANG_ANDROID__ = true;
  if (window.top !== window) return;

  var INTERNAL_HOST = 'www.airscend.com';
  var MAX_BLOB_BYTES = 100 * 1024 * 1024;
  var CHUNK_BYTES = 256 * 1024;

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

  function base64OfDataUrl(dataUrl) {
    var comma = dataUrl.indexOf(',');
    return comma >= 0 ? dataUrl.substring(comma + 1) : '';
  }

  function saveBlob(url, rawName) {
    var api = bridge();
    if (!api || !api.saveBlobStart) return false;
    if (window.__lugangSaving) {
      api.toast('请等待当前文件保存完成');
      return true;
    }
    window.__lugangSaving = true;
    var sessionId = null;

    function fail(message) {
      if (sessionId && api.saveBlobAbort) api.saveBlobAbort(sessionId);
      sessionId = null;
      window.__lugangSaving = false;
      if (message) api.toast(message);
    }

    fetch(url)
      .then(function (response) { return response.blob(); })
      .then(function (blob) {
        if (blob.size > MAX_BLOB_BYTES) {
          fail('文件过大，请在电脑端导出');
          return;
        }
        sessionId = api.saveBlobStart(
          rawName || '鲁港通导出',
          blob.type || 'application/octet-stream',
          blob.size
        );
        if (!sessionId) {
          fail('保存失败，请重试');
          return;
        }
        var offset = 0;
        function next() {
          if (offset >= blob.size) {
            var ok = api.saveBlobEnd(sessionId);
            sessionId = null;
            window.__lugangSaving = false;
            api.toast(ok ? '已保存到 下载/鲁港通' : '保存失败，请重试');
            return;
          }
          var slice = blob.slice(offset, offset + CHUNK_BYTES);
          offset += slice.size;
          var reader = new FileReader();
          reader.onload = function () {
            var ok = api.saveBlobChunk(sessionId, base64OfDataUrl(String(reader.result)));
            if (!ok) {
              fail('保存失败，请重试');
              return;
            }
            next();
          };
          reader.onerror = function () { fail('保存失败，请重试'); };
          reader.readAsDataURL(slice);
        }
        next();
      })
      .catch(function () { fail('保存失败，请重试'); });
    return true;
  }

  document.addEventListener('click', function (event) {
    var element = event.target;
    while (element && element.tagName !== 'A') element = element.parentElement;
    if (!element || !element.hasAttribute) return;

    var href = element.getAttribute('href') || '';
    if (href.indexOf('blob:') === 0 && element.hasAttribute('download')) {
      event.preventDefault();
      event.stopPropagation();
      saveBlob(href, element.getAttribute('download') || '');
      return;
    }

    if (element.target !== '_blank') return;
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
