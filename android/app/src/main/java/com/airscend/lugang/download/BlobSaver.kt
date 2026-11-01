// 鲁港通 - Blob 导出：分块写缓存，结束后一次性写入 MediaStore 的「下载/鲁港通」
package com.airscend.lugang.download

import android.content.ContentValues
import android.content.Context
import android.provider.MediaStore
import android.util.Base64
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class BlobSaver(private val context: Context) {

    private data class Session(
        val file: File,
        val name: String,
        val mime: String,
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
        return writeToDownloads(session)
    }

    fun abort(id: String?) {
        val session = sessions.remove(id) ?: return
        session.file.delete()
    }

    private fun writeToDownloads(session: Session): Boolean {
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
            return false
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
        return copied
    }

    companion object {
        private const val DIRECTORY = "Download/鲁港通"
    }
}
