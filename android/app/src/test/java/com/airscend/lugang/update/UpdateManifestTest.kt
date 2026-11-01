package com.airscend.lugang.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class UpdateManifestTest {

    private fun validJson(): String = """
        {
          "versionCode": 101,
          "versionName": "0.1.1",
          "apkUrl": "https://www.airscend.com/android/updates/lugang-android-0.1.1-101.apk",
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          "size": 1024,
          "changelog": "修复导入稳定性",
          "publishedAt": "2026-11-01T08:00:00+08:00"
        }
    """.trimIndent()

    @Test
    fun `解析合法清单`() {
        val manifest = UpdateManifest.parse(validJson())
        assertNotNull(manifest)
        assertEquals(101, manifest!!.versionCode)
        assertEquals("0.1.1", manifest.versionName)
        assertEquals(1024L, manifest.size)
        assertEquals("修复导入稳定性", manifest.changelog)
    }

    @Test
    fun `拒绝非 https 地址`() {
        val json = validJson().replace("https://www.airscend.com", "http://www.airscend.com")
        assertNull(UpdateManifest.parse(json))
    }

    @Test
    fun `拒绝非法摘要`() {
        val json = validJson().replace(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "xyz"
        )
        assertNull(UpdateManifest.parse(json))
    }

    @Test
    fun `拒绝非正版本号与体积`() {
        assertNull(UpdateManifest.parse(validJson().replace("\"versionCode\": 101", "\"versionCode\": 0")))
        assertNull(UpdateManifest.parse(validJson().replace("\"size\": 1024", "\"size\": 0")))
    }

    @Test
    fun `摘要大写自动转小写`() {
        val upper = "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"
        val json = validJson().replace(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            upper
        )
        assertEquals(upper.lowercase(), UpdateManifest.parse(json)!!.sha256)
    }
}
