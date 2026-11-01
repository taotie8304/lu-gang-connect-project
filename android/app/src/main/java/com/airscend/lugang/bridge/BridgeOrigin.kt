// 鲁港通 - 原生桥来源闸门：只信任本站 HTTPS 主框架
package com.airscend.lugang.bridge

import java.net.URI

object BridgeOrigin {
    const val ORIGIN = "https://www.airscend.com"
    private const val HOST = "www.airscend.com"

    fun isTrusted(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri = runCatching { URI(url) }.getOrNull() ?: return false
        if (!uri.scheme.equals("https", ignoreCase = true)) return false
        if (!uri.host.equals(HOST, ignoreCase = true)) return false
        return uri.port == -1 || uri.port == 443
    }
}
