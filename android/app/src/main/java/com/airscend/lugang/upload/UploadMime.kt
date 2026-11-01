// 鲁港通 - 按网页 accept 生成系统文件选择器的 MIME 过滤条件
package com.airscend.lugang.upload

object UploadMime {
    private val EXTENSIONS = mapOf(
        ".jpg" to "image/jpeg",
        ".jpeg" to "image/jpeg",
        ".png" to "image/png",
        ".gif" to "image/gif",
        ".webp" to "image/webp",
        ".heic" to "image/heic",
        ".pdf" to "application/pdf",
        ".txt" to "text/plain",
        ".md" to "text/markdown",
        ".csv" to "text/csv",
        ".json" to "application/json",
        ".doc" to "application/msword",
        ".docx" to "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls" to "application/vnd.ms-excel",
        ".xlsx" to "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt" to "application/vnd.ms-powerpoint",
        ".pptx" to "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".zip" to "application/zip",
        ".mp4" to "video/mp4",
        ".mp3" to "audio/mpeg"
    )
    private val MIME = Regex("^[a-zA-Z0-9.+-]+/[a-zA-Z0-9.*+-]+$")
    private val IMAGE_EXTENSIONS = setOf(".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic")

    fun fromAccept(accept: String?): Array<String> {
        if (accept.isNullOrBlank()) return arrayOf("*/*")
        val result = LinkedHashSet<String>()
        for (raw in accept.split(",")) {
            val token = raw.trim()
            if (token.isEmpty()) continue
            when {
                token.startsWith(".") -> EXTENSIONS[token.lowercase()]?.let(result::add)
                MIME.matches(token) -> result.add(token)
            }
        }
        if (result.isEmpty()) return arrayOf("*/*")
        return result.toTypedArray()
    }

    fun allowsImages(accept: String?): Boolean {
        if (accept.isNullOrBlank()) return true
        return accept.split(",").any { raw ->
            val token = raw.trim().lowercase()
            token.isEmpty() || token == "*/*" || token.startsWith("image/") ||
                token in IMAGE_EXTENSIONS
        }
    }
}
