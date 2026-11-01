// 鲁港通 - 更新包校验：体积与 sha256 必须同时一致
package com.airscend.lugang.update

object UpdateVerifier {

    fun matches(
        expectedSha: String,
        expectedSize: Long,
        actualSha: String,
        actualSize: Long
    ): Boolean = expectedSize == actualSize && expectedSha.equals(actualSha, ignoreCase = true)
}
