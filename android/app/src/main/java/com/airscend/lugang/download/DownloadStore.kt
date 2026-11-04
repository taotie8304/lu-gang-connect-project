// 鲁港通 - 下载记录本地存储：只记文件位置与基础信息，不含账号数据
package com.airscend.lugang.download

import android.content.Context

class DownloadStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun all(): List<DownloadRecord> = DownloadRecords.decode(prefs.getString(KEY, null))

    fun add(record: DownloadRecord) {
        save(DownloadRecords.add(all(), record))
    }

    fun remove(uri: String) {
        save(DownloadRecords.remove(all(), uri))
    }

    private fun save(records: List<DownloadRecord>) {
        prefs.edit().putString(KEY, DownloadRecords.encode(records)).apply()
    }

    companion object {
        private const val FILE = "lugang_downloads"
        private const val KEY = "records"
    }
}
