// 鲁港通 - 查询「下载/鲁港通」目录是否已有同名文件，并生成不重名文件名
package com.airscend.lugang.download

import android.content.Context
import android.provider.MediaStore

object DownloadsQuery {
    private const val DIRECTORY = "Download/鲁港通"

    fun exists(context: Context, name: String): Boolean {
        val projection = arrayOf(MediaStore.Downloads._ID)
        val selection = MediaStore.Downloads.DISPLAY_NAME + " = ? AND " +
            MediaStore.Downloads.RELATIVE_PATH + " LIKE ?"
        val arguments = arrayOf(name, "$DIRECTORY/%")
        return context.contentResolver.query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            arguments,
            null
        )?.use { cursor -> cursor.count > 0 } ?: false
    }

    fun uniqueName(context: Context, raw: String?): String =
        FileNameSanitizer.unique(FileNameSanitizer.sanitize(raw)) { exists(context, it) }
}
