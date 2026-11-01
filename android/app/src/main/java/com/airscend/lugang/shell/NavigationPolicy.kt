// 鲁港通 - 导航策略：站内留在壳内，站外交给系统，其余一律拒绝
package com.airscend.lugang.shell

import java.net.URI

enum class NavAction { INTERNAL, EXTERNAL, BLOCK }

object NavigationPolicy {
    private const val INTERNAL_HOST = "www.airscend.com"
    private val EXTERNAL_SCHEMES = setOf("http", "https", "mailto", "tel")

    fun decide(url: String?): NavAction {
        if (url.isNullOrBlank()) return NavAction.BLOCK
        val uri = runCatching { URI(url) }.getOrNull() ?: return NavAction.BLOCK
        val scheme = uri.scheme?.lowercase() ?: return NavAction.BLOCK
        val internal = scheme == "https" && uri.host?.lowercase() == INTERNAL_HOST
        if (internal) return NavAction.INTERNAL
        return if (scheme in EXTERNAL_SCHEMES) NavAction.EXTERNAL else NavAction.BLOCK
    }
}
