// 鲁港通 - 安卓外壳入口：承载线上聊天页，负责导航策略、返回键与新窗口接管
package com.airscend.lugang

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.view.animation.LinearInterpolator
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.airscend.lugang.bridge.BridgeOrigin
import com.airscend.lugang.bridge.LugangBridge
import com.airscend.lugang.download.BlobSaver
import com.airscend.lugang.download.DirectDownloader
import com.airscend.lugang.download.DownloadCenterActivity
import com.airscend.lugang.download.DownloadStore
import com.airscend.lugang.shell.Diagnostics
import com.airscend.lugang.shell.NavAction
import com.airscend.lugang.shell.NavigationPolicy
import com.airscend.lugang.shell.ShellInsets
import com.airscend.lugang.update.UpdateChecker
import com.airscend.lugang.update.UpdateDownloader
import com.airscend.lugang.update.UpdateManifest
import com.airscend.lugang.upload.UploadChooser
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity(), LugangBridge.Host {

    private lateinit var webContainer: FrameLayout
    private lateinit var splashView: View
    private lateinit var errorView: View
    private lateinit var errorMessage: TextView
    private var splashAnimator: ValueAnimator? = null
    private var webView: WebView? = null
    private var lastBackPressAt = 0L
    private var lastError: String? = null
    private var lastErrorUrl: String? = null
    private val renderCrashTimes = mutableListOf<Long>()
    private var bridgeScript: String = ""
    @Volatile private var currentUrl: String = ""
    @Volatile private var bridgeAllowed: Boolean = false
    private lateinit var directDownloader: DirectDownloader
    private lateinit var blobSaver: BlobSaver
    private lateinit var downloadStore: DownloadStore
    private lateinit var uploadChooser: UploadChooser
    private lateinit var updateDownloader: UpdateDownloader
    private lateinit var updateChecker: UpdateChecker
    private val downloadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
            val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
            if (id != directDownloader.lastDownloadId) return
            val succeeded = directDownloader.statusOf(id) == DownloadManager.STATUS_SUCCESSFUL
            if (succeeded) {
                directDownloader.completionRecord(id)?.let { downloadStore.add(it) }
            }
            val message = if (succeeded) R.string.download_saved else R.string.download_failed
            Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 鲁港通 - Android 15 强制 edge-to-edge，自绘安全区避免标题栏被状态栏压住
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        )
        setContentView(R.layout.activity_main)
        webContainer = findViewById(R.id.webContainer)
        splashView = findViewById(R.id.splashView)
        errorView = findViewById(R.id.errorView)
        errorMessage = findViewById(R.id.errorMessage)
        applyWindowInsets()
        startSplashSweep()
        findViewById<Button>(R.id.errorRetry).setOnClickListener { retryLoad() }
        findViewById<Button>(R.id.errorCopy).setOnClickListener { copyDiagnostics() }
        downloadStore = DownloadStore(this)
        directDownloader = DirectDownloader(this)
        blobSaver = BlobSaver(this, downloadStore)
        uploadChooser = UploadChooser(this)
        ContextCompat.registerReceiver(
            this,
            downloadReceiver,
            IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        bridgeScript = readBridgeScript()
        registerBackCallback()
        createWebView()
        updateDownloader = UpdateDownloader(this)
        updateChecker = UpdateChecker(this, BuildConfig.VERSION_CODE) { manifest ->
            showUpdateDialog(manifest)
        }
        updateChecker.scheduleStartupCheck()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView() {
        val view = WebView(this)
        view.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        view.visibility = View.INVISIBLE
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            userAgentString = userAgentString + " LugangAndroid/" + BuildConfig.VERSION_NAME
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false)
        view.addJavascriptInterface(LugangBridge(this), "LugangApp")
        injectBridgeScript(view)
        view.webViewClient = shellClient()
        view.webChromeClient = chromeClient()
        view.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            if (!url.startsWith("https://")) {
                Toast.makeText(this, R.string.download_unsupported, Toast.LENGTH_SHORT).show()
                return@setDownloadListener
            }
            val cookie = CookieManager.getInstance().getCookie(url)
            val id = directDownloader.enqueue(url, contentDisposition, mimeType, cookie, userAgent)
            val message = if (id == null) R.string.download_failed else R.string.download_started
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        }
        webContainer.addView(view)
        webView = view
        view.loadUrl(START_URL)
    }

    private fun applyWindowInsets() {
        val root = findViewById<View>(R.id.root)
        val container = webContainer
        val error = errorView
        val errorBaseLeft = error.paddingLeft
        val errorBaseTop = error.paddingTop
        val errorBaseRight = error.paddingRight
        val errorBaseBottom = error.paddingBottom
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val padding = ShellInsets.resolve(bars.left, bars.top, bars.right, bars.bottom, ime.bottom)
            // 鲁港通 - 安全区让给网页与错误页，开屏页保持整屏渐变不被状态栏截条
            container.setPadding(padding.left, padding.top, padding.right, padding.bottom)
            error.setPadding(
                errorBaseLeft + padding.left,
                errorBaseTop + padding.top,
                errorBaseRight + padding.right,
                errorBaseBottom + padding.bottom
            )
            insets
        }
        ViewCompat.requestApplyInsets(root)
    }

    private fun startSplashSweep() {
        if (splashAnimator != null) return
        val track = findViewById<View>(R.id.splashTrack)
        val bar = findViewById<View>(R.id.splashBar)
        track.post {
            if (isFinishing || isDestroyed) return@post
            if (splashView.visibility != View.VISIBLE || splashAnimator != null) return@post
            val travel = track.width + bar.width
            splashAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
                duration = 1200L
                repeatCount = ValueAnimator.INFINITE
                interpolator = LinearInterpolator()
                addUpdateListener { anim ->
                    bar.translationX = -bar.width + (anim.animatedValue as Float) * travel
                }
                start()
            }
        }
    }

    private fun stopSplashSweep() {
        splashAnimator?.cancel()
        splashAnimator = null
    }

    private fun hideSplash() {
        splashView.visibility = View.GONE
        stopSplashSweep()
    }

    private fun showSplash() {
        splashView.visibility = View.VISIBLE
        startSplashSweep()
    }

    private fun registerBackCallback() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (isLoginPage()) {
                    finish()
                    return
                }
                val view = webView
                if (view != null && view.canGoBack()) {
                    view.goBack()
                    return
                }
                val now = System.currentTimeMillis()
                if (now - lastBackPressAt < 2000L) {
                    finish()
                    return
                }
                lastBackPressAt = now
                Toast.makeText(this@MainActivity, R.string.exit_hint, Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun isLoginPage(): Boolean {
        val path = runCatching { Uri.parse(webView?.url ?: "") }.getOrNull()?.path ?: return false
        return path.startsWith("/login")
    }

    private fun shellClient(): WebViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            return route(request.url.toString())
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            currentUrl = url ?: ""
            bridgeAllowed = BridgeOrigin.isTrusted(url)
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT) && bridgeScript.isNotEmpty()) {
                view.evaluateJavascript(bridgeScript, null)
            }
        }

        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
            currentUrl = url ?: currentUrl
            bridgeAllowed = BridgeOrigin.isTrusted(currentUrl)
        }

        override fun onPageFinished(view: WebView, url: String?) {
            currentUrl = url ?: currentUrl
            bridgeAllowed = BridgeOrigin.isTrusted(currentUrl)
            hideSplash()
            if (errorView.visibility != View.VISIBLE) {
                view.visibility = View.VISIBLE
            }
        }

        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError
        ) {
            if (!request.isForMainFrame) return
            lastErrorUrl = request.url.toString()
            lastError = "${error.errorCode} ${error.description}"
            showError(errorTextFor(error.errorCode))
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            handler.cancel()
            lastErrorUrl = view.url
            lastError = "SSL ${error.primaryError}"
            showError(getString(R.string.error_ssl))
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            val now = System.currentTimeMillis()
            renderCrashTimes.removeAll { now - it > 60_000L }
            renderCrashTimes.add(now)
            webContainer.removeView(view)
            view.destroy()
            webView = null
            if (renderCrashTimes.size >= 3) {
                lastError = "render process gone"
                showError(getString(R.string.error_render))
                return true
            }
            errorView.visibility = View.GONE
            showSplash()
            createWebView()
            return true
        }
    }

    private fun chromeClient(): WebChromeClient = object : WebChromeClient() {
        override fun onCreateWindow(
            view: WebView?,
            isDialog: Boolean,
            isUserGesture: Boolean,
            resultMsg: Message?
        ): Boolean {
            val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
            val temp = WebView(this@MainActivity)
            temp.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url.toString()
                    when (NavigationPolicy.decide(url)) {
                        NavAction.INTERNAL -> webView?.loadUrl(url)
                        NavAction.EXTERNAL -> openExternalUrl(url)
                        NavAction.BLOCK -> Unit
                    }
                    webContainer.post { temp.destroy() }
                    return true
                }
            }
            transport.webView = temp
            resultMsg.sendToTarget()
            return true
        }

        override fun onShowFileChooser(
            view: WebView?,
            filePathCallback: ValueCallback<Array<Uri>>?,
            fileChooserParams: WebChromeClient.FileChooserParams?
        ): Boolean {
            if (filePathCallback == null) return false
            // 鲁港通 - 现网网页不设 capture，拍照入口由外壳补齐（非图片 accept 在 UploadChooser 内被挡）
            uploadChooser.open(
                filePathCallback,
                fileChooserParams?.acceptTypes?.joinToString(","),
                true
            )
            return true
        }
    }

    private fun route(url: String?): Boolean {
        return when (NavigationPolicy.decide(url)) {
            NavAction.INTERNAL -> false
            NavAction.EXTERNAL -> {
                openExternalUrl(url)
                true
            }
            NavAction.BLOCK -> true
        }
    }

    fun openExternalUrl(url: String?) {
        if (url.isNullOrBlank() || NavigationPolicy.decide(url) != NavAction.EXTERNAL) return
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            .onFailure { Toast.makeText(this, R.string.link_open_failed, Toast.LENGTH_SHORT).show() }
    }

    private fun errorTextFor(code: Int): String = when (code) {
        WebViewClient.ERROR_HOST_LOOKUP -> getString(R.string.error_network)
        WebViewClient.ERROR_CONNECT -> getString(R.string.error_connect)
        WebViewClient.ERROR_TIMEOUT -> getString(R.string.error_timeout)
        WebViewClient.ERROR_UNSUPPORTED_SCHEME -> getString(R.string.error_unsupported)
        else -> getString(R.string.error_generic)
    }

    private fun showError(message: String) {
        errorMessage.text = message
        errorView.visibility = View.VISIBLE
        hideSplash()
        webView?.visibility = View.INVISIBLE
    }

    private fun hideError() {
        errorView.visibility = View.GONE
        webView?.visibility = View.VISIBLE
    }

    private fun retryLoad() {
        hideError()
        showSplash()
        val view = webView
        if (view == null) {
            createWebView()
            return
        }
        view.visibility = View.INVISIBLE
        val target = lastErrorUrl?.takeIf { NavigationPolicy.decide(it) == NavAction.INTERNAL } ?: START_URL
        view.loadUrl(target)
    }

    private fun copyDiagnostics() {
        val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())
        val text = Diagnostics.build(
            BuildConfig.VERSION_NAME,
            Build.VERSION.RELEASE ?: "",
            Build.MODEL ?: "",
            lastErrorUrl ?: webView?.url,
            lastError,
            time
        )
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("鲁港通诊断", text))
        Toast.makeText(this, R.string.error_copied, Toast.LENGTH_SHORT).show()
    }

    private fun showUpdateDialog(manifest: UpdateManifest) {
        if (isFinishing || isDestroyed) return
        val message = buildString {
            append("版本 ")
            append(manifest.versionName)
            if (manifest.changelog.isNotBlank()) {
                append("\n")
                append(manifest.changelog)
            }
            append("\n\n安装包 ")
            append(readableSize(manifest.size))
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.update_title)
            .setMessage(message)
            .setPositiveButton(R.string.update_download) { _, _ -> updateDownloader.download(manifest) }
            .setNegativeButton(R.string.update_later, null)
            .show()
    }

    private fun readableSize(bytes: Long): String =
        String.format(Locale.US, "%.1f MB", bytes / 1024.0 / 1024.0)

    private fun readBridgeScript(): String =
        runCatching {
            assets.open("lugang_bridge.js").bufferedReader(Charsets.UTF_8).use { it.readText() }
        }.getOrDefault("")

    private fun injectBridgeScript(view: WebView) {
        if (bridgeScript.isEmpty()) return
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(view, bridgeScript, setOf(BridgeOrigin.ORIGIN))
        }
    }

    override fun isBridgeTrusted(): Boolean = bridgeAllowed && BridgeOrigin.isTrusted(currentUrl)

    override fun onBridgeOpenExternal(url: String?) {
        runOnUiThread { openExternalUrl(url) }
    }

    override fun onBridgeToast(message: String?) {
        if (message.isNullOrBlank()) return
        runOnUiThread { Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show() }
    }

    override fun startBlobSave(name: String?, mime: String?, size: Long): String? =
        blobSaver.start(name, mime, size)

    override fun appendBlobChunk(id: String?, base64: String?): Boolean =
        blobSaver.append(id, base64)

    override fun finishBlobSave(id: String?): Boolean = blobSaver.finish(id)

    override fun abortBlobSave(id: String?) = blobSaver.abort(id)

    override fun onBridgeOpenDownloads() {
        runOnUiThread { startActivity(Intent(this, DownloadCenterActivity::class.java)) }
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(downloadReceiver) }
        stopSplashSweep()
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    companion object {
        const val START_URL = "https://www.airscend.com/chat"
    }
}
