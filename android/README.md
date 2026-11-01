# 鲁港通安卓工程

- 版本号与更新说明改 `version.properties`；`versionCode` 必须是 `major*10000+minor*100+patch`。
- 签名密钥只存在于本机 `D:/lugang-android-keystore/` 与 GitHub Secrets；**丢失后只能卸载重装**。
- 密钥格式为 PKCS#12；生成只在本机进行（OpenSSL），CI 只解码 Secrets，**不得再让 CI 产出或上传密钥文件**。
- 更换签名密钥会让已安装用户无法覆盖升级，必须卸载重装，只在内测期或密钥泄露时执行（2026-11-01 因旧密钥曾在公开仓库短暂出现而轮换）。
- 构建与产物由 `.github/workflows/android-build.yml` 产出；发布用 `node scripts/publish.mjs --dist dist`。
