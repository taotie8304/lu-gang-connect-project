// 鲁港通 - 上传三入口：相册、拍照、文件管理器，结果回传网页 input[type=file]
package com.airscend.lugang.upload

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import android.webkit.ValueCallback
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import com.airscend.lugang.R
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class UploadChooser(private val activity: ComponentActivity) {

    private var callback: ValueCallback<Array<Uri>>? = null
    private var captureUri: Uri? = null
    private var captureFile: File? = null

    private val launcher = activity.registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val pending = callback
        callback = null
        if (pending == null) return@registerForActivityResult
        if (result.resultCode != Activity.RESULT_OK) {
            pending.onReceiveValue(null)
            return@registerForActivityResult
        }
        val uris = collect(result.data)
        pending.onReceiveValue(uris.takeIf { it.isNotEmpty() }?.toTypedArray())
    }

    fun open(
        valueCallback: ValueCallback<Array<Uri>>,
        accept: String?,
        allowCapture: Boolean
    ) {
        callback?.onReceiveValue(null)
        callback = valueCallback
        captureUri = null
        captureFile = null
        pruneCaptures()

        val contentIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, UploadMime.fromAccept(accept))
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        val chooser = Intent.createChooser(contentIntent, activity.getString(R.string.choose_file))
        if (allowCapture && UploadMime.allowsImages(accept)) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent()))
        }
        try {
            launcher.launch(chooser)
        } catch (error: ActivityNotFoundException) {
            callback = null
            valueCallback.onReceiveValue(null)
            Toast.makeText(activity, R.string.choose_file_failed, Toast.LENGTH_SHORT).show()
        }
    }

    private fun cameraIntent(): Intent {
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        val dir = File(activity.cacheDir, "capture").apply { mkdirs() }
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val file = File(dir, "IMG_$stamp.jpg")
        captureFile = file
        captureUri = FileProvider.getUriForFile(
            activity,
            activity.packageName + ".fileprovider",
            file
        )
        intent.putExtra(MediaStore.EXTRA_OUTPUT, captureUri)
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        return intent
    }

    private fun collect(data: Intent?): List<Uri> {
        val uris = LinkedHashSet<Uri>()
        data?.clipData?.let { clip ->
            for (index in 0 until clip.itemCount) {
                clip.getItemAt(index)?.uri?.let(uris::add)
            }
        }
        data?.data?.let(uris::add)
        if (uris.isEmpty()) {
            val file = captureFile
            val uri = captureUri
            if (file != null && uri != null && file.length() > 0L) uris.add(uri)
        }
        captureFile = null
        captureUri = null
        return uris.toList()
    }

    private fun pruneCaptures() {
        val dir = File(activity.cacheDir, "capture")
        val cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000
        dir.listFiles()?.forEach { file ->
            if (file.isFile && file.lastModified() < cutoff) file.delete()
        }
    }
}
