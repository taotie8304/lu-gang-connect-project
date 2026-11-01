package com.airscend.lugang.shell

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DiagnosticsTest {

    @Test
    fun `包含版本系统地址与错误`() {
        val text = Diagnostics.build(
            appVersion = "0.1.0",
            androidRelease = "14",
            model = "Pixel 7",
            url = "https://www.airscend.com/chat",
            error = "net::ERR_CONNECTION_TIMED_OUT",
            time = "2026-11-01 12:00:00"
        )
        assertEquals(5, text.lines().size)
        assertTrue(text.startsWith("鲁港通 0.1.0"))
        assertTrue(text.contains("Android 14 · Pixel 7"))
        assertTrue(text.contains("URL: https://www.airscend.com/chat"))
        assertTrue(text.contains("错误: net::ERR_CONNECTION_TIMED_OUT"))
        assertTrue(text.contains("时间: 2026-11-01 12:00:00"))
    }

    @Test
    fun `缺失地址与错误用占位符`() {
        val text = Diagnostics.build("0.1.0", "14", "Pixel 7", null, " ", "2026-11-01 12:00:00")
        assertTrue(text.contains("URL: （未知）"))
        assertTrue(text.contains("错误: （未知）"))
    }
}
