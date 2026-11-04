// 鲁港通 - 下载记录：JSON 编解码与去重截断，下载中心据此展示本机文件
package com.airscend.lugang.download

import org.json.JSONArray
import org.json.JSONObject

data class DownloadRecord(
    val uri: String,
    val name: String,
    val mime: String,
    val size: Long,
    val savedAt: Long
) {
    fun toJson(): JSONObject = JSONObject()
        .put("uri", uri)
        .put("name", name)
        .put("mime", mime)
        .put("size", size)
        .put("savedAt", savedAt)

    companion object {
        fun fromJson(json: JSONObject): DownloadRecord? {
            val uri = json.optString("uri").trim().takeIf { it.isNotEmpty() } ?: return null
            val name = json.optString("name").trim().takeIf { it.isNotEmpty() } ?: return null
            val mime = json.optString("mime").trim().ifEmpty { "application/octet-stream" }
            return DownloadRecord(
                uri = uri,
                name = name,
                mime = mime,
                size = json.optLong("size", 0L).coerceAtLeast(0L),
                savedAt = json.optLong("savedAt", 0L).coerceAtLeast(0L)
            )
        }
    }
}

object DownloadRecords {
    const val LIMIT = 200

    fun encode(records: List<DownloadRecord>): String {
        val array = JSONArray()
        records.forEach { array.put(it.toJson()) }
        return array.toString()
    }

    fun decode(raw: String?): List<DownloadRecord> {
        if (raw.isNullOrBlank()) return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { index ->
                array.optJSONObject(index)?.let { DownloadRecord.fromJson(it) }
            }
        }.getOrDefault(emptyList())
    }

    fun add(
        records: List<DownloadRecord>,
        record: DownloadRecord,
        limit: Int = LIMIT
    ): List<DownloadRecord> {
        val merged = ArrayList<DownloadRecord>(records.size + 1)
        merged.add(record)
        records.forEach { existing ->
            if (existing.uri != record.uri) merged.add(existing)
        }
        return if (merged.size > limit) merged.subList(0, limit).toList() else merged
    }

    fun remove(records: List<DownloadRecord>, uri: String): List<DownloadRecord> =
        records.filterNot { it.uri == uri }
}
