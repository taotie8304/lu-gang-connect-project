// 鲁港通 - SHA-256 计算：输出小写十六进制，不依赖 Locale
package com.airscend.lugang.update

import java.io.File
import java.security.MessageDigest

object Sha256 {
    private val HEX = "0123456789abcdef".toCharArray()

    // 鲁港通 - 对字节内容求 SHA-256 摘要并转小写十六进制
    fun hex(input: ByteArray): String =
        encode(MessageDigest.getInstance("SHA-256").digest(input))

    // 鲁港通 - 对流式读取文件求 SHA-256 摘要（64KB 分块，避免整包读入内存）
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
        return encode(digest.digest())
    }

    // 鲁港通 - 摘要字节转小写十六进制，不依赖 Locale
    private fun encode(digest: ByteArray): String {
        val out = CharArray(digest.size * 2)
        for (index in digest.indices) {
            val value = digest[index].toInt() and 0xFF
            out[index * 2] = HEX[value ushr 4]
            out[index * 2 + 1] = HEX[value and 0x0F]
        }
        return String(out)
    }
}
