package com.airscend.lugang.bridge

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeOriginTest {

    @Test
    fun `可信主框架来源`() {
        assertTrue(BridgeOrigin.isTrusted("https://www.airscend.com/chat"))
        assertTrue(BridgeOrigin.isTrusted("https://www.airscend.com:443/chat/abc?x=1"))
    }

    @Test
    fun `不可信来源一律拒绝`() {
        assertFalse(BridgeOrigin.isTrusted(null))
        assertFalse(BridgeOrigin.isTrusted(""))
        assertFalse(BridgeOrigin.isTrusted("http://www.airscend.com/chat"))
        assertFalse(BridgeOrigin.isTrusted("https://airscend.com/chat"))
        assertFalse(BridgeOrigin.isTrusted("https://www.airscend.com.evil.com/chat"))
        assertFalse(BridgeOrigin.isTrusted("https://www.airscend.com:8443/chat"))
        assertFalse(BridgeOrigin.isTrusted("not a url"))
    }
}
