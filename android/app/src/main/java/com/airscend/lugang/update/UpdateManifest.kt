// 鲁港通 - 更新清单数据结构
package com.airscend.lugang.update

data class UpdateManifest(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val sha256: String,
    val size: Long,
    val changelog: String,
    val publishedAt: String?
)
