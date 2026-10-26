# Profiles, saves and the database

[← Documentation](README.md)

How the launcher owns profiles, saves, backups and trophy history, and how it keeps them safe.
The player's view is the app's [Profiles and saves](https://github.com/bloodborne-native/bloodborne-mac/blob/main/docs/guide/saves.md) guide.

## Roadmap

Completed stages: **2/4 (50%)** `██████████░░░░░░░░░░`

| Stage | Scope | Status |
|---|---|---|
| S0 | Profile ownership, first-profile setup, complete save sets, active selection, backup and restore, deletion, local trophies | Done |
| S1 | Read-only character preview: name, level, attributes, playtime, progression | Done |
| S2 | Import/export and backup history management (pruning) | Planned |
| S3 | Editor for verified fields, with edited-save lineage | Offensive attributes, Blood Echoes and Insight editing done; defensive attributes and items planned |

## Profiles

A profile is an identity with exactly one complete save set (which can hold several
characters), its backups and its trophy history. Profiles are created, renamed, selected and
deleted in the Profiles tab; the active one is shown next to Play and on Home. Names are trimmed
and compared in Unicode lowercase for duplicates; ids and paths never change on rename. New
profiles start empty: saves are never copied between profiles.

**First setup.** A new installation, or an upgrade from a launcher without ownership records,
shows a required first-profile window; Play (and `--play`) is refused until it is done. The
entered name takes ownership of the existing user folder without moving its files; earlier
development profile folders are adopted too. Setup cannot be repeated over established
ownership. A damaged database reports an error; it is never treated as a fresh installation.

**Deletion.** Only an inactive profile, never the last one, after a confirmation dialog.
The database marks the profile deleted and records a pending cleanup in one transaction, then
removes its folder and backups (for the original migrated profile only `savedata/` and its
backups, keeping the shared shader caches). Folder ancestors are checked and links refused. An
interrupted cleanup is retried at startup. The profile row stays as a tombstone so leftover
folders are never adopted again.

## Storage

| Where | What |
|---|---|
| `launcher.db` in the data folder (macOS: `~/Library/Application Support/bloodborne_mac`; see the README's platforms) | SQLite: profiles, save sets, the active profile, backups, trophy unlocks, settings, the file-operation journal |
| `user/` (the original folder) | The first profile's saves, and the shared shader and pipeline caches |
| `save-profiles/<id>/user/` | Other profiles' saves, with a metadata manifest for recovery |
| `database-backups/` | A snapshot of the database before each schema upgrade |

At launch the launcher sets `BB_USER_DIR` to the active profile, `BB_USER_NAME` to its name (the
game sees at most 15 bytes) and `BB_GPU_USER_DIR` to the original folder for the shared caches.
The game always sees user id 1; profiles are separated by folder. Settings are rows of the
`settings` table, shared by all profiles; `bbport.ini` and `launcher.json` are written from them
for the scripts.

**The database.** The schema is Drizzle's (`src/db/schema.ts`; `npm run db:generate`); Rust
applies the generated SQL files, each migration with its history entry in one transaction, after
a `VACUUM INTO` snapshot. Startup checks the history and the actual tables. An older launcher
refuses a newer database. Migrations are immutable once applied: add a new one, never rename or
rewrite one. Native connections use WAL, foreign keys and a busy timeout. The frontend reads
through generated SELECT queries only; every write is a native command. The structure follows
[Leari](https://github.com/leari-mail/leari/tree/5876482).

**Recovery.** Startup and configuration failures show a recovery screen (Retry, the error, Show
in Finder). Never delete `launcher.db` to recover: it owns identity and trophy history. Partial or
unknown schemas are kept and reported, never reset.

## Saves and backups

- A backup copies the whole `savedata/` subtree to a staging folder and publishes it when
  complete. A backup is made before every launch and every restore.
- A restore prepares the replacement beside the live folder, keeps the previous one, and rolls
  back if the swap fails. An interrupted restore blocks the profile and names its recovery path.
- Every file operation is journaled; unfinished ones are marked interrupted at startup after
  reconciling folders with the database.
- Nothing changes while a game runs (the game mutex and `pgrep -x bb-probe`). The launcher is a
  single instance. Backups are not pruned yet.
- Restores keep the profile's identity and trophy history.

The Saves page previews readable character slots in supported Bloodborne save sets (name,
level, attributes, Blood Echoes, Insight, playtime and journey). It refuses ambiguous or
malformed character layouts. The editor changes Vitality (7–99), Endurance (8–99) and the
other four attributes (1–99),
Blood Echoes (0–999,999,999) and Insight (0–99). Max all sets these values to their maxima
and reaches level 544. It recomputes level from the six attributes and updates the three saved
HP or stamina values when Vitality or Endurance changes. Health and stamina use the game's base
progression values; runes and equipment may change the displayed values. Editing
requires the game to be stopped and a preview that still matches the
character file. The launcher edits a staged copy of the whole set, verifies the edited fields,
backs up the live set, marks the staged set edited and then swaps it into place with a
rollback copy. An interrupted swap blocks the profile and names the recovery folder.

Database transactions do not make folder copies atomic: this is not a power-loss guarantee.

## Trophies and edited saves

The runtime records unlocks in the profile's folder
([runtime docs](https://github.com/bloodborne-native/bloodborne-runtime/blob/main/docs/TROPHIES.md));
the launcher imports them into `trophy_unlocks` (earliest timestamp kept) when the runtime prints
an unlock and when Profiles refreshes (every five seconds while playing). The catalog
(`src/lib/trophy-text/trophy_catalog.json`) lists 40 trophies (Bloodborne 34, The Old Hunters 6)
with public names in 15 locales and original requirement summaries in English, Brazilian
Portuguese and French; anything missing falls back to English.

The rule, approved on 2026-10-13: **an edited save never unlocks trophies.** The marker
`savedata/.bb-edited` travels with the save through copies, backups, imports and exports; the
runtime refuses to record and the launcher refuses to import while it is present. The editor
warns before applying a change, writes the marker before publishing the edited save and never
offers a way to make an edited save eligible again; a clean pre-edit backup keeps its own
eligibility. Earned history is never removed by a restore. Whether edited saves may go online is
undecided.

## Checks

`cd src-tauri && cargo test` (synthetic data in temporary folders: migrations, upgrades and
snapshots, recovery, ownership, copies, restores, deletion, trophy import and eligibility) and
`npm run check && npm run build`. Browser previews (`npm run dev`) use an in-memory backend; add
`?profile=Name` to skip setup. No test touches the player's saves.
