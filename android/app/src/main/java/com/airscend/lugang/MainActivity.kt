// 鲁港通 - 安卓外壳入口（先打通构建，后续任务逐项接入 WebView 与原生桥）
package com.airscend.lugang

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
    }
}
