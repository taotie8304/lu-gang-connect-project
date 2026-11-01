// 鲁港通 - Content-Disposition 文件名解析用例
package com.airscend.lugang.download

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ContentDispositionTest {

    @Test
    fun `解析普通文件名`() {
        assertEquals("report.pdf", ContentDisposition.fileName("attachment; filename=\"report.pdf\""))
        assertEquals("a b.pdf", ContentDisposition.fileName("attachment; filename=a b.pdf"))
    }

    @Test
    fun `优先解析 RFC5987 中文文件名`() {
        val header = "attachment; filename=\"fallback.pdf\"; filename*=UTF-8''%E6%8A%A5%E5%91%8A.pdf"
        assertEquals("报告.pdf", ContentDisposition.fileName(header))
    }

    @Test
    fun `百分号编码的普通文件名也能还原`() {
        assertEquals("报告.pdf", ContentDisposition.fileName("attachment; filename=\"%E6%8A%A5%E5%91%8A.pdf\""))
    }

    @Test
    fun `没有文件名返回 null`() {
        assertNull(ContentDisposition.fileName(null))
        assertNull(ContentDisposition.fileName("attachment"))
        assertNull(ContentDisposition.fileName("filename=\"\""))
    }
}
