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
}
