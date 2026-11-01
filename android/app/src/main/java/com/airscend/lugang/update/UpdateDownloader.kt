// 鲁港通 - 更新包下载：进度弹窗、sha256/size 校验、系统安装器拉起
package com.airscend.lugang.update

import android.app.Activity
import android.app.ProgressDialog
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.core.content.FileProvider
import com.airscend.lugang.R
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class UpdateDownloader(private val activity: Activity) {

    fun download(manifest: UpdateManifest) {
        val dialog = ProgressDialog(activity).apply {
            setTitle(R.string.update_downloading)
            setMessage(manifest.versionName)
            isIndeterminate = false
            setProgressStyle(ProgressDialog.STYLE_HORIZONTAL)
            max = 100
            setCancelable(false)
            show()
        }
        Thread {
            val dir = File(activity.cacheDir, "updates").apply { mkdirs() }
            val target = File(dir, "lugang-${manifest.versionCode}.apk")
            val downloaded = runCatching { downloadTo(manifest, target, dialog) }.getOrDefault(false)
            // 鲁港通 - 校验计算自身也可能抛异常（文件被清理/存储异常），必须兜底，避免下载线程崩溃且弹窗不关
            val verified = downloaded && runCatching {
                UpdateVerifier.matches(manifest.sha256, manifest.size, Sha256.ofFile(target), target.length())
            }.getOrDefault(false)
            if (!verified) target.delete()
            activity.runOnUiThread {
                runCatching { dialog.dismiss() }
                if (verified) {
                    install(target)
                } else {
                    Toast.makeText(activity, R.string.update_failed, Toast.LENGTH_LONG).show()
                }
            }
        }.apply { name = "lugang-update-download" }.start()
    }

    private fun downloadTo(
        manifest: UpdateManifest,
        target: File,
        dialog: ProgressDialog
    ): Boolean {
        val connection = (URL(manifest.apkUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 30_000
        }
        try {
            if (connection.responseCode != HttpURLConnection.HTTP_OK) return false
            val total = connection.contentLengthLong.takeIf { it > 0 } ?: manifest.size
            var received = 0L
            var lastPercent = -1
            connection.inputStream.use { input ->
                target.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read <= 0) break
                        output.write(buffer, 0, read)
                        received += read
                        val percent = ((received * 100) / total).toInt().coerceIn(0, 100)
                        if (percent != lastPercent) {
                            lastPercent = percent
                            activity.runOnUiThread { dialog.progress = percent }
                        }
                    }
                }
            }
            return target.length() == manifest.size
        } finally {
            connection.disconnect()
        }
    }

    private fun install(file: File) {
        val canInstall = runCatching { activity.packageManager.canRequestPackageInstalls() }.getOrDefault(false)
        if (!canInstall) {
            Toast.makeText(activity, R.string.update_install_hint, Toast.LENGTH_LONG).show()
            runCatching {
                activity.startActivity(
                    Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.packageName)
                    )
                )
            }
            return
        }
        val uri = FileProvider.getUriForFile(
            activity,
            activity.packageName + ".fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { activity.startActivity(intent) }
            .onFailure {
                Toast.makeText(activity, R.string.update_failed, Toast.LENGTH_LONG).show()
            }
    }
}
