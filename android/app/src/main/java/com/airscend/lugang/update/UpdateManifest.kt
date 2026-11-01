// 鲁港通 - 更新清单：解析并校验 versionCode / apkUrl / sha256 / size
package com.airscend.lugang.update

import org.json.JSONObject

data class UpdateManifest(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val sha256: String,
    val size: Long,
    val changelog: String,
    val publishedAt: String?
) {
    companion object {
        private val SHA256_PATTERN = Regex("^[0-9a-f]{64}$")

        fun parse(json: String): UpdateManifest? {
            val obj = runCatching { JSONObject(json) }.getOrNull() ?: return null
            val versionCode = obj.optInt("versionCode", 0)
            val versionName = obj.optString("versionName", "").trim()
            val apkUrl = obj.optString("apkUrl", "").trim()
            val sha256 = obj.optString("sha256", "").trim().lowercase()
            val size = obj.optLong("size", 0L)
            if (versionCode <= 0 || versionName.isEmpty()) return null
            if (!apkUrl.startsWith("https://", ignoreCase = true)) return null
            if (!SHA256_PATTERN.matches(sha256)) return null
            if (size <= 0L) return null
            val changelog = obj.optString("changelog", "")
            val publishedAt = obj.optString("publishedAt", "").ifBlank { null }
            return UpdateManifest(
                versionCode = versionCode,
                versionName = versionName,
                apkUrl = apkUrl,
                sha256 = sha256,
                size = size,
                changelog = changelog,
                publishedAt = publishedAt
            )
        }
    }
}
