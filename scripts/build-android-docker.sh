#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:-debug}"
project_root="${PROJECT_ROOT:-/workspace}"
output_dir="${OUTPUT_DIR:-/output}"
android_project="$project_root/src-tauri/gen/android"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

check_environment() {
  require_command java
  require_command pnpm
  require_command rustup
  require_command sdkmanager
  [[ -f "$project_root/package.json" ]] || die "package.json was not found in $project_root"
  [[ -f "$project_root/src-tauri/tauri.conf.json" ]] || die "src-tauri/tauri.conf.json was not found"
  [[ -d "${ANDROID_HOME:-}" ]] || die "ANDROID_HOME is missing or invalid"
  [[ -d "${NDK_HOME:-}" ]] || die "NDK_HOME is missing or invalid"
  java -version 2>&1 | grep -q 'version "17\.' || die "Java 17 is required by this image"
}

check_internet_permission() {
  local manifests=()
  mapfile -t manifests < <(find "$android_project" -name AndroidManifest.xml -type f -print)
  ((${#manifests[@]} > 0)) || die "no AndroidManifest.xml was generated"
  grep -q 'android.permission.INTERNET' "${manifests[@]}" \
    || die "the generated Android project does not declare android.permission.INTERNET"
}

configure_signing() {
  local values=(
    "${ANDROID_KEYSTORE_PATH:-}"
    "${ANDROID_KEY_ALIAS:-}"
    "${ANDROID_KEY_PASSWORD:-}"
  )
  local present=0
  local value
  for value in "${values[@]}"; do
    [[ -n "$value" ]] && present=$((present + 1))
  done

  if ((present == 0)); then
    return
  fi
  ((present == ${#values[@]})) \
    || die "set ANDROID_KEYSTORE_PATH, ANDROID_KEY_ALIAS, and ANDROID_KEY_PASSWORD together"
  [[ -r "$ANDROID_KEYSTORE_PATH" ]] || die "keystore is not readable: $ANDROID_KEYSTORE_PATH"

  signing_properties="$android_project/keystore.properties"
  [[ ! -e "$signing_properties" ]] \
    || die "refusing to overwrite existing $signing_properties"
  umask 077
  cat >"$signing_properties" <<EOF
password=$ANDROID_KEY_PASSWORD
keyAlias=$ANDROID_KEY_ALIAS
storeFile=$ANDROID_KEYSTORE_PATH
EOF
  trap 'rm -f "${signing_properties:-}"' EXIT
}

copy_latest_artifact() {
  local pattern="$1"
  local destination="$2"
  local artifacts=()
  mapfile -t artifacts < <(find "$android_project/app/build/outputs" -type f -name "$pattern" -printf '%T@ %p\n' | sort -nr)
  ((${#artifacts[@]} > 0)) || die "build finished but no $pattern artifact was found"
  local source="${artifacts[0]#* }"
  install -m 0644 "$source" "$output_dir/$destination"
  printf 'artifact: %s\n' "$output_dir/$destination"
}

check_environment
cd "$project_root"

case "$mode" in
  init)
    if [[ -d "$android_project" ]]; then
      printf 'Android project already exists: %s\n' "$android_project"
    else
      pnpm tauri android init --ci
      printf 'Android project generated: %s\n' "$android_project"
    fi
    pnpm android:prepare
    check_internet_permission
    ;;
  debug|release|aab)
    [[ -d "$android_project" ]] \
      || die "Android project is missing. Run the documented Docker init command once, then retry."
    [[ -d "$output_dir" && -w "$output_dir" ]] \
      || die "output directory is not writable: $output_dir"
    check_internet_permission
    configure_signing

    IFS=',' read -r -a requested_targets <<<"${ANDROID_TARGETS:-aarch64,armv7}"
    target_args=()
    for target in "${requested_targets[@]}"; do
      case "$target" in
        aarch64|armv7|i686|x86_64) target_args+=(--target "$target") ;;
        *) die "unsupported Android target: $target" ;;
      esac
    done

    case "$mode" in
      debug)
        rm -rf "$android_project/app/build/outputs/apk"
        pnpm tauri android build --ci --debug --apk "${target_args[@]}"
        copy_latest_artifact '*debug*.apk' marketlens-debug.apk
        ;;
      release)
        rm -rf "$android_project/app/build/outputs/apk"
        pnpm tauri android build --ci --apk "${target_args[@]}"
        copy_latest_artifact '*release*.apk' marketlens-release.apk
        ;;
      aab)
        rm -rf "$android_project/app/build/outputs/bundle"
        pnpm tauri android build --ci --aab "${target_args[@]}"
        copy_latest_artifact '*.aab' marketlens-release.aab
        ;;
    esac
    ;;
  *)
    die "unknown mode '$mode' (expected: init, debug, release, or aab)"
    ;;
esac
