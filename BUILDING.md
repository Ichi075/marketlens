# MarketLens のビルド手順

このリポジトリは Tauri 2、Rust、Vite、pnpm を使用します。Windows のインストーラーは Windows、macOS の DMG は Mac でビルドしてください。Android は Windows または Mac からビルドできます。以下のコマンドはリポジトリのルートで実行します。

## 共通の準備

1. [Node.js LTS](https://nodejs.org/) と [pnpm](https://pnpm.io/installation) をインストールします。
2. [Rust](https://www.rust-lang.org/tools/install) をインストールします。
3. OS に対応する [Tauri 2 の前提条件](https://tauri.app/start/prerequisites/) を満たします。
4. 依存パッケージを取得し、フロントエンドのテストを実行します。

```sh
pnpm install --frozen-lockfile
pnpm test
```

`pnpm build` はフロントエンドのみのビルドです。インストール可能なアプリを作るには以下の `pnpm tauri ... build` を実行してください。

## Windows

Microsoft C++ Build Tools の **Desktop development with C++** と Microsoft Edge WebView2 Runtime が必要です。Rust は MSVC ツールチェーンを使用します。[Windows の前提条件](https://tauri.app/start/prerequisites/#windows)を確認してください。

PowerShell で NSIS セットアップファイルを作ります。

```powershell
pnpm install --frozen-lockfile
pnpm tauri build --bundles nsis
```

生成物は `src-tauri/target/release/bundle/nsis/` にあります。MSI が必要な場合は `pnpm tauri build --bundles msi` を実行します。MSI の作成には Windows の VBSCRIPT オプション機能が必要になる場合があります。配布時の署名については [Tauri の Windows 署名ガイド](https://tauri.app/distribute/sign/windows/)を参照してください。

## macOS

Mac 上で Xcode Command Line Tools（`xcode-select --install`）、Rust、Node.js、pnpm を準備します。DMG を作るには次を実行します。

```sh
pnpm install --frozen-lockfile
pnpm tauri build --bundles dmg
```

生成物は `src-tauri/target/release/bundle/dmg/` にあります。通常はビルドした Mac の CPU 向けです。Apple Silicon と Intel の両方に対応する単一のアプリが必要な場合は、両方の Rust ターゲットを追加してから universal ターゲットを指定します。

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm tauri build --bundles dmg --target universal-apple-darwin
```

外部配布には Apple のコード署名と公証が必要です。[Tauri の macOS 署名ガイド](https://tauri.app/distribute/sign/macos/)を参照してください。

## Android

[Tauri の Android 前提条件](https://tauri.app/start/prerequisites/#android)に従って Android Studio、Android SDK Platform / Platform-Tools / Build-Tools / Command-line Tools、NDK (Side by side)、Java を準備します。`JAVA_HOME`、`ANDROID_HOME`、`NDK_HOME` を設定し、ビルドする ABI の Rust ターゲットを追加してください。一般的な実機向けの例は次のとおりです。

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi
pnpm install --frozen-lockfile
pnpm tauri android init
pnpm tauri android build --apk --target aarch64 --target armv7
```

`android init` は各作業環境で一度だけ実行します。生成される `src-tauri/gen/android/` は `.gitignore` に含めています。APK は `src-tauri/gen/android/app/build/outputs/apk/` 以下に生成されます。ABI を指定しない場合は、対応する全ターゲットをビルドします。

Google Play 向けの AAB は次のコマンドで作ります。

```sh
pnpm tauri android build --aab
```

AAB の生成先は `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/` です。Play ストアに提出するには、別途アップロード鍵による[Android アプリの署名](https://tauri.app/distribute/sign/android/)と Play Console の設定が必要です。署名鍵やパスワードをリポジトリに追加しないでください。

## 注意

この手順はビルド方法の記載です。現時点で Windows、macOS、Android のネイティブパッケージをすべて実機検証したことは意味しません。チャートと株価にはネット接続が必要です。TradingView の埋め込みチャート設定やデータ配信の制約は [README](README.md) を参照してください。
