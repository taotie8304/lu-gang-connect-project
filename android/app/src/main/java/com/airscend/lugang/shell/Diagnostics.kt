// 鲁港通 - 错误页诊断信息：只收集公开信息，不含 Cookie、令牌与聊天内容
package com.airscend.lugang.shell

object Diagnostics {

    fun build(
        appVersion: String,
        androidRelease: String,
        model: String,
        url: String?,
        error: String?,
        time: String
    ): String {
        val safeUrl = url?.takeIf { it.isNotBlank() } ?: "（未知）"
        val safeError = error?.takeIf { it.isNotBlank() } ?: "（未知）"
        return listOf(
            "鲁港通 $appVersion",
            "Android $androidRelease · $model",
            "URL: $safeUrl",
            "错误: $safeError",
            "时间: $time"
        ).joinToString("\n")
    }
}
