// 鲁港通 - 解析 Content-Disposition 文件名，优先 RFC 5987 扩展参数
package com.airscend.lugang.download

import java.net.URLDecoder

object ContentDisposition {
    private val EXTENDED = Regex("filename\\*\\s*=\\s*([^']*)''([^;]+)", RegexOption.IGNORE_CASE)
    private val PLAIN = Regex("filename\\s*=\\s*(\"([^\"]*)\"|([^;]+))", RegexOption.IGNORE_CASE)
    private val PERCENT = Regex("%[0-9A-Fa-f]{2}")

    fun fileName(header: String?): String? {
        if (header.isNullOrBlank()) return null
        EXTENDED.find(header)?.let { match ->
            val charset = match.groupValues[1].ifBlank { "UTF-8" }
            val value = decode(match.groupValues[2].trim(), charset)
            if (!value.isNullOrBlank()) return value
        }
        PLAIN.find(header)?.let { match ->
            val raw = match.groupValues[2].ifBlank { match.groupValues[3] }.trim()
            val value = if (PERCENT.containsMatchIn(raw)) decode(raw, "UTF-8") else raw
            if (!value.isNullOrBlank()) return value
        }
        return null
    }

    private fun decode(value: String, charset: String): String? =
        runCatching { URLDecoder.decode(value.replace("+", "%2B"), charset) }.getOrNull()
}
