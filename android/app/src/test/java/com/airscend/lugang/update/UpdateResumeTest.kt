// 鲁港通 - 更新包续传与重试判定用例
package com.airscend.lugang.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class UpdateResumeTest {

    @Test
    fun `解析 Content-Range 起点`() {
        assertEquals(1024L, UpdateResume.parseContentRangeStart("bytes 1024-2047/4096"))
        assertEquals(0L, UpdateResume.parseContentRangeStart("bytes 0-99/100"))
        assertNull(UpdateResume.parseContentRangeStart("bytes */4096"))
        assertNull(UpdateResume.parseContentRangeStart(null))
        assertNull(UpdateResume.parseContentRangeStart("items 1-2/3"))
    }

    @Test
    fun `206 且起点匹配时续传`() {
        assertEquals(UpdateResume.Plan.APPEND, UpdateResume.plan(206, 1024L, 1024L))
    }

    @Test
    fun `206 起点不匹配时删除分段重下`() {
        assertEquals(UpdateResume.Plan.REFETCH, UpdateResume.plan(206, 1024L, 0L))
        assertEquals(UpdateResume.Plan.REFETCH, UpdateResume.plan(206, 1024L, null))
    }

    @Test
    fun `服务器不支持 Range 时从头覆盖`() {
        assertEquals(UpdateResume.Plan.OVERWRITE, UpdateResume.plan(200, 1024L, null))
        assertEquals(UpdateResume.Plan.OVERWRITE, UpdateResume.plan(206, 0L, 0L))
    }

    @Test
    fun `区间失效时删除分段重下`() {
        assertEquals(UpdateResume.Plan.REFETCH, UpdateResume.plan(416, 4096L, null))
    }

    @Test
    fun `其它状态码判失败`() {
        assertEquals(UpdateResume.Plan.FAIL, UpdateResume.plan(404, 0L, null))
        assertEquals(UpdateResume.Plan.FAIL, UpdateResume.plan(500, 1024L, null))
    }

    @Test
    fun `最多自动重试两次且未完成才重试`() {
        assertTrue(UpdateResume.shouldRetry(0, 0L, 100L))
        assertTrue(UpdateResume.shouldRetry(1, 50L, 100L))
        assertFalse(UpdateResume.shouldRetry(2, 50L, 100L))
        assertFalse(UpdateResume.shouldRetry(0, 100L, 100L))
    }

    @Test
    fun `续传进度按总大小计算`() {
        assertEquals(25, UpdateResume.resumedPercent(25L, 100L))
        assertEquals(0, UpdateResume.resumedPercent(0L, 0L))
        assertEquals(100, UpdateResume.resumedPercent(200L, 100L))
    }

    @Test
    fun `分段文件名带版本号`() {
        assertEquals("lugang-105.apk.part", UpdateResume.partFile(File("."), 105).name)
    }
}
