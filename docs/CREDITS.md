# Credits and license

The launcher was developed in [bloodborne-mac](https://github.com/bloodborne-native/bloodborne-mac)
and extracted into this repository with its launcher history on 2026-10-12. It is licensed under
GPL-2.0-or-later; see [LICENSE](../LICENSE).

The runtime it launches is built on [bbport](https://github.com/deadinside28/bloodborne_pc) by
deadinside28 and [shadPS4](https://github.com/shadps4-emu/shadPS4). Their credits and the additional
runtime contributors remain in [bloodborne-runtime's credits](https://github.com/bloodborne-native/bloodborne-runtime/blob/main/docs/CREDITS.md).

The UI uses Tauri, React, shadcn/ui, Base UI, Tailwind CSS, TanStack Query, Zustand, i18next,
Sonner, lucide, and the Cinzel and Inter fonts. Dependency licenses remain with their packages.
Release checking also uses reqwest, rustls, semver and Tauri’s opener plugin. Release notes
are rendered with [react-markdown](https://github.com/remarkjs/react-markdown) (MIT) as a package
dependency; no implementation source was copied. These are package
dependencies; their licenses remain with their packages. No external update-checker source code
was copied. No code from an external save editor has been adopted.

## Character save format

The Bloodborne character preview and limited editor use field locations checked against
[Noxde/Bloodborne-save-editor at d8d0365](https://github.com/Noxde/Bloodborne-save-editor/tree/d8d03658f288fe747f819d0dc9a09c5f9d2e1668)
(GPL-3.0). Its source is not copied: the parser, validation, staged whole-set edit, backup and
edited-save handling here are independent launcher code.

The base HP and stamina progression values used when editing Vitality or Endurance were checked
against the public [Bloodborne Wiki Vitality](https://www.bloodborne-wiki.com/2015/05/vitality.html)
and [Endurance](https://www.bloodborne-wiki.com/2015/05/endurance.html) tables
([CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)). No wiki text or game data files
are included.

## Leari database architecture

The Drizzle-to-Tauri SQL adapter in `src/db/client.ts` is adapted from
[leari-mail/leari, commit 5876482](https://github.com/leari-mail/leari/tree/5876482)
by Pablo Souza (MIT). Its service/hook organization and shared SQLite access informed this
launcher design. The [original MIT notice](licenses/leari-MIT.txt) is retained here.

## shadcn dialogs

`src/components/ui/dialog.tsx` and `alert-dialog.tsx` were generated with shadcn CLI 4.21.4
using the project's base-nova registry. The Base UI component templates are from
[shadcn-ui/ui, reference 30a58d4](https://github.com/shadcn-ui/ui/tree/30a58d4498f270af1c1e981a7d78a15cf5740841/apps/v4/registry/bases/base/ui).
The [upstream MIT notice](licenses/shadcn-ui-MIT.txt) is retained here.

## Leari menu-bar and window handling

`src-tauri/src/tray.rs` adapts window restoration and Dock/taskbar handling from
[leari-mail/leari 5876482](https://github.com/leari-mail/leari/tree/5876482/src-tauri/src)
(MIT, Pablo Souza). Its tray/menu setup informed the game-driven lifecycle. The original MIT
notice is already retained in `docs/licenses/leari-MIT.txt`. No Leari icon or other artwork was
copied; the hunter's sigil is original launcher artwork.

## Home background

`src/assets/home-hero.webp`, the night city behind Home's title, and `src/assets/page-background.webp`,
the night street blurred behind the other pages, are AI-generated images supplied by the maintainer
(2026-10-27): generic gothic scenes with no character, weapon or place from the game, converted to
WebP. No game artwork is included; the game card's tile is read from the
player's own dump (`sce_sys/icon0.png`) when Home is shown and is never stored.

## Trophy tracking

The runtime event persistence follows the approach in
[Supermedo/bloodborne_pc `79d44f0`](https://github.com/Supermedo/bloodborne_pc/commit/79d44f0eecc2eed45c1e33b48996e53626adca48)
by Ambrose (GPL-2.0-or-later). The launcher importer, eligibility checks and React UI are
project code. The public ID/grade/base-DLC mapping is now adapted from that commit,
with English names checked against [PSN100](https://psn100.net/game/3609-bloodborne).
Localized names come from [Exophase’s public lists](https://www.exophase.com/game/bloodborne-ps4/trophies/);
`trophy_catalog.json` records each locale’s source. The English public list has one UK/US
spelling difference at ID 2; the default English spelling follows PSN100.

Requirement descriptions are original summaries, based on public requirements in
[Gamepressure](https://www.gamepressure.com/bloodborne/list-of-all-trophies/z7aad1), PSN100 and
[the Brazilian Portuguese guide](https://magnaway.com.br/guias/38082/guia-de-trofeus-bloodborne/).
No extracted game metadata, decryption key, game description text or game artwork is included.
Grade emblems use the existing lucide-react dependency; the notification styling is original.

The game displays notifications in its own ImGui overlay using a copy of the reviewed public
catalog. The launcher keeps the unlock history and trophy list; no separate notification
window or helper is packaged.

## LLVM toolchain

The Recompiled code page downloads clang and `ld64.lld` from
[LLVM](https://llvm.org) 23.1.4 (Apache-2.0 with LLVM exception), trimmed from LLVM's official
release by bloodborne-recomp's `tools/recomp/toolchain.sh` and published with LLVM's licence as
that repository's `toolchain-llvm-23.1.4` release. The launcher does not ship it; it deletes the
toolchain once the library is built.
