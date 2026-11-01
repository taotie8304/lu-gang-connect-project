// 鲁港通 - SHA-256 计算：输出小写十六进制，不依赖 Locale
package com.airscend.lugang.update

import java.io.File
import java.security.MessageDigest

object Sha256 {
    private val HEX = "0123456789abcdef".toCharArray()

    fun hex(input: ByteArray): String {
        val out = CharArray(input.size * 2)
        for (index in input.indices) {
            val value = input[index].toInt() and 0xFF
            out[index * 2] = HEX[value ushr 4]
            out[index * 2 + 1] = HEX[value and 0x0F]
        }
        return String(out)
    }

    fun ofFile(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return hex(digest.digest())
    }
}
