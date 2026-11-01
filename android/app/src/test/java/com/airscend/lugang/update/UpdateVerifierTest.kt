package com.airscend.lugang.update

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateVerifierTest {

    @Test
    fun `大小与摘要一致时通过`() {
        assertTrue(UpdateVerifier.matches("abcd", 10L, "ABCD", 10L))
    }

    @Test
    fun `大小不一致拒绝`() {
        assertFalse(UpdateVerifier.matches("abcd", 10L, "abcd", 9L))
    }

    @Test
    fun `摘要不一致拒绝`() {
        assertFalse(UpdateVerifier.matches("abcd", 10L, "abce", 10L))
    }
}
