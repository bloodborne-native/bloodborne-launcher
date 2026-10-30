#!/usr/bin/env bash
# The iOS project's "Build Rust Code" phase (src-tauri/gen/apple/project.yml), in place of
# `tauri ios xcode-script`: that needs Xcode's iOS simulator platform installed and the Tauri CLI
# running beside Xcode. Builds the front end (dist/), then the launcher library for arm64 iPhones
# with the front end embedded (tauri/custom-protocol, as `tauri build` does), as the project's
# Externals/arm64/<configuration>/libapp.a.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
config=${CONFIGURATION:-debug}
out=${SRCROOT:-$root/src-tauri/gen/apple}/Externals/arm64/$config
(cd "$root" && npm run --silent build)
target=target
# Release: Cargo's dev profile made optimized, in its own target folder. Tauri's Swift glue
# (swift-rs) is built in release when Cargo's DEBUG is false, and a release Swift build keeps its
# exported C functions (log_stdout, register_plugin, ...) local: the app then does not link. Line
# tables keep DEBUG true; on Apple platforms they stay in the object files, not in the app.
if [[ $config == release ]]; then
    target=target/ios-release
    export CARGO_PROFILE_DEV_OPT_LEVEL=3 CARGO_PROFILE_DEV_DEBUG=line-tables-only CARGO_PROFILE_DEV_DEBUG_ASSERTIONS=false \
        CARGO_PROFILE_DEV_OVERFLOW_CHECKS=false CARGO_PROFILE_DEV_INCREMENTAL=false
fi
# Xcode's SDKROOT names the iOS SDK; Cargo's build scripts run on the Mac and need its own. C code
# compiled for the Mac at build time (SQLite, for sqlx's macros) is given the Mac's SDK too: in
# Xcode's environment it did not find stdio.h.
export CFLAGS_aarch64_apple_darwin="-isysroot $(env -u SDKROOT xcrun --sdk macosx --show-sdk-path)"
cd "$root/src-tauri"
env -u SDKROOT CARGO_TARGET_DIR="$target" cargo build --lib --target aarch64-apple-ios --features tauri/custom-protocol
mkdir -p "$out"
cp "$target/aarch64-apple-ios/debug/libbloodborne_launcher_lib.a" "$out/libapp.a"
