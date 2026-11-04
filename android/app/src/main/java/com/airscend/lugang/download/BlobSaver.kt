// 鲁港通 - Blob 导出：分块写缓存，结束后写入 MediaStore 的「下载/鲁港通」并记录到下载中心
package com.airscend.lugang.download

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import android.util.Base64
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class BlobSaver(private val context: Context, private val store: DownloadStore) {

    private data class Session(
        val file: File,
        val name: String,
        val mime: String,
        val size: Long,
        val budget: BlobBudget
    )

    private val sessions = ConcurrentHashMap<String, Session>()

    fun start(name: String?, mime: String?, size: Long): String? {
        if (sessions.isNotEmpty()) return null
        val budget = BlobBudget(size)
        if (!budget.isDeclaredSizeValid()) return null
        val dir = File(context.cacheDir, "blob").apply { mkdirs() }
        val id = UUID.randomUUID().toString()
        sessions[id] = Session(
            file = File(dir, "$id.part"),
            name = DownloadsQuery.uniqueName(context, name),
            mime = mime?.takeIf { it.isNotBlank() } ?: "application/octet-stream",
            size = size,
            budget = budget
        )
        return id
    }

    fun append(id: String?, base64: String?): Boolean {
        val session = sessions[id] ?: return false
        val bytes = runCatching {
            Base64.decode(base64 ?: return false, Base64.DEFAULT)
        }.getOrNull() ?: return false
        if (!session.budget.accept(bytes.size)) return false
        return runCatching {
            session.file.appendBytes(bytes)
            true
        }.getOrDefault(false)
    }

    fun finish(id: String?): Boolean {
        val session = sessions.remove(id) ?: return false
        if (!session.budget.isComplete()) {
            session.file.delete()
            return false
        }
        val uri = writeToDownloads(session) ?: return false
        store.add(
            DownloadRecord(
                uri = uri.toString(),
                name = session.name,
                mime = session.mime,
                size = session.size,
                savedAt = System.currentTimeMillis()
            )
        )
        return true
    }

    fun abort(id: String?) {
        val session = sessions.remove(id) ?: return
        session.file.delete()
    }

    private fun writeToDownloads(session: Session): Uri? {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, session.name)
            put(MediaStore.Downloads.MIME_TYPE, session.mime)
            put(MediaStore.Downloads.RELATIVE_PATH, DIRECTORY)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        if (uri == null) {
            session.file.delete()
            return null
        }
        val copied = runCatching {
            resolver.openOutputStream(uri)?.use { output ->
                session.file.inputStream().use { input -> input.copyTo(output) }
            } ?: error("无法打开输出流")
        }.isSuccess
        if (copied) {
            val pending = ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }
            resolver.update(uri, pending, null, null)
        } else {
            resolver.delete(uri, null, null)
        }
        session.file.delete()
        return if (copied) uri else null
    }

    companion object {
        private const val DIRECTORY = "Download/鲁港通"
    }
}
