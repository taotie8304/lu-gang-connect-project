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
        ".bmp" to "image/bmp",
        ".svg" to "image/svg+xml",
        ".pdf" to "application/pdf",
        ".txt" to "text/plain",
        ".md" to "text/markdown",
        ".html" to "text/html",
        ".csv" to "text/csv",
        ".json" to "application/json",
        ".doc" to "application/msword",
        ".docx" to "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".docm" to "application/vnd.ms-word.document.macroenabled.12",
        ".wps" to "application/vnd.ms-works",
        ".rtf" to "application/rtf",
        ".odt" to "application/vnd.oasis.opendocument.text",
        ".ods" to "application/vnd.oasis.opendocument.spreadsheet",
        ".odp" to "application/vnd.oasis.opendocument.presentation",
        ".epub" to "application/epub+zip",
        ".xls" to "application/vnd.ms-excel",
        ".xlsx" to "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsm" to "application/vnd.ms-excel.sheet.macroenabled.12",
        ".xlsb" to "application/vnd.ms-excel.sheet.binary.macroenabled.12",
        ".ppt" to "application/vnd.ms-powerpoint",
        ".pptx" to "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".pps" to "application/vnd.ms-powerpoint",
        ".pot" to "application/vnd.ms-powerpoint",
        ".pptm" to "application/vnd.ms-powerpoint.presentation.macroenabled.12",
        ".ppsx" to "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
        ".ppsm" to "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
        ".zip" to "application/zip",
        ".mov" to "video/quicktime",
        ".avi" to "video/x-msvideo",
        ".mpeg" to "video/mpeg",
        ".webm" to "video/webm",
        ".mp4" to "video/mp4",
        ".mp3" to "audio/mpeg",
        ".wav" to "audio/x-wav",
        ".ogg" to "audio/ogg",
        ".m4a" to "audio/mp4",
        ".amr" to "audio/amr",
        ".mpga" to "audio/mpeg"
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
