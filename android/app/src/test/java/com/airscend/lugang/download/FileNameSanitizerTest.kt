// 鲁港通 - 文件名清洗与重名处理用例
package com.airscend.lugang.download

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FileNameSanitizerTest {

    @Test
    fun `去掉路径与危险字符`() {
        assertEquals("b.pdf", FileNameSanitizer.sanitize("../../b.pdf"))
        assertEquals("passwd", FileNameSanitizer.sanitize("C:\\etc\\passwd"))
        // 鲁港通 - 实现按「每段非法字符替换为下划线」处理，三个独立非法字符各产生一个下划线
        assertEquals("a_b_c_.pdf", FileNameSanitizer.sanitize("a:b*c?.pdf"))
    }

    @Test
    fun `空名回退中文默认名`() {
        assertEquals("鲁港通导出", FileNameSanitizer.sanitize(null))
        assertEquals("鲁港通导出", FileNameSanitizer.sanitize("   "))
        assertEquals("鲁港通导出", FileNameSanitizer.sanitize("..."))
    }

    @Test
    fun `超长文件名保留扩展名`() {
        val name = FileNameSanitizer.sanitize("a".repeat(200) + ".pdf")
        assertTrue(name.length <= 120)
        assertTrue(name.endsWith(".pdf"))
    }

    @Test
    fun `控制字符被移除`() {
        assertEquals("ab.txt", FileNameSanitizer.sanitize("a\u0000b.txt"))
    }

    @Test
    fun `重名追加序号`() {
        val taken = setOf("报告.pdf", "报告(1).pdf")
        assertEquals("报告(2).pdf", FileNameSanitizer.unique("报告.pdf") { it in taken })
        assertEquals("新文件.pdf", FileNameSanitizer.unique("新文件.pdf") { it in taken })
    }
}
