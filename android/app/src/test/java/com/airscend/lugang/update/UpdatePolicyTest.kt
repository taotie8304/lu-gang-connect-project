package com.airscend.lugang.update

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdatePolicyTest {

    @Test
    fun `首次检查立即到期`() {
        assertTrue(UpdatePolicy.isDue(0L, 1_000L))
    }

    @Test
    fun `24 小时内不重复`() {
        val last = 1_000_000L
        assertFalse(UpdatePolicy.isDue(last, last + UpdatePolicy.CHECK_INTERVAL_MS - 1))
    }

    @Test
    fun `满 24 小时再次到期`() {
        val last = 1_000_000L
        assertTrue(UpdatePolicy.isDue(last, last + UpdatePolicy.CHECK_INTERVAL_MS))
    }

    @Test
    fun `系统时间回拨不触发`() {
        assertFalse(UpdatePolicy.isDue(10_000L, 5_000L))
    }

    @Test
    fun `更高版本号才算更新`() {
        assertTrue(UpdatePolicy.isNewer(101, 100))
        assertFalse(UpdatePolicy.isNewer(100, 100))
        assertFalse(UpdatePolicy.isNewer(99, 100))
    }
}
