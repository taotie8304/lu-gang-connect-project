package com.airscend.lugang.update

import org.junit.Assert.assertEquals
import org.junit.Test

class Sha256Test {

    @Test
    fun `已知向量 abc`() {
        assertEquals(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            Sha256.hex("abc".toByteArray(Charsets.UTF_8))
        )
    }

    @Test
    fun `空输入向量`() {
        assertEquals(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            Sha256.hex(ByteArray(0))
        )
    }
}
