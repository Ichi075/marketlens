# MarketLens のビルド

[English](BUILDING.md) | **日本語** | [简体中文](BUILDING.zh-CN.md)

[← README に戻る](README.ja.md)

MarketLens は Tauri 2、Rust、Vite、pnpm を使用しています。Windows版はWindows、macOS版はMacでビルドします。Android版はローカルのAndroid開発環境、または以下の再現可能なDocker環境でビルドできます。

## 共通準備

1. [Node.js LTS](https://nodejs.org/)、[pnpm](https://pnpm.io/installation)、[Rust](https://www.rust-lang.org/tools/install)をインストールします。
2. OSに対応する[Tauri 2の前提条件](https://v2.tauri.app/start/prerequisites/)を満たします。
3. 依存パッケージを取得し、フロントエンドのテストを実行します。

```sh
pnpm install --frozen-lockfile
pnpm test
```

`pnpm build`はフロントエンドだけをビルドします。インストール可能なアプリには`pnpm tauri ... build`を使用します。

## Windows

Microsoft C++ Build Toolsの**Desktop development with C++**とMicrosoft Edge WebView2 Runtimeをインストールし、MSVC版Rustツールチェーンを使用します。PowerShellで次を実行します。

```powershell
pnpm install --frozen-lockfile
pnpm tauri build --bundles nsis
```

インストーラーは`src-tauri/target/release/bundle/nsis/`に出力されます。MSIには`pnpm tauri build --bundles msi`を使用します。MSIではWindowsのVBSCRIPTオプション機能が必要になる場合があります。配布前に[Windowsコード署名](https://v2.tauri.app/distribute/sign/windows/)を確認してください。

## macOS

`xcode-select --install`でXcode Command Line Toolsを準備し、次を実行します。

```sh
pnpm install --frozen-lockfile
pnpm tauri build --bundles dmg
```

DMGは`src-tauri/target/release/bundle/dmg/`に出力されます。Apple SiliconとIntelのユニバーサル版は次のコマンドで作成します。

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm tauri build --bundles dmg --target universal-apple-darwin
```

App Store外で配布する場合はAppleの署名と公証が必要です。[macOSコード署名](https://v2.tauri.app/distribute/sign/macos/)を参照してください。

## DockerでAndroidをビルド

再現性を優先する場合の推奨手順です。ホスト側に必要なのはDocker DesktopまたはDocker Engineだけです。イメージ内ではNode 22.14.0、pnpm 10.15.1、Rust 1.90.0、JDK 17、Android SDK Platform 36、Build Tools 36.0.0、NDK 28.2.13676358、Android Command-line Tools 15859902を固定し、4種類のTauri Android向けRustターゲットを導入します。Tauri CLIはグローバルインストールせず、`pnpm-lock.yaml`の`@tauri-apps/cli` 2.11.4を`pnpm tauri`で実行します。

GoogleのLinux向けAndroid NDKホストツールがx86-64であるため、イメージは`linux/amd64`を使用します。Apple SiliconではDocker Desktopのエミュレーションで動作するため、ビルドは遅くなります。

### Windows PowerShell

リポジトリのルートで実行します。

```powershell
docker version
docker build -f Dockerfile.android -t marketlens-android .
New-Item -ItemType Directory -Force src-tauri/gen, dist-android | Out-Null

# 初回だけ実行します。生成したAndroidプロジェクトはホスト側に残ります。
docker run --rm `
  -v "${PWD}/src-tauri/gen:/workspace/src-tauri/gen" `
  marketlens-android init

# デバッグAPK（既定モード、ARM64とARMv7）。
docker run --rm `
  -v "${PWD}/src-tauri/gen:/workspace/src-tauri/gen" `
  -v "${PWD}/dist-android:/output" `
  --mount type=volume,src=marketlens-gradle-cache,dst=/root/.gradle `
  --mount type=volume,src=marketlens-cargo-registry,dst=/usr/local/cargo/registry `
  --mount type=volume,src=marketlens-cargo-git,dst=/usr/local/cargo/git `
  --mount type=volume,src=marketlens-target-cache,dst=/workspace/src-tauri/target `
  marketlens-android
```

リリースAPKは最後を`marketlens-android release`、AABは`marketlens-android aab`に変更します。x86エミュレーターも含める場合は、イメージ名の前に`-e ANDROID_TARGETS=aarch64,armv7,i686,x86_64`を追加します。

### macOS / Linux（bash・zsh）

リポジトリのルートで実行します。

```sh
docker version
docker build -f Dockerfile.android -t marketlens-android .
mkdir -p src-tauri/gen dist-android

# 初回だけ実行します。生成したAndroidプロジェクトはホスト側に残ります。
docker run --rm \
  -v "$(pwd)/src-tauri/gen:/workspace/src-tauri/gen" \
  marketlens-android init

# デバッグAPK（既定モード、ARM64とARMv7）。
docker run --rm \
  -v "$(pwd)/src-tauri/gen:/workspace/src-tauri/gen" \
  -v "$(pwd)/dist-android:/output" \
  --mount type=volume,src=marketlens-gradle-cache,dst=/root/.gradle \
  --mount type=volume,src=marketlens-cargo-registry,dst=/usr/local/cargo/registry \
  --mount type=volume,src=marketlens-cargo-git,dst=/usr/local/cargo/git \
  --mount type=volume,src=marketlens-target-cache,dst=/workspace/src-tauri/target \
  marketlens-android
```

リリースAPKは`marketlens-android release`、AABは`marketlens-android aab`を指定します。x86系も含めるには、イメージ名の前に`-e ANDROID_TARGETS=aarch64,armv7,i686,x86_64`を追加します。

### モードと出力先

| モード | Tauriコマンド | ホスト側の出力 |
| --- | --- | --- |
| `init` | `pnpm tauri android init --ci` | `src-tauri/gen/android/` |
| `debug`（既定） | `pnpm tauri android build --ci --debug --apk` | `dist-android/marketlens-debug.apk` |
| `release` | `pnpm tauri android build --ci --apk` | `dist-android/marketlens-release.apk` |
| `aab` | `pnpm tauri android build --ci --aab` | `dist-android/marketlens-release.aab` |

`init`は意図的に分離しています。通常のイメージ作成やアプリのビルドでは`src-tauri/gen/android`を再生成しません。ビルドスクリプトは、チャートと株価取得に必要な`android.permission.INTERNET`が生成済みマニフェストにあることも確認します。

### リリース署名

最初に公式の[Tauri Android署名ガイド](https://v2.tauri.app/distribute/sign/android/)に従い、`src-tauri/gen/android/app/build.gradle.kts`が`src-tauri/gen/android/keystore.properties`を読むよう一度だけ設定します。propertiesファイルとキーストアはコミットしないでください。

キーストアを読み取り専用でマウントし、認証情報は実行時に環境変数で渡します。Gradle側の署名設定後、PowerShellでは次のように署名済みAABを作成します。

```powershell
docker run --rm `
  -v "${PWD}/src-tauri/gen:/workspace/src-tauri/gen" `
  -v "${PWD}/dist-android:/output" `
  -v "C:/secure/upload-keystore.jks:/run/secrets/android-upload-key.jks:ro" `
  -e ANDROID_KEYSTORE_PATH=/run/secrets/android-upload-key.jks `
  -e ANDROID_KEY_ALIAS=upload `
  -e ANDROID_KEY_PASSWORD=$env:ANDROID_KEY_PASSWORD `
  marketlens-android aab
```

bash・zshでは次の形式です。

```sh
docker run --rm \
  -v "$(pwd)/src-tauri/gen:/workspace/src-tauri/gen" \
  -v "$(pwd)/dist-android:/output" \
  -v "$HOME/.android-keys/upload-keystore.jks:/run/secrets/android-upload-key.jks:ro" \
  -e ANDROID_KEYSTORE_PATH=/run/secrets/android-upload-key.jks \
  -e ANDROID_KEY_ALIAS=upload \
  -e ANDROID_KEY_PASSWORD \
  marketlens-android aab
```

ラッパーはビルド中だけ`keystore.properties`を作成し、終了時に削除します。キーストアはリポジトリとイメージの外に残ります。CIではDockerfile、コマンド履歴、ソースファイルにパスワードを書かず、シークレット管理機能を使用してください。

### トラブルシューティング

- **Dockerが見つからない、またはデーモンが停止している:** Docker DesktopかDocker Engineを導入・起動し、`docker version`にClientとServerの両方が表示されることを確認します。
- **SDK・NDK・Rustターゲット・Javaの不一致:** `docker build --no-cache -f Dockerfile.android -t marketlens-android .`で再作成します。イメージはビルド前にJava 17とSDKパスを検査します。
- **Androidプロジェクトがない:** `src-tauri/gen`を作成して`init`コマンドを一度実行し、以後も同じバインドマウントを使用します。
- **出力先や生成ファイルの権限エラー:** `src-tauri/gen`と`dist-android`を書き込み可能にします。Linuxでroot所有のファイルができた場合は所有権を直すか、初期化後にホストと同じUIDでDockerを実行します。
- **`dist-android`が空:** 直前のビルドエラーを確認し、`/output`が`dist-android`へマウントされているか確認します。APK/AABが見つからない場合、ラッパーはエラー終了します。
- **Windowsのマウントエラー:** PowerShellとDocker DesktopのLinuxコンテナを使用し、`${PWD}`による絶対パスを指定します。Docker Desktopにドライブ共有が許可されていることも確認します。
- **Apple Siliconで遅い:** イメージとLinux NDKホストツールが`linux/amd64`を使用するため、x86-64エミュレーションによる低速化は想定内です。
- **ディスク使用量が増える:** 名前付きGradle・Cargo・targetボリュームは次回のビルドを高速化します。`docker system df`で確認し、完全に作り直す場合だけ対象の`marketlens-*`ボリュームを削除します。
- **クリーンビルド:** `marketlens-android`イメージと4個の名前付きキャッシュボリュームを削除し、イメージを再作成してからビルドします。意図的に再初期化する場合以外は`src-tauri/gen/android`を残します。

## ローカル環境でAndroidをビルド

[Tauri Androidの前提条件](https://v2.tauri.app/start/prerequisites/#android)に従い、`JAVA_HOME`、`ANDROID_HOME`、`NDK_HOME`を設定し、4種類のRustターゲットを追加します。

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
pnpm install --frozen-lockfile
pnpm tauri android init
pnpm tauri android build --apk --target aarch64 --target armv7
```

APKは`src-tauri/gen/android/app/build/outputs/apk/`以下、AABは`src-tauri/gen/android/app/build/outputs/bundle/`以下に出力されます。

## 検証範囲

フロントエンドのテストとDocker設定の静的検証は通常の開発環境で実行できます。Androidパッケージの完全なビルドではGradleとRust依存関係もダウンロードするため、リリース前にDockerが動くホストで実行してください。チャート、株価、セットアップ監視は実行時にインターネット接続を必要とします。
