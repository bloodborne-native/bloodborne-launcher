# bloodborne-launcher

[![Discord](https://img.shields.io/badge/Discord-join%20the%20server-5865F2?logo=discord&logoColor=white)](https://discord.gg/QS6vHz45xA)

The independent launcher for [bloodborne-native](https://github.com/bloodborne-native).
Its source is included as the `launcher/` submodule of
[bloodborne-mac](https://github.com/bloodborne-native/bloodborne-mac), which packages it as the macOS app.
macOS game integration works today; Windows and Linux integration are planned.
Player guides are in the app's [docs](https://github.com/bloodborne-native/bloodborne-mac/tree/main/docs/guide);
the launcher's own design is in [docs](docs/README.md).

The launcher inside `Bloodborne.app`. It has a game folder check, graphics, controls (controller
choice and button mapping), game options, user profiles, saves and backups, mods, patches, advanced options and the game's log. It
starts the game with the app's own bash and Python ([bloodborne-mac packaging](https://github.com/bloodborne-native/bloodborne-mac/blob/main/packaging/macos.sh) builds the app around it).

- **Interface:** React 19, TypeScript, Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com)
  (Base UI), lucide icons, react-i18next.
- **Backend:** [Tauri 2](https://tauri.app) (`src-tauri/src/main.rs`). It keeps the settings in its
  SQLite database (`settings_store.rs`; `launcher.json` and `bbport.ini` in the data folder
  are imported once and still written for the
  scripts and older launchers) and in sync with the in-game menu while the game runs, lists mods
  and patches through `runtime/scripts/launcher_api.py`, controllers through `bb-gpu-capabilities`, and
  runs `run.sh`.

```bash
npm ci
npm run dev          # the interface in a browser, with mock data (src/lib/mockApi.ts); #graphics etc. opens a tab
BB_REPO=/path/to/bloodborne-runtime npm run tauri dev  # standalone: runtime build required
npm run check        # TypeScript, ESLint and the locales' keys
npx tauri build      # Bloodborne.app (packaging/macos.sh adds the game to it)
```

## Platforms and screen sizes

The launcher is meant for macOS, Windows and Linux, and later Android and iOS. Only the macOS game
integration exists today; the launcher itself builds and runs on the iPhone (below).

- **System differences** live in `src-tauri/src/platform.rs`: the data folder (macOS
  `~/Library/Application Support/bloodborne_mac`; Linux `$XDG_DATA_HOME/bloodborne-native`, by
  default `~/.local/share/bloodborne-native`; Windows `%APPDATA%\bloodborne-native`; iOS the app's
  `Documents`, shown in the Files app), the
  package's layout, program names (`.exe`), the online module's file, opening a folder, finding
  and stopping the game, and the system language. The rest of the backend is the same everywhere;
  CI checks it on macOS at every push, and also on Ubuntu and Windows when run by hand
  (`gh workflow run checks.yml`; releases are macOS-only for now).
- **Texts** never name a system ("this computer", "Show the folder"). Options that exist on one
  system only (Metal, MetalFX, the Metal HUD, MoltenVK) appear only there (`config.platform`).
- **Layout:** from Tailwind's `md` width (768 px) up, the sidebar with the tabs and Play; below it
  (phones, small windows) a tab strip at the top (`components/mobile/MobileHeader`) and the profile
  and Play in a bar at the bottom (`MobileBar`), inside the screen's safe areas. Setting rows put
  their control under the text below `sm` (640 px). The macOS title-bar strip is drawn only on
  macOS. `npm run dev` shows both layouts when the browser window is resized.

## Conventions

These are enforced by ESLint (`eslint.config.js`) where possible.

- **One component per file** (`react/no-multi-comp`). shadcn's generated `src/components/ui` is
  exempt.
- **Imports go through the `@/` alias** (`src/`), never relative paths (`no-restricted-imports`).
- **Every folder has an `index.ts`** that exports its contents. Code outside a folder imports
  from the folder (`@/components/settings`, `@/hooks`, `@/lib/data`). Files inside a folder
  import their siblings by full path (`@/pages/controls/BindingRow`), so a folder's index is
  never imported from inside it.
- **A folder holds a feature and its parts.** For example, `components/sidebar` has the
  sidebar, its nav item and the Play button, and `pages/controls` has the page with its rows and
  pickers.
- **State:**
  - Backend data goes through **TanStack Query** (`src/hooks`): the config, the game check,
    mods, patches and controllers. Settings use optimistic mutations; file operations wait for native confirmation.
  - Client state goes in **Zustand** stores (`src/stores`): the game process and its log, and
    the current tab.
  - Keep component-local state in `useState`.
- **All text comes from i18n** (`src/i18n/locales/*.json`). `en.json` is the reference: its keys
  are typed (`i18next.d.ts`), so a missing key is a type error. Option lists store keys
  (`src/lib/data`), with `literal: true` for names shown as they are, such as language names.
- **UI components come from shadcn** (`npx shadcn@latest add <name>`, then export them from
  `src/components/ui/index.ts`). The theme is the CSS variables in `src/index.css`.

### iOS

The launcher is a library (`src-tauri/src/lib.rs`, `run()`): desktop's `main.rs` and the iOS
project (`src-tauri/gen/apple`, generated by `tauri ios init` and kept in Git) start it. On iOS the
tray and the single-instance plugin are left out (`tray_mobile.rs` stands in for `tray.rs`), the
identifier and minimum version come from `tauri.ios.conf.json`, and Play does not start a program:
it calls `bb_ios_start_game`, which the app around the launcher provides
([bloodborne-ios](https://github.com/bloodborne-native/bloodborne-ios), private), on the main
thread (`platform::start_in_app`). Without it Play says the game is not in this build.

The project's Rust build phase is `scripts/ios-rust.sh` (the front end, then the library for
arm64 iPhones), not `tauri ios xcode-script`, which needs Xcode's iOS simulator platform and the
Tauri CLI running. Needs Xcode, `rustup target add aarch64-apple-ios` and, to regenerate the
project, `xcodegen` and CocoaPods.

```bash
cd src-tauri/gen/apple
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -project bloodborne-launcher.xcodeproj \
    -scheme bloodborne-launcher_iOS -configuration debug -destination "id=<udid>" \
    -derivedDataPath ../../target/ios-xcode -allowProvisioningUpdates DEVELOPMENT_TEAM=<team> build
xcrun devicectl device install app --device <udid> ../../target/ios-xcode/Build/Products/debug-iphoneos/Bloodborne.app
```

## Layout

| Path | Contents |
|---|---|
| `src/components/ui` | shadcn/ui components |
| `src/components/{brand,settings,sidebar,window}` | Shared building blocks: setting rows, sidebar, window shell |
| `src/pages/<tab>` | One folder per tab, with the page and its parts |
| `src/hooks` | TanStack Query hooks and small effects |
| `src/stores` | Zustand stores |
| `src/lib` | Backend calls (`api.ts`, `mockApi.ts`), types, query client, `data/` (options, controls) |
| `src/i18n` | i18next setup and locales: the game's 20 languages (`scripts/check_locales.py` checks them against `en.json`) |
| `src/db`, `src/services` | Drizzle schema/migrations and typed identity reads |
| `src-tauri/src/database.rs`, `src-tauri/src/profiles.rs` | SQLite migrations, ownership and file-operation journal |
| `src-tauri/src/saves.rs` | Complete save sets, profiles, backups and restore; synthetic file tests |
| `src-tauri` | Rust backend, Tauri config, icons |
| `scripts/make_icon.swift` | Draws the icon the app's icons are made from |

## Checks

```bash
npm run check && npm run build
cd src-tauri && cargo test && cargo clippy -- -D warnings
```

Native tests use synthetic data in temporary folders, never player saves; the browser preview
uses an in-memory backend (`?profile=Name` skips setup, `?update` fakes a new release).
Database schema changes: `npm run db:generate`, then register the migration in
`src-tauri/src/database.rs` ([Profiles, saves and the database](docs/SAVE_MANAGER.md)).

## Documentation

[Settings](docs/SETTINGS.md) · [Profiles, saves and the database](docs/SAVE_MANAGER.md) ·
[While the game runs](docs/LAUNCHER_LIFECYCLE.md) · [Trophy notifications](docs/OVERLAY.md) ·
[Updates](docs/UPDATES.md) · [Credits and license](docs/CREDITS.md)

## Credits

The project is built on [bbport](https://github.com/deadinside28/bloodborne_pc) and
[shadPS4](https://github.com/shadps4-emu/shadPS4). The SQL adapter and window handling are
adapted from [Leari](https://github.com/leari-mail/leari/tree/5876482) (MIT). See
[Credits and license](docs/CREDITS.md).
