# Building MarketLens

**English** | [日本語](BUILDING.ja.md) | [简体中文](BUILDING.zh-CN.md)

[← Back to README](README.md)

This repository uses Tauri 2, Rust, Vite, and pnpm. Build the Windows installer on Windows and the macOS DMG on a Mac. Android builds can be made on Windows or macOS. Run the commands below from the repository root.

## Common setup

1. Install [Node.js LTS](https://nodejs.org/) and [pnpm](https://pnpm.io/installation).
2. Install [Rust](https://www.rust-lang.org/tools/install).
3. Complete the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) for your operating system.
4. Install the project's dependencies and run the frontend tests:

```sh
pnpm install --frozen-lockfile
pnpm test
```

`pnpm build` builds only the frontend. Use the `pnpm tauri ... build` commands below to create installable apps.

## Windows

Install Microsoft C++ Build Tools with **Desktop development with C++** and the Microsoft Edge WebView2 Runtime. Use the MSVC Rust toolchain. See the [Windows prerequisites](https://tauri.app/start/prerequisites/#windows).

In PowerShell, build an NSIS setup executable:

```powershell
pnpm install --frozen-lockfile
pnpm tauri build --bundles nsis
```

The installer is created in `src-tauri/target/release/bundle/nsis/`. For an MSI, run `pnpm tauri build --bundles msi` instead. MSI builds may require the Windows VBSCRIPT optional feature. See [Windows code signing](https://tauri.app/distribute/sign/windows/) before distributing a signed installer.

## macOS

On a Mac, install Xcode Command Line Tools (`xcode-select --install`), Rust, Node.js, and pnpm. Build a DMG:

```sh
pnpm install --frozen-lockfile
pnpm tauri build --bundles dmg
```

The DMG is created in `src-tauri/target/release/bundle/dmg/`. By default, it targets the architecture of the build machine. To create one app for both Apple Silicon and Intel, install both Rust targets and specify the universal target:

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm tauri build --bundles dmg --target universal-apple-darwin
```

Distribution outside the App Store requires Apple code signing and notarization. See [macOS code signing](https://tauri.app/distribute/sign/macos/).

## Android

Follow the [Android prerequisites](https://tauri.app/start/prerequisites/#android) to install Android Studio, Android SDK Platform, Platform-Tools, Build-Tools, Command-line Tools, the side-by-side NDK, and Java. Set `JAVA_HOME`, `ANDROID_HOME`, and `NDK_HOME`, then add the Rust targets for the ABIs you plan to build. This example targets common physical devices:

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi
pnpm install --frozen-lockfile
pnpm tauri android init
pnpm tauri android build --apk --target aarch64 --target armv7
```

Run `android init` once per development environment. The generated `src-tauri/gen/android/` directory is ignored by Git. APKs appear under `src-tauri/gen/android/app/build/outputs/apk/`. Without target flags, Tauri builds all supported ABIs.

To create an AAB for Google Play with the same ARM targets, run:

```sh
pnpm tauri android build --aab --target aarch64 --target armv7
```

The AAB appears in `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/`. Play Store submission additionally requires an upload key, [Android app signing](https://tauri.app/distribute/sign/android/), and Play Console setup. Never commit signing keys or passwords to this repository.

## Notes

These are build instructions, not a claim that native packages have been tested on all three platforms. Charts and quotes require an internet connection. See the [README](README.md) for TradingView widget and data-provider limitations.
