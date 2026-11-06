// 鲁港通 - 更新检查：静默拉取 latest.json，失败不打扰，24 小时节流
package com.airscend.lugang.update

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.net.HttpURLConnection
import java.net.URL

// 鲁港通 - 手动检查更新的结果：有新版本 / 已是最新 / 检查失败（网络或清单异常）
sealed class UpdateCheckResult {
    data class Available(val manifest: UpdateManifest) : UpdateCheckResult()
    object UpToDate : UpdateCheckResult()
    object Failed : UpdateCheckResult()
}

class UpdateChecker(
    context: Context,
    private val currentVersionCode: Int,
    private val onUpdateAvailable: (UpdateManifest) -> Unit
) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val mainHandler = Handler(Looper.getMainLooper())

    fun scheduleStartupCheck() {
        mainHandler.postDelayed({ checkIfDue() }, UpdatePolicy.STARTUP_DELAY_MS)
    }

    fun checkIfDue() {
        val now = System.currentTimeMillis()
        if (!UpdatePolicy.isDue(prefs.getLong(KEY_LAST_CHECK, 0L), now)) return
        Thread {
            val manifest = fetchManifest() ?: return@Thread
            prefs.edit().putLong(KEY_LAST_CHECK, System.currentTimeMillis()).apply()
            if (UpdatePolicy.isNewer(manifest.versionCode, currentVersionCode)) {
                mainHandler.post { onUpdateAvailable(manifest) }
            }
        }.apply { name = "lugang-update-check" }.start()
    }

    // 鲁港通 - 用户主动检查：跳过 24 小时节流，失败与已最新也必须回执，结果统一回主线程
    fun checkNow(onResult: (UpdateCheckResult) -> Unit) {
        Thread {
            val manifest = fetchManifest()
            val result = if (manifest == null) {
                UpdateCheckResult.Failed
            } else {
                prefs.edit().putLong(KEY_LAST_CHECK, System.currentTimeMillis()).apply()
                if (UpdatePolicy.isNewer(manifest.versionCode, currentVersionCode)) {
                    UpdateCheckResult.Available(manifest)
                } else {
                    UpdateCheckResult.UpToDate
                }
            }
            mainHandler.post { onResult(result) }
        }.apply { name = "lugang-update-check-now" }.start()
    }

    // 鲁港通 - 整段抓取兜底：地址构造、建连、读流、解析任一失败都只返回 null，不抛到线程外
    private fun fetchManifest(): UpdateManifest? = runCatching {
        val url = URL("$MANIFEST_URL?ts=${System.currentTimeMillis()}")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 10_000
            requestMethod = "GET"
            setRequestProperty("Cache-Control", "no-cache")
        }
        try {
            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                UpdateManifest.parse(body)
            } else {
                null
            }
        } finally {
            connection.disconnect()
        }
    }.getOrNull()

    companion object {
        private const val PREFS = "lugang_update"
        private const val KEY_LAST_CHECK = "last_check_at"
        private const val MANIFEST_URL = "https://www.airscend.com/android/updates/latest.json"
    }
}
