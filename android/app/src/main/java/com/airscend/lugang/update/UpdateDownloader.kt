// 鲁港通 - 更新包下载：.part 断点续传、自动重试、sha256/size 校验、系统安装器拉起
package com.airscend.lugang.update

import android.app.Activity
import android.app.ProgressDialog
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.content.FileProvider
import com.airscend.lugang.R
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class UpdateDownloader(private val activity: Activity) {

    @Volatile
    private var running = false

    fun download(manifest: UpdateManifest) {
        if (running) return
        running = true
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
            val part = UpdateResume.partFile(dir, manifest.versionCode)
            val target = File(dir, "lugang-${manifest.versionCode}.apk")
            var retries = 0
            while (true) {
                val ok = runCatching { downloadTo(manifest, part, dialog) }.isSuccess
                if (ok) break
                if (!UpdateResume.shouldRetry(retries, part.length(), manifest.size)) break
                retries++
                runCatching { Thread.sleep(1_500L * retries) }
            }
            // 鲁港通 - 校验计算自身也可能抛异常（文件被清理/存储异常），必须兜底，避免下载线程崩溃且弹窗不关
            val complete = part.length() == manifest.size
            val verified = complete && runCatching {
                UpdateVerifier.matches(manifest.sha256, manifest.size, Sha256.ofFile(part), part.length())
            }.getOrDefault(false)
            if (complete && !verified) part.delete()
            val ready = verified && runCatching {
                target.delete()
                if (!part.renameTo(target)) part.copyTo(target, overwrite = true)
                true
            }.getOrDefault(false)
            if (ready) part.delete()
            val failureMessage = when {
                ready -> 0
                complete -> R.string.update_failed_verify
                part.exists() && part.length() > 0L -> R.string.update_failed_network
                else -> R.string.update_failed_plain
            }
            activity.runOnUiThread {
                running = false
                runCatching { dialog.dismiss() }
                if (ready) {
                    install(target)
                } else {
                    showFailure(manifest, failureMessage)
                }
            }
        }.apply { name = "lugang-update-download" }.start()
    }

    // 鲁港通 - 单次下载尝试：已有 .part 时按 Range 续传，服务端不配合则覆盖重下
    private fun downloadTo(
        manifest: UpdateManifest,
        part: File,
        dialog: ProgressDialog
    ) {
        if (part.length() > manifest.size) part.delete()
        val offset = if (part.exists()) part.length() else 0L
        val connection = (URL(manifest.apkUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 30_000
        }
        try {
            if (offset > 0L) connection.setRequestProperty("Range", "bytes=$offset-")
            val code = connection.responseCode
            val plan = UpdateResume.plan(
                code,
                offset,
                UpdateResume.parseContentRangeStart(connection.getHeaderField("Content-Range"))
            )
            when (plan) {
                UpdateResume.Plan.REFETCH -> {
                    part.delete()
                    throw IOException("需要重新下载")
                }
                UpdateResume.Plan.FAIL -> throw IOException("HTTP $code")
                else -> Unit
            }
            val append = plan == UpdateResume.Plan.APPEND
            var received = if (append) offset else 0L
            var lastPercent = -1
            FileOutputStream(part, append).use { output ->
                connection.inputStream.use { input ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read <= 0) break
                        output.write(buffer, 0, read)
                        received += read
                        val percent = UpdateResume.resumedPercent(received, manifest.size)
                        if (percent != lastPercent) {
                            lastPercent = percent
                            activity.runOnUiThread { runCatching { dialog.progress = percent } }
                        }
                    }
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun showFailure(manifest: UpdateManifest, messageRes: Int) {
        if (activity.isFinishing || activity.isDestroyed) return
        AlertDialog.Builder(activity)
            .setTitle(R.string.update_failed_title)
            .setMessage(messageRes)
            .setPositiveButton(R.string.error_retry) { _, _ -> download(manifest) }
            .setNegativeButton(R.string.update_later, null)
            .show()
    }

    private fun install(file: File) {
        val canInstall = runCatching { activity.packageManager.canRequestPackageInstalls() }.getOrDefault(false)
        if (!canInstall) {
            // 鲁港通 - 首次安装需要用户去系统设置授权，直接跳设置会让用户不知道刚才发生了什么
            AlertDialog.Builder(activity)
                .setTitle(R.string.update_install_permission_title)
                .setMessage(R.string.update_install_permission_message)
                .setPositiveButton(R.string.update_install_permission_action) { _, _ ->
                    runCatching {
                        activity.startActivity(
                            Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + activity.packageName)
                            )
                        )
                    }
                }
                .setNegativeButton(R.string.update_later, null)
                .show()
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
