import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [dockerfile, wrapper, dockerignore, english, japanese, lockfile, androidConfig, androidPrepare, style, main] = await Promise.all([
  read("Dockerfile.android"),
  read("scripts/build-android-docker.sh"),
  read(".dockerignore"),
  read("BUILDING.md"),
  read("BUILDING.ja.md"),
  read("pnpm-lock.yaml"),
  read("src-tauri/tauri.android.conf.json"),
  read("scripts/prepare-android.mjs"),
  read("src/style.css"),
  read("src/main.ts"),
]);

for (const expected of [
  "openjdk-17-jdk-headless",
  "platforms;android-${ANDROID_PLATFORM}",
  "build-tools;${ANDROID_BUILD_TOOLS}",
  "ndk;${ANDROID_NDK}",
  "pnpm install --frozen-lockfile",
  "aarch64-linux-android",
  "armv7-linux-androideabi",
  "i686-linux-android",
  "x86_64-linux-android",
]) {
  assert.ok(dockerfile.includes(expected), `Dockerfile is missing ${expected}`);
}

assert.match(lockfile, /'@tauri-apps\/cli@2\.11\.4'/);
assert.ok(!dockerfile.includes("npm install --global @tauri-apps/cli"));
assert.ok(dockerfile.includes('ARG RUST_VERSION=1.90.0'));
assert.ok(english.includes('Rust 1.90.0'));
assert.ok(japanese.includes('Rust 1.90.0'));

for (const expected of [
  "init)",
  "debug|release|aab)",
  "pnpm tauri android init --ci",
  "pnpm tauri android build --ci",
  "marketlens-debug.apk",
  "marketlens-release.apk",
  "marketlens-release.aab",
  "android.permission.INTERNET",
  "ANDROID_KEYSTORE_PATH",
]) {
  assert.ok(wrapper.includes(expected), `build wrapper is missing ${expected}`);
}

for (const doc of [english, japanese]) {
  for (const expected of [
    "Dockerfile.android",
    "Windows PowerShell",
    "macOS",
    "marketlens-android init",
    "marketlens-android release",
    "marketlens-android aab",
    "dist-android/marketlens-debug.apk",
    "ANDROID_TARGETS=aarch64,armv7,i686,x86_64",
    "ANDROID_KEYSTORE_PATH",
  ]) {
    assert.ok(doc.includes(expected), `build guide is missing ${expected}`);
  }
}

for (const expected of ["node_modules", "dist-android", "src-tauri/gen", "src-tauri/target"]) {
  assert.ok(dockerignore.includes(expected), `.dockerignore is missing ${expected}`);
}

const androidBuild = JSON.parse(androidConfig).build;
assert.equal(androidBuild.beforeDevCommand, 'pnpm android:dev-frontend');
assert.equal(androidBuild.beforeBuildCommand, 'pnpm android:build-frontend');
for (const expected of [
  'WindowInsetsCompat.Type.systemBars()',
  'BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE',
  'onWindowFocusChanged',
]) {
  assert.ok(androidPrepare.includes(expected), `Android activity preparation is missing ${expected}`);
}
assert.ok(style.includes('.platform-android .workspace'));
assert.ok(style.includes('.platform-android .sidebar'));
assert.ok(main.includes("const isAndroid = /Android/i.test(navigator.userAgent)"));
assert.ok(main.includes('if (!isAndroid) mountBothCharts()'));
assert.ok(main.includes("document.querySelector<HTMLElement>('#sidebar')!.inert = !isAndroid"));
assert.ok(main.includes('hide_top_toolbar: compact'));
assert.ok(main.includes("if (!document.hidden) void refreshQuotes('active')"));

console.log("Android Docker configuration checks passed.");
