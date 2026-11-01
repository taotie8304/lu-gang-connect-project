import java.util.Properties

// 鲁港通 - 安卓工程：版本号读 version.properties，签名参数只从 CI 环境变量注入
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val appVersion = Properties().apply {
    rootProject.file("version.properties").reader(Charsets.UTF_8).use { load(it) }
}
val appVersionName = appVersion.getProperty("versionName")
val appVersionCode = appVersion.getProperty("versionCode").toInt()

android {
    namespace = "com.airscend.lugang"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.airscend.lugang"
        minSdk = 29
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
    }

    signingConfigs {
        val keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
        if (!keystorePath.isNullOrBlank() && file(keystorePath).exists()) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
