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
  SQLite database (`settings_store.rs`; `launcher.json` and `bbport.ini` in
  `~/Library/Application Support/bloodborne_mac` are imported once and still written for the
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
