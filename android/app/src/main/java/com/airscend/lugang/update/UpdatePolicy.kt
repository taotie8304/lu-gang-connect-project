// 鲁港通 - 更新检查策略：启动 10 秒后检查，24 小时内不重复
package com.airscend.lugang.update

object UpdatePolicy {
    const val STARTUP_DELAY_MS = 10_000L
    const val CHECK_INTERVAL_MS = 24L * 60 * 60 * 1000

    fun isDue(lastCheckAt: Long, now: Long): Boolean {
        if (lastCheckAt <= 0L) return true
        if (now < lastCheckAt) return false
        return now - lastCheckAt >= CHECK_INTERVAL_MS
    }

    fun isNewer(remoteVersionCode: Int, currentVersionCode: Int): Boolean =
        remoteVersionCode > currentVersionCode
}
