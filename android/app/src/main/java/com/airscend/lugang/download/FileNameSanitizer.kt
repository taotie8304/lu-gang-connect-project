// 鲁港通 - 文件名清洗：去路径、去控制字符、非法字符折叠为下划线、长度上限 120
package com.airscend.lugang.download

object FileNameSanitizer {
    private const val MAX_LENGTH = 120
    private const val FALLBACK = "鲁港通导出"
    private val ILLEGAL = Regex("[\\\\/:*?\"<>|]+")
    private val CONTROL = Regex("[\\u0000-\\u001F\\u007F]")

    fun sanitize(raw: String?): String {
        val base = (raw ?: "").substringAfterLast('/').substringAfterLast('\\')
        val cleaned = CONTROL.replace(base, "")
            .replace(ILLEGAL, "_")
            .trim()
            .trim('.')
        if (cleaned.isEmpty()) return FALLBACK
        if (cleaned.length <= MAX_LENGTH) return cleaned
        val dot = cleaned.lastIndexOf('.')
        if (dot > 0 && cleaned.length - dot <= 12) {
            val extension = cleaned.substring(dot)
            val head = cleaned.substring(0, MAX_LENGTH - extension.length).trimEnd('.', ' ')
            return head + extension
        }
        return cleaned.substring(0, MAX_LENGTH).trimEnd('.', ' ')
    }

    fun unique(name: String, exists: (String) -> Boolean): String {
        if (!exists(name)) return name
        val dot = name.lastIndexOf('.')
        val base = if (dot > 0) name.substring(0, dot) else name
        val extension = if (dot > 0) name.substring(dot) else ""
        var index = 1
        while (true) {
            val candidate = "$base($index)$extension"
            if (!exists(candidate)) return candidate
            index++
        }
    }
}
