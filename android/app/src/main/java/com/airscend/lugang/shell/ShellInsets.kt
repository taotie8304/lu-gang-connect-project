// 鲁港通 - 安全区换算：系统栏与键盘底部取并集，避免底部双重留白
package com.airscend.lugang.shell

data class ShellPadding(
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int
)

object ShellInsets {

    fun resolve(
        barLeft: Int,
        barTop: Int,
        barRight: Int,
        barBottom: Int,
        imeBottom: Int
    ): ShellPadding = ShellPadding(
        left = barLeft.coerceAtLeast(0),
        top = barTop.coerceAtLeast(0),
        right = barRight.coerceAtLeast(0),
        bottom = maxOf(barBottom, imeBottom).coerceAtLeast(0)
    )
}
