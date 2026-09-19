# 构建 MarketLens

[English](BUILDING.md) | [日本語](BUILDING.ja.md) | **简体中文**

[← 返回 README](README.zh-CN.md)

本仓库使用 Tauri 2、Rust、Vite 和 pnpm。Windows 安装程序请在 Windows 上构建，macOS DMG 请在 Mac 上构建。Android 可在 Windows 或 macOS 上构建。以下命令均在仓库根目录执行。

## 通用准备

1. 安装 [Node.js LTS](https://nodejs.org/) 和 [pnpm](https://pnpm.io/installation)。
2. 安装 [Rust](https://www.rust-lang.org/tools/install)。
3. 满足当前操作系统的 [Tauri 2 前置依赖](https://tauri.app/start/prerequisites/)。
4. 安装项目依赖并运行前端测试：

```sh
pnpm install --frozen-lockfile
pnpm test
```

`pnpm build` 只构建前端。要生成可安装的应用，请使用下文的 `pnpm tauri ... build` 命令。

## Windows

安装 Microsoft C++ Build Tools，并选择 **Desktop development with C++**；同时安装 Microsoft Edge WebView2 Runtime。Rust 应使用 MSVC 工具链。详见 [Windows 前置依赖](https://tauri.app/start/prerequisites/#windows)。

在 PowerShell 中构建 NSIS 安装程序：

```powershell
pnpm install --frozen-lockfile
pnpm tauri build --bundles nsis
```

安装程序位于 `src-tauri/target/release/bundle/nsis/`。如需 MSI，改为运行 `pnpm tauri build --bundles msi`。构建 MSI 时可能需要启用 Windows 的 VBSCRIPT 可选功能。分发已签名安装程序前，请参阅 [Windows 代码签名](https://tauri.app/distribute/sign/windows/)。

## macOS

在 Mac 上安装 Xcode Command Line Tools（`xcode-select --install`）、Rust、Node.js 和 pnpm。构建 DMG：

```sh
pnpm install --frozen-lockfile
pnpm tauri build --bundles dmg
```

DMG 位于 `src-tauri/target/release/bundle/dmg/`。默认产物面向构建机器的 CPU 架构。若需同时支持 Apple Silicon 和 Intel 的通用应用，请安装两个 Rust 目标并指定 universal 目标：

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm tauri build --bundles dmg --target universal-apple-darwin
```

通过 App Store 以外的渠道分发，需要 Apple 代码签名和公证。详见 [macOS 代码签名](https://tauri.app/distribute/sign/macos/)。

## Android

按照 [Android 前置依赖](https://tauri.app/start/prerequisites/#android)安装 Android Studio、Android SDK Platform、Platform-Tools、Build-Tools、Command-line Tools、并行安装的 NDK 和 Java。设置 `JAVA_HOME`、`ANDROID_HOME`、`NDK_HOME`，再添加计划构建的 ABI 对应的 Rust 目标。以下示例面向常见实体设备：

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi
pnpm install --frozen-lockfile
pnpm tauri android init
pnpm tauri android build --apk --target aarch64 --target armv7
```

每个开发环境只需运行一次 `android init`。生成的 `src-tauri/gen/android/` 目录已被 Git 忽略。APK 位于 `src-tauri/gen/android/app/build/outputs/apk/` 下。如果不指定目标，Tauri 会构建所有支持的 ABI。

要使用相同的 ARM 目标为 Google Play 构建 AAB，请运行：

```sh
pnpm tauri android build --aab --target aarch64 --target armv7
```

AAB 位于 `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/`。提交到 Play 商店还需要上传密钥、[Android 应用签名](https://tauri.app/distribute/sign/android/)以及 Play Console 设置。不要把签名密钥或密码提交到仓库。

## 注意

本文介绍构建方法，不表示已在三个平台上完成原生安装包的实际测试。图表和报价需要联网。TradingView 组件与数据源的限制请参阅 [README](README.zh-CN.md)。
