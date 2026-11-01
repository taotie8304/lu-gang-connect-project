package com.airscend.lugang.shell

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VersionCodesTest {

    @Test
    fun `0_1_0 映射为 100`() {
        assertEquals(100, VersionCodes.fromName("0.1.0"))
    }

    @Test
    fun `1_2_3 映射为 10203`() {
        assertEquals(10203, VersionCodes.fromName("1.2.3"))
    }

    @Test
    fun `非法版本名返回 null`() {
        assertNull(VersionCodes.fromName("1.2"))
        assertNull(VersionCodes.fromName("1.2.x"))
        assertNull(VersionCodes.fromName("1.2.100"))
        assertNull(VersionCodes.fromName(""))
    }
}
