package com.airscend.lugang.shell

import org.junit.Assert.assertEquals
import org.junit.Test

class ShellInsetsTest {

    @Test
    fun `无键盘时按系统栏边距留白`() {
        val padding = ShellInsets.resolve(
            barLeft = 0,
            barTop = 72,
            barRight = 0,
            barBottom = 48,
            imeBottom = 0
        )
        assertEquals(0, padding.left)
        assertEquals(72, padding.top)
        assertEquals(0, padding.right)
        assertEquals(48, padding.bottom)
    }

    @Test
    fun `键盘弹出时底部跟随键盘高度`() {
        val padding = ShellInsets.resolve(
            barLeft = 0,
            barTop = 72,
            barRight = 0,
            barBottom = 48,
            imeBottom = 900
        )
        assertEquals(900, padding.bottom)
    }

    @Test
    fun `键盘高度小于导航栏时保留导航栏边距`() {
        val padding = ShellInsets.resolve(
            barLeft = 0,
            barTop = 72,
            barRight = 0,
            barBottom = 48,
            imeBottom = 20
        )
        assertEquals(48, padding.bottom)
    }

    @Test
    fun `横屏时左右系统栏边距同样生效`() {
        val padding = ShellInsets.resolve(
            barLeft = 60,
            barTop = 0,
            barRight = 60,
            barBottom = 48,
            imeBottom = 0
        )
        assertEquals(60, padding.left)
        assertEquals(60, padding.right)
    }
}
