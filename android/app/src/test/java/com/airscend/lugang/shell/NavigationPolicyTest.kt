package com.airscend.lugang.shell

import org.junit.Assert.assertEquals
import org.junit.Test

class NavigationPolicyTest {

    @Test
    fun `站内 https 留在应用内`() {
        assertEquals(NavAction.INTERNAL, NavigationPolicy.decide("https://www.airscend.com/chat"))
        assertEquals(NavAction.INTERNAL, NavigationPolicy.decide("https://www.airscend.com/chat/abc?x=1"))
    }

    @Test
    fun `站外 https 交给系统浏览器`() {
        assertEquals(NavAction.EXTERNAL, NavigationPolicy.decide("https://www.info.gov.hk/"))
        assertEquals(NavAction.EXTERNAL, NavigationPolicy.decide("https://www.airscend.com.evil.com/chat"))
    }

    @Test
    fun `http 与电话邮件交给系统`() {
        assertEquals(NavAction.EXTERNAL, NavigationPolicy.decide("http://www.airscend.com/chat"))
        assertEquals(NavAction.EXTERNAL, NavigationPolicy.decide("mailto:hello@airscend.com"))
        assertEquals(NavAction.EXTERNAL, NavigationPolicy.decide("tel:+85212345678"))
    }

    @Test
    fun `危险协议一律拒绝`() {
        assertEquals(NavAction.BLOCK, NavigationPolicy.decide("javascript:alert(1)"))
        assertEquals(NavAction.BLOCK, NavigationPolicy.decide("intent://scan/#Intent;scheme=zxing;end"))
        assertEquals(NavAction.BLOCK, NavigationPolicy.decide("file:///etc/passwd"))
        assertEquals(NavAction.BLOCK, NavigationPolicy.decide("data:text/html,hello"))
        assertEquals(NavAction.BLOCK, NavigationPolicy.decide(null))
        assertEquals(NavAction.BLOCK, NavigationPolicy.decide(""))
        assertEquals(NavAction.BLOCK, NavigationPolicy.decide("not a url"))
    }
}
