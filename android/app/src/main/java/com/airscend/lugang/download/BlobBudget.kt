// 鲁港通 - Blob 保存预算：校验声明大小并累计分块，防止超限与截断
package com.airscend.lugang.download

class BlobBudget(private val declaredSize: Long) {
    private var receivedBytes = 0L

    fun isDeclaredSizeValid(): Boolean = declaredSize in 0..MAX_BYTES

    fun accept(chunkBytes: Int): Boolean {
        if (chunkBytes < 0) return false
        if (receivedBytes + chunkBytes > declaredSize) return false
        receivedBytes += chunkBytes
        return true
    }

    fun isComplete(): Boolean = receivedBytes == declaredSize

    companion object {
        const val MAX_BYTES = 100L * 1024 * 1024
        const val CHUNK_BYTES = 256 * 1024
    }
}
