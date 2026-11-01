package com.airscend.lugang.upload

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UploadMimeTest {

    @Test
    fun `扩展名映射为 MIME`() {
        assertArrayEquals(arrayOf("image/jpeg"), UploadMime.fromAccept(".jpg,.jpeg"))
        assertArrayEquals(arrayOf("application/pdf"), UploadMime.fromAccept(".pdf"))
    }

    @Test
    fun `混合 accept 去重保序`() {
        assertArrayEquals(arrayOf("image/*", "application/pdf"), UploadMime.fromAccept("image/*, .pdf, image/*"))
    }

    @Test
    fun `未知扩展名跳过而非放宽为任意文件`() {
        assertArrayEquals(
            arrayOf("image/jpeg", "application/pdf"),
            UploadMime.fromAccept(".jpg,.unknown,.pdf")
        )
    }

    @Test
    fun `空或未知回退为任意文件`() {
        assertArrayEquals(arrayOf("*/*"), UploadMime.fromAccept(null))
        assertArrayEquals(arrayOf("*/*"), UploadMime.fromAccept(""))
        assertArrayEquals(arrayOf("*/*"), UploadMime.fromAccept(".unknown"))
    }

    @Test
    fun `判断是否允许拍照`() {
        assertTrue(UploadMime.allowsImages(null))
        assertTrue(UploadMime.allowsImages("image/*,.pdf"))
        assertTrue(UploadMime.allowsImages(".jpg"))
        assertFalse(UploadMime.allowsImages("application/pdf,.docx"))
    }
}
