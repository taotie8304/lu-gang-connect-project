// 鲁港通 - 下载中心：展示本机下载记录，支持打开、分享与失效记录清理
package com.airscend.lugang.download

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.airscend.lugang.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DownloadCenterActivity : AppCompatActivity() {

    private lateinit var store: DownloadStore
    private lateinit var list: RecyclerView
    private lateinit var emptyView: TextView
    private val adapter = DownloadAdapter { record -> showActions(record) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 鲁港通 - 与主界面一致处理安全区，避免标题被状态栏遮挡
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        )
        setContentView(R.layout.activity_download_center)
        store = DownloadStore(this)
        list = findViewById(R.id.downloadList)
        emptyView = findViewById(R.id.downloadEmpty)
        findViewById<View>(R.id.downloadBack).setOnClickListener { finish() }
        list.layoutManager = LinearLayoutManager(this)
        list.adapter = adapter
        applyWindowInsets()
        refresh()
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun applyWindowInsets() {
        val root = findViewById<View>(R.id.downloadRoot)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(root)
    }

    private fun refresh() {
        val records = store.all()
        adapter.submit(records)
        emptyView.visibility = if (records.isEmpty()) View.VISIBLE else View.GONE
        list.visibility = if (records.isEmpty()) View.GONE else View.VISIBLE
    }

    private fun showActions(record: DownloadRecord) {
        if (!isAvailable(record)) {
            Toast.makeText(this, R.string.download_missing, Toast.LENGTH_LONG).show()
            store.remove(record.uri)
            refresh()
            return
        }
        AlertDialog.Builder(this)
            .setTitle(record.name)
            .setItems(
                arrayOf(
                    getString(R.string.download_open),
                    getString(R.string.download_share),
                    getString(R.string.download_remove_record)
                )
            ) { _, which ->
                when (which) {
                    0 -> open(record)
                    1 -> share(record)
                    else -> {
                        store.remove(record.uri)
                        refresh()
                    }
                }
            }
            .show()
    }

    private fun isAvailable(record: DownloadRecord): Boolean = runCatching {
        contentResolver.openAssetFileDescriptor(Uri.parse(record.uri), "r")?.use { true } ?: false
    }.getOrDefault(false)

    private fun open(record: DownloadRecord) {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse(record.uri), record.mime)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        launch(intent, R.string.download_open_failed)
    }

    private fun share(record: DownloadRecord) {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = record.mime
            putExtra(Intent.EXTRA_STREAM, Uri.parse(record.uri))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(send, getString(R.string.download_share_title)).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        launch(chooser, R.string.download_share_failed)
    }

    private fun launch(intent: Intent, errorRes: Int) {
        runCatching { startActivity(intent) }
            .onFailure { Toast.makeText(this, errorRes, Toast.LENGTH_SHORT).show() }
    }

    private class DownloadAdapter(private val onClick: (DownloadRecord) -> Unit) :
        RecyclerView.Adapter<DownloadAdapter.Holder>() {

        private val items = mutableListOf<DownloadRecord>()
        private val timeFormat = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())

        fun submit(records: List<DownloadRecord>) {
            items.clear()
            items.addAll(records)
            notifyDataSetChanged()
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_download, parent, false)
            return Holder(view)
        }

        override fun onBindViewHolder(holder: Holder, position: Int) {
            val record = items[position]
            holder.name.text = record.name
            val time = if (record.savedAt > 0L) timeFormat.format(Date(record.savedAt)) else ""
            holder.meta.text = listOfNotNull(
                time.takeIf { it.isNotEmpty() },
                readableSize(record.size).takeIf { it.isNotEmpty() }
            ).joinToString(" · ")
            holder.itemView.setOnClickListener { onClick(record) }
        }

        override fun getItemCount(): Int = items.size

        class Holder(view: View) : RecyclerView.ViewHolder(view) {
            val name: TextView = view.findViewById(R.id.downloadName)
            val meta: TextView = view.findViewById(R.id.downloadMeta)
        }

        private fun readableSize(bytes: Long): String = when {
            bytes <= 0L -> ""
            bytes >= 1024L * 1024L -> String.format(Locale.US, "%.1f MB", bytes / 1024.0 / 1024.0)
            bytes >= 1024L -> String.format(Locale.US, "%.1f KB", bytes / 1024.0)
            else -> "$bytes B"
        }
    }
}
