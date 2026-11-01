# 鲁港通安卓工程

- 版本号与更新说明改 `version.properties`；`versionCode` 必须是 `major*10000+minor*100+patch`。
- 签名密钥只存在于本机 `D:/lugang-android-keystore/` 与 GitHub Secrets；**丢失后只能卸载重装**。
- 构建与产物由 `.github/workflows/android-build.yml` 产出；发布用 `node scripts/publish.mjs --dist dist`。
