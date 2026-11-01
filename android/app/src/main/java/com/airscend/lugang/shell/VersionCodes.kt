// 鲁港通 - 版本号规则：major*10000 + minor*100 + patch
package com.airscend.lugang.shell

object VersionCodes {

    fun fromName(name: String): Int? {
        val parts = name.trim().split(".")
        if (parts.size != 3) return null
        val numbers = ArrayList<Int>(3)
        for (part in parts) {
            val value = part.toIntOrNull() ?: return null
            if (value < 0 || value > 99) return null
            numbers.add(value)
        }
        return numbers[0] * 10_000 + numbers[1] * 100 + numbers[2]
    }
}
