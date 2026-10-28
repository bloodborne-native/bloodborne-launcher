# Recompiled code

[← Documentation](README.md)

The **Recompiled code** page (Settings) builds the recompiled library on the player's device and
lets the player use it: the game's code compiled once, from the player's own executable, instead
of translated while playing. The player's view is the app's
[Performance](https://github.com/bloodborne-native/bloodborne-mac/blob/main/docs/guide/performance.md#recompiled-code)
guide; the build itself is bloodborne-recomp's
[Building the library without Xcode](https://github.com/bloodborne-native/bloodborne-recomp/blob/main/docs/RECOMPILATION.md#building-the-library-without-xcode).

## Pieces

- **The kit** ships in the app (bloodborne-runtime installs it in `Contents/Resources/game/recomp/`):
  `bin/scan`, `bin/bbrecomp`, the headers the generated C includes, `sdkless/`, and
  `tools/build_library.py` with its Python steps. `VERSION` holds the recomp commit; the script's
  `--version` prints it. A development run uses the checkout's `recomp/tools/recomp/` instead.
- **The toolchain** is LLVM 23.1.4's clang, `ld64.lld` and clang's headers (70 MB, 360 MB
  unpacked), from bloodborne-recomp's `toolchain-llvm-23.1.4` release. `recomp.rs` pins its URL
  and SHA-256, checks the download while it streams, unpacks it with `tar` into
  `<data>/recomp/toolchain/` and deletes it once the library is built.
- **The library** is `<data>/recomp/librecomp.dylib` with `library.json` (the executable's
  SHA-256, the recomp version, the compiler, the time, the size). While building, the generated C
  and the objects are in `<data>/recomp/build/` (about 1.8 GB); the script removes them after
  linking. Nothing leaves the device: they are the game's code.

## The backend (`src-tauri/src/recomp.rs`)

| Command | What it does |
|---|---|
| `recomp_status` | `none`, `ready`, `stale` (`reason`: `game` or `recompiler`) or `building`; the record; the disk the folder takes |
| `recomp_build` | Downloads and unpacks the toolchain if needed, runs `build_library.py --jobs <cores − 2>`, sends its progress as `recomp-progress` events (`download`, `unpack`, `check`, `extract`, `scan`, `generate`, `compile` with `done`/`total`, `link`, then `done`, `error` or `cancelled`) and resolves when it ends |
| `recomp_cancel` | Stops the download at its next chunk or kills the script; what was compiled stays, so the next build continues |
| `recomp_delete` | Removes `<data>/recomp/` (refused while building) |

The setting `cpu` is `translated` (default) or `recompiled`. At launch, `recompiled` sets
`BB_RECOMP_LIB` only when the record matches the selected game's `eboot.bin` and the kit's
version; otherwise the game starts with the translator and the log's first line says why. The
runtime checks each function's bytes again when it loads the library.

## The page (`src/pages/recomp/`)

An explanation (less CPU time at about the same frame rate; not a native version), the choice
(Recompiled is offered once a library is ready), and the library's state with Build, Build again,
Cancel and Delete. During a build: the step, a bar (megabytes or files), the elapsed time and an
estimate from the compile rate (`useRecompStore` keeps the progress while the player is on
another page). The browser preview simulates a build (`?recomp=ready` or `?recomp=stale` for the
other states).

## Measured

On an M3 Pro with 10 jobs, as the launcher runs it from the installed kit with the published
toolchain: 13 min 35 s from the game folder, 241,821 functions, a 330 MB library; the game ran
it with 240,978 functions replaced, no faults, median frame 26.7 ms (the library built by Xcode's
clang: 26.3 ms on the same save).
