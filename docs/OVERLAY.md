# Trophy notifications

[← Documentation](README.md)

The game renders trophy notices in the same ImGui overlay as its settings menu and FPS counter.
The launcher does not draw notifications or start another window. It imports recorded unlocks
for each profile and shows the trophy list.

## Delivery

The runtime checks edited-save eligibility, duplicates and the local trophy log. Only a newly
synced unlock enters the renderer's 16-entry queue. Notices display for five seconds, or seven
for platinum, with a one-second gap. Entries waiting longer than 30 seconds expire. The toast
is part of the game frame, so it follows the game in windowed and fullscreen modes without
changing input focus. If the renderer cannot show it, the recorded unlock remains available to
the launcher.

The game embeds the reviewed public catalog for the notice's name, summary and grade. The
launcher has the same public catalog for its trophy list; no game trophy files, artwork or keys
are needed. The game uses the launcher's selected UI language when available and English for
missing catalog text.

## Settings and preview

Advanced → Launcher → **Trophy notifications** is on by default. The launcher passes
`BB_TROPHY_OVERLAY=0` to disable notices at the next launch; recording continues. For a
copied-save test, `BB_TROPHY_OVERLAY_PREVIEW=1` shows five labelled previews without recording
unlock events.
