# Building MarketLens

**English** | [日本語](BUILDING.ja.md) | [简体中文](BUILDING.zh-CN.md)

[← Back to README](README.md)

MarketLens uses Tauri 2, Rust, Vite, and pnpm. Build Windows packages on Windows and macOS packages on a Mac. Android can be built with local Android tools or with the reproducible Docker environment below.

## Common setup

1. Install [Node.js LTS](https://nodejs.org/), [pnpm](https://pnpm.io/installation), and [Rust](https://www.rust-lang.org/tools/install).
2. Complete the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system.
3. Install dependencies and run the frontend tests:

```sh
pnpm install --frozen-lockfile
pnpm test
```

`pnpm build` builds only the frontend. Use `pnpm tauri ... build` to create installable apps.

## Windows

Install Microsoft C++ Build Tools with **Desktop development with C++** and Microsoft Edge WebView2 Runtime. Use the MSVC Rust toolchain, then run in PowerShell:

```powershell
pnpm install --frozen-lockfile
pnpm tauri build --bundles nsis
```

The installer is written to `src-tauri/target/release/bundle/nsis/`. For MSI, use `pnpm tauri build --bundles msi`. MSI may require the Windows VBSCRIPT optional feature. See [Windows code signing](https://v2.tauri.app/distribute/sign/windows/) before distribution.

## macOS

Install Xcode Command Line Tools with `xcode-select --install`, then run:

```sh
pnpm install --frozen-lockfile
pnpm tauri build --bundles dmg
```

The DMG is written to `src-tauri/target/release/bundle/dmg/`. For a universal Apple Silicon and Intel build:

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm tauri build --bundles dmg --target universal-apple-darwin
```

Distribution outside the App Store requires Apple signing and notarization. See [macOS code signing](https://v2.tauri.app/distribute/sign/macos/).

## Android with Docker

This is the recommended reproducible Android path. The host only needs Docker Desktop or Docker Engine. The image pins Node 22.14.0, pnpm 10.15.1, Rust 1.90.0, JDK 17, Android SDK Platform 36, Build Tools 36.0.0, NDK 28.2.13676358, and Android Command-line Tools 15859902. It installs all four Tauri Android Rust targets. The local `@tauri-apps/cli` 2.11.4 from `pnpm-lock.yaml` runs through `pnpm tauri`.

The image uses `linux/amd64` because Google's Linux Android NDK host tools are x86-64. Docker Desktop uses emulation on Apple Silicon, so builds work there but run more slowly.

### Windows PowerShell

Run from the repository root:

```powershell
docker version
docker build -f Dockerfile.android -t marketlens-android .
New-Item -ItemType Directory -Force src-tauri/gen, dist-android | Out-Null

# Run once. The bind mount keeps the generated Android project on the host.
docker run --rm `
  -v "${PWD}/src-tauri/gen:/workspace/src-tauri/gen" `
  marketlens-android init

# Debug APK (default mode; ARM64 and ARMv7).
docker run --rm `
  -v "${PWD}/src-tauri/gen:/workspace/src-tauri/gen" `
  -v "${PWD}/dist-android:/output" `
  --mount type=volume,src=marketlens-gradle-cache,dst=/root/.gradle `
  --mount type=volume,src=marketlens-cargo-registry,dst=/usr/local/cargo/registry `
  --mount type=volume,src=marketlens-cargo-git,dst=/usr/local/cargo/git `
  --mount type=volume,src=marketlens-target-cache,dst=/workspace/src-tauri/target `
  marketlens-android
```

Use `marketlens-android release` for a release APK or `marketlens-android aab` for a release AAB. Add `-e ANDROID_TARGETS=aarch64,armv7,i686,x86_64` before the image name to include emulator ABIs.

### macOS or Linux (bash/zsh)

Run from the repository root:

```sh
docker version
docker build -f Dockerfile.android -t marketlens-android .
mkdir -p src-tauri/gen dist-android

# Run once. The bind mount keeps the generated Android project on the host.
docker run --rm \
  -v "$(pwd)/src-tauri/gen:/workspace/src-tauri/gen" \
  marketlens-android init

# Debug APK (default mode; ARM64 and ARMv7).
docker run --rm \
  -v "$(pwd)/src-tauri/gen:/workspace/src-tauri/gen" \
  -v "$(pwd)/dist-android:/output" \
  --mount type=volume,src=marketlens-gradle-cache,dst=/root/.gradle \
  --mount type=volume,src=marketlens-cargo-registry,dst=/usr/local/cargo/registry \
  --mount type=volume,src=marketlens-cargo-git,dst=/usr/local/cargo/git \
  --mount type=volume,src=marketlens-target-cache,dst=/workspace/src-tauri/target \
  marketlens-android
```

Use `marketlens-android release` or `marketlens-android aab` for release output. Add `-e ANDROID_TARGETS=aarch64,armv7,i686,x86_64` before the image name to include emulator ABIs.

### Modes and outputs

| Mode | Tauri command | Host output |
| --- | --- | --- |
| `init` | `pnpm tauri android init --ci` | `src-tauri/gen/android/` |
| `debug` (default) | `pnpm tauri android build --ci --debug --apk` | `dist-android/marketlens-debug.apk` |
| `release` | `pnpm tauri android build --ci --apk` | `dist-android/marketlens-release.apk` |
| `aab` | `pnpm tauri android build --ci --aab` | `dist-android/marketlens-release.aab` |

`init` is intentionally separate. Normal image and app builds do not regenerate `src-tauri/gen/android`. The wrapper checks that the generated manifest declares `android.permission.INTERNET`, which MarketLens needs for charts and quotes.

### Release signing

Configure `src-tauri/gen/android/app/build.gradle.kts` once to read `src-tauri/gen/android/keystore.properties`, following the official [Tauri Android signing guide](https://v2.tauri.app/distribute/sign/android/). Do not commit that properties file or the keystore.

Mount the keystore read-only and pass credentials at runtime. After configuring Gradle, this PowerShell example creates a signed AAB:

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

The bash/zsh form is:

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

The wrapper creates `keystore.properties` only for the build and removes it on exit. The keystore remains outside the repository and image. Use a secret manager in CI instead of putting passwords in a Dockerfile, command history, or source file.

### Troubleshooting

- **Docker is missing or stopped:** install/start Docker Desktop or Docker Engine. `docker version` must show both Client and Server.
- **SDK, NDK, Rust target, or Java mismatch:** run `docker build --no-cache -f Dockerfile.android -t marketlens-android .`. The wrapper validates Java 17 and the fixed SDK paths.
- **Android project is missing:** create `src-tauri/gen`, run `init` once, and keep the same bind mount on later builds.
- **Permission denied:** make `src-tauri/gen` and `dist-android` writable. On Linux, correct any root-owned files or run Docker with a matching user ID after initialization.
- **Empty output:** inspect the preceding build error and confirm `/output` maps to `dist-android`. The wrapper fails if it cannot find the expected APK/AAB.
- **Windows mount error:** use PowerShell, Docker Desktop Linux containers, and absolute `${PWD}` paths. Ensure the drive is shared with Docker Desktop.
- **Apple Silicon is slow:** x86-64 emulation is expected for the `linux/amd64` image and NDK host tools.
- **Disk usage grows:** named Gradle, Cargo, and target volumes speed up later builds. Inspect with `docker system df`; remove only the specific `marketlens-*` volumes when you want a clean cache.
- **Clean rebuild:** remove the `marketlens-android` image and four named cache volumes, rebuild, and rerun. Keep `src-tauri/gen/android` unless you intentionally want to reinitialize it.

## Android with local tools

Follow the [Tauri Android prerequisites](https://v2.tauri.app/start/prerequisites/#android), set `JAVA_HOME`, `ANDROID_HOME`, and `NDK_HOME`, and install all four Rust targets:

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
pnpm install --frozen-lockfile
pnpm tauri android init
pnpm tauri android build --apk --target aarch64 --target armv7
```

Local APKs appear below `src-tauri/gen/android/app/build/outputs/apk/`; AABs appear below `src-tauri/gen/android/app/build/outputs/bundle/`.

## Verification scope

Frontend tests and Docker configuration can be checked on any development host. A complete Android package build still downloads Gradle and Rust dependencies and should be run on a Docker host before release. Charts, quotes, and setup monitoring require internet access at runtime.
