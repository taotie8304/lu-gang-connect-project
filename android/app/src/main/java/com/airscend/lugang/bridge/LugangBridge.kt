// 鲁港通 - 原生桥：所有方法先校验主框架来源，再转交 Activity 执行
package com.airscend.lugang.bridge

import android.webkit.JavascriptInterface
import com.airscend.lugang.BuildConfig
import org.json.JSONObject

class LugangBridge(private val host: Host) {

    interface Host {
        fun isBridgeTrusted(): Boolean
        fun onBridgeOpenExternal(url: String?)
        fun onBridgeToast(message: String?)
        fun startBlobSave(name: String?, mime: String?, size: Long): String?
        fun appendBlobChunk(id: String?, base64: String?): Boolean
        fun finishBlobSave(id: String?): Boolean
        fun abortBlobSave(id: String?)
        fun onBridgeOpenDownloads()
        fun onBridgeCheckUpdate()
    }

    @JavascriptInterface
    fun getAppInfo(): String {
        if (!host.isBridgeTrusted()) return "{}"
        return JSONObject()
            .put("versionName", BuildConfig.VERSION_NAME)
            .put("versionCode", BuildConfig.VERSION_CODE)
            .put("platform", "android")
            .toString()
    }

    @JavascriptInterface
    fun openExternal(url: String?) {
        if (!host.isBridgeTrusted()) return
        host.onBridgeOpenExternal(url)
    }

    @JavascriptInterface
    fun toast(message: String?) {
        if (!host.isBridgeTrusted()) return
        host.onBridgeToast(message)
    }

    @JavascriptInterface
    fun openDownloads() {
        if (!host.isBridgeTrusted()) return
        host.onBridgeOpenDownloads()
    }

    @JavascriptInterface
    fun checkUpdate() {
        if (!host.isBridgeTrusted()) return
        host.onBridgeCheckUpdate()
    }

    @JavascriptInterface
    fun saveBlobStart(name: String?, mime: String?, size: Long): String? {
        if (!host.isBridgeTrusted()) return null
        return host.startBlobSave(name, mime, size)
    }

    @JavascriptInterface
    fun saveBlobChunk(id: String?, base64: String?): Boolean {
        if (!host.isBridgeTrusted()) return false
        return host.appendBlobChunk(id, base64)
    }

    @JavascriptInterface
    fun saveBlobEnd(id: String?): Boolean {
        if (!host.isBridgeTrusted()) return false
        return host.finishBlobSave(id)
    }

    @JavascriptInterface
    fun saveBlobAbort(id: String?) {
        if (!host.isBridgeTrusted()) return
        host.abortBlobSave(id)
    }
}
