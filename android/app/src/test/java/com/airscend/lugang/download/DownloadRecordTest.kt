// 鲁港通 - 下载记录编解码、去重与截断用例
package com.airscend.lugang.download

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DownloadRecordTest {

    private fun record(uri: String, savedAt: Long = 1L) = DownloadRecord(
        uri = uri,
        name = "报告.pdf",
        mime = "application/pdf",
        size = 1024L,
        savedAt = savedAt
    )

    @Test
    fun `编解码往返保持字段`() {
        val records = listOf(record("content://downloads/1"), record("content://downloads/2"))
        assertEquals(records, DownloadRecords.decode(DownloadRecords.encode(records)))
    }

    @Test
    fun `损坏或缺字段的记录被丢弃`() {
        val raw = """[{"uri":"content://ok","name":"a.pdf"},{"name":"无地址"},{"uri":"  ","name":"空地址"},"字符串"]"""
        val decoded = DownloadRecords.decode(raw)
        assertEquals(1, decoded.size)
        assertEquals("content://ok", decoded[0].uri)
        assertEquals("application/octet-stream", decoded[0].mime)
    }

    @Test
    fun `非法 JSON 返回空列表`() {
        assertTrue(DownloadRecords.decode("{not json").isEmpty())
        assertTrue(DownloadRecords.decode(null).isEmpty())
        assertTrue(DownloadRecords.decode("  ").isEmpty())
    }

    @Test
    fun `新增记录置顶且按 uri 去重`() {
        val merged = DownloadRecords.add(
            listOf(record("a", 1), record("b", 2)),
            record("b", 3)
        )
        assertEquals(listOf("b", "a"), merged.map { it.uri })
        assertEquals(3L, merged[0].savedAt)
    }

    @Test
    fun `超过上限只保留最新记录`() {
        val existing = (1..200).map { record("u$it", it.toLong()) }
        val merged = DownloadRecords.add(existing, record("new", 999L))
        assertEquals(200, merged.size)
        assertEquals("new", merged.first().uri)
        assertEquals("u199", merged.last().uri)
    }

    @Test
    fun `移除记录按 uri 精确匹配`() {
        val merged = DownloadRecords.remove(listOf(record("a"), record("b")), "a")
        assertEquals(listOf("b"), merged.map { it.uri })
    }
}
