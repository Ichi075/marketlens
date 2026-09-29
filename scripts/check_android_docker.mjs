import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [dockerfile, wrapper, dockerignore, english, japanese, lockfile] = await Promise.all([
  read("Dockerfile.android"),
  read("scripts/build-android-docker.sh"),
  read(".dockerignore"),
  read("BUILDING.md"),
  read("BUILDING.ja.md"),
  read("pnpm-lock.yaml"),
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

console.log("Android Docker configuration checks passed.");
