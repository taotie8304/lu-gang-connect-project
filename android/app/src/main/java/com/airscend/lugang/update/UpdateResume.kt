// 鲁港通 - 更新包续传纯逻辑：Range 规划、Content-Range 解析与重试判定
package com.airscend.lugang.update

import java.io.File

object UpdateResume {
    const val MAX_RETRIES = 2

    enum class Plan { APPEND, OVERWRITE, REFETCH, FAIL }

    fun plan(responseCode: Int, partLength: Long, contentRangeStart: Long?): Plan = when {
        responseCode == 206 && partLength > 0L && contentRangeStart == partLength -> Plan.APPEND
        responseCode == 206 && partLength > 0L -> Plan.REFETCH
        responseCode == 206 -> Plan.OVERWRITE
        responseCode == 200 -> Plan.OVERWRITE
        responseCode == 416 -> Plan.REFETCH
        else -> Plan.FAIL
    }

    fun parseContentRangeStart(header: String?): Long? {
        val value = header?.trim().orEmpty()
        if (!value.startsWith("bytes ", ignoreCase = true)) return null
        val range = value.substring(6).substringBefore('/').trim()
        val start = range.substringBefore('-').trim()
        return start.toLongOrNull()?.takeIf { it >= 0L }
    }

    fun shouldRetry(retryIndex: Int, receivedBytes: Long, totalBytes: Long): Boolean =
        retryIndex < MAX_RETRIES && receivedBytes < totalBytes

    fun partFile(dir: File, versionCode: Int): File = File(dir, "lugang-$versionCode.apk.part")

    fun resumedPercent(receivedBytes: Long, totalBytes: Long): Int {
        if (totalBytes <= 0L) return 0
        return ((receivedBytes.coerceAtLeast(0L) * 100) / totalBytes).toInt().coerceIn(0, 100)
    }
}
