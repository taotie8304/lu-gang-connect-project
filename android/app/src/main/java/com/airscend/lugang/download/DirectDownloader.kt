// 鲁港通 - 直链下载：交给系统 DownloadManager，完成后产出下载记录
package com.airscend.lugang.download

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment

class DirectDownloader(private val context: Context) {
    private val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

    private data class Meta(val name: String, val mime: String)

    var lastDownloadId: Long? = null
        private set
    private var lastMeta: Meta? = null

    fun enqueue(
        url: String,
        contentDisposition: String?,
        mimeType: String?,
        cookie: String?,
        userAgent: String?
    ): Long? {
        if (!url.startsWith("https://")) return null
        val fallback = url.substringAfterLast('/').substringBefore('?').ifBlank { null }
        val fileName = DownloadsQuery.uniqueName(
            context,
            ContentDisposition.fileName(contentDisposition) ?: fallback
        )
        val mime = mimeType?.takeIf { it.isNotBlank() } ?: "application/octet-stream"
        return runCatching {
            val request = DownloadManager.Request(Uri.parse(url))
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "鲁港通/$fileName")
                .setTitle(fileName)
                .setMimeType(mime)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false)
            if (!cookie.isNullOrBlank()) request.addRequestHeader("Cookie", cookie)
            if (!userAgent.isNullOrBlank()) request.addRequestHeader("User-Agent", userAgent)
            manager.enqueue(request)
        }.getOrNull()?.also {
            lastDownloadId = it
            lastMeta = Meta(fileName, mime)
        }
    }

    fun statusOf(id: Long): Int {
        val query = DownloadManager.Query().setFilterById(id)
        return runCatching {
            manager.query(query)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                } else {
                    DownloadManager.STATUS_FAILED
                }
            } ?: DownloadManager.STATUS_FAILED
        }.getOrDefault(DownloadManager.STATUS_FAILED)
    }

    fun completionRecord(id: Long): DownloadRecord? {
        if (id != lastDownloadId) return null
        val meta = lastMeta ?: return null
        val uri = runCatching { manager.getUriForDownloadedFile(id) }.getOrNull() ?: return null
        return DownloadRecord(
            uri = uri.toString(),
            name = meta.name,
            mime = meta.mime,
            size = sizeOf(id),
            savedAt = System.currentTimeMillis()
        )
    }

    private fun sizeOf(id: Long): Long = runCatching {
        manager.query(DownloadManager.Query().setFilterById(id))?.use { cursor ->
            if (cursor.moveToFirst()) {
                cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
            } else {
                0L
            }
        } ?: 0L
    }.getOrDefault(0L)
}
