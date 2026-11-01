// 鲁港通 - 安卓外壳入口：承载线上聊天页，负责导航策略、返回键与新窗口接管
package com.airscend.lugang

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.airscend.lugang.shell.NavAction
import com.airscend.lugang.shell.NavigationPolicy

class MainActivity : AppCompatActivity() {

    private lateinit var webContainer: FrameLayout
    private lateinit var splashView: View
    private var webView: WebView? = null
    private var lastBackPressAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        webContainer = findViewById(R.id.webContainer)
        splashView = findViewById(R.id.splashView)
        registerBackCallback()
        createWebView()
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
        view.webViewClient = shellClient()
        view.webChromeClient = chromeClient()
        webContainer.addView(view)
        webView = view
        view.loadUrl(START_URL)
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

        override fun onPageFinished(view: WebView, url: String?) {
            splashView.visibility = View.GONE
            view.visibility = View.VISIBLE
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

    override fun onDestroy() {
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    companion object {
        const val START_URL = "https://www.airscend.com/chat"
    }
}
