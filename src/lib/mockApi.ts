// Browser preview (npm run dev outside Tauri): the backend's answers, in memory, so the
// interface can be developed and screenshotted in any browser. Never used in the app.
import type { Config, Display, Fsr411Support, GameCheck, Gamepad, GameState, Mod, Patch, Settings, SaveChange, SaveList, ProfileList, ProfileChange, Character, CharacterEdit, Inventory, InventoryEdit } from "@/lib/types";

const config: Config = {
  settings: {
    game_dir: "/Users/hunter/Games/CUSA03173",
    user_dir: "",
    save_profile: "original",
    mods_dir: "",
    mods_enabled: true,
    patches_dir: "",
    language: "1",
    fullscreen: false,
    display: "",
    hdr: false,
    present_mode: "Fifo",
    gamepad: "",
    gamepad_name: "",
    fps_mode: "uncap",
    fps_limit: 0,
    draw_pipe: "",
    readbacks: "",
    preupload: "",
    frame_stats: true,
    save_log: false,
    hide_launcher: true,
    trophy_notifications: true,
    metal_hud: false,
    renderer: "metal",
    online: false,
    online_pool: "seamless",
    online_server: "play.seamlesshunt.com:31313",
    online_webapi: "http://play.seamlesshunt.com:31315",
    online_community: "http://play.seamlesshunt.com",
    online_npid: "",
    online_save_password: false,
    online_upnp: true,
    thd_server: "https://thehuntersdream.com",
    thd_online_id: "",
    thd_token: "",
    check_updates: true,
    crash_diag: false,
    gpu_profile: false,
    extra_env: "",
    // ?lang=en sets the launcher language in the browser preview (screenshots).
    ui_language: new URLSearchParams(window.location.search).get("lang") ?? "",
  },
  ini: { upscaler: "fsr3", preset: "2", sharpen: "1", sharpness: "0.50", object_motion: "0", show_fps: "1", output_res: "1920x1080", aspect_ratio: "16:9" },
  paths: {
    data: "~/Library/Application Support/bloodborne_mac",
    mods: "~/Library/Application Support/bloodborne_mac/mods",
    patches: "~/Library/Application Support/bloodborne_mac/patches",
    logs: "~/Library/Application Support/bloodborne_mac/logs",
    saves: "~/Library/Application Support/bloodborne_mac/user",
  },
  bundled: false,
  version: "0.8.0",
  platform: "macos",
  memory_mb: 18432,
  running: false,
  online_password_saved: false,
};

let mods: Mod[] = [
  { name: "HD Textures", enabled: true },
  { name: "Lady Maria Outfit", enabled: true },
  { name: "Reshade-like Colors", enabled: false },
];

let patches: Patch[] = [
  { key: "Bloodborne.xml/No Motion Blur", name: "No Motion Blur", file: "Bloodborne.xml", author: "Kyo", note: "", default: false, enabled: true },
  {
    key: "Bloodborne.xml/Disable Chromatic Aberration",
    name: "Disable Chromatic Aberration",
    file: "Bloodborne.xml",
    author: "Lance McDonald",
    note: "Removes the colour fringing at the edges of the screen.",
    default: true,
    enabled: true,
  },
];

let fsr411Files = false;
const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 120));

let nextProfile = 0;
let nextBackup = 0;
// ?profile=Name starts the preview with that profile already set up (screenshots).
const previewProfile = new URLSearchParams(window.location.search).get("profile");
let profileSetup = previewProfile !== null;
const saves: SaveList = { active: "original", profiles: [{ id: "original", name: previewProfile ?? "", path: config.paths.saves, bytes: new URLSearchParams(window.location.search).has("fresh") ? 0 : 12582912, modified: 1720000000, backups: [], trophies_eligible: true, trophy_unlocks: [], trophy_error: null }] };
// Placeholder names: the real ones come from the player's game files (no game text here).
const previewInventory: Inventory = { title_id: "CUSA03173", slot: 0, fingerprint: "inventory-0", entries: [
  { location: "inventory", index: 1, kind: "item", id: 1000, amount: 17, name: "Sample item", description: "A sample item for the preview.", level: 0, imprint: 0, levels: [], imprints: [], imprint_names: [] },
  { location: "inventory", index: 2, kind: "item", id: 1230, amount: 18, name: "Sample ammunition", description: null, level: 0, imprint: 0, levels: [], imprints: [], imprint_names: [] },
  { location: "inventory", index: 3, kind: "weapon", id: 7000200, amount: 1, name: "Sample weapon", description: null, level: 2, imprint: 0, levels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], imprints: [0, 1, 2], imprint_names: ["Sample weapon", "Sample weapon (variant 1)", "Sample weapon (variant 2)"] },
  { location: "inventory", index: 4, kind: "armor", id: 230000, amount: 1, name: "Sample hood", description: null, level: 0, imprint: 0, levels: [], imprints: [], imprint_names: [] },
  { location: "storage", index: 1, kind: "item", id: 1200, amount: 4, name: "Sample stored item", description: null, level: 0, imprint: 0, levels: [], imprints: [], imprint_names: [] },
] };
let previewCharacter: Character = { title_id: "CUSA03173", slot: 0, name: "Hunter", level: 17, vitality: 12, endurance: 11, strength: 22,
  skill: 9, bloodtinge: 6, arcane: 7, echoes: 12140, insight: 3, playtime_ms: 4_800_000,
  new_game_cycle: 0, stats_consistent: true, fingerprint: "preview" };

export const mockApi = {
  setTrayLabels: () => wait(undefined),
  listProfiles: (): Promise<ProfileList> => wait({ ...structuredClone(saves), setup_required: !profileSetup, has_existing_saves: saves.profiles.some((p) => p.bytes > 0), profiles: profileSetup ? structuredClone(saves.profiles) : [] }),
  changeProfile: (change: ProfileChange) => {
    const profile = saves.profiles.find((p) => p.id === change.id);
    if (change.action === "initialize") {
      if (profileSetup) return Promise.reject("Profile setup is already complete.");
      saves.profiles[0].name = change.name ?? "";
      profileSetup = true;
    } else if (!profileSetup) return Promise.reject("Create your first profile.");
    else if (change.action === "select" && profile) {
      saves.active = profile.id; config.paths.saves = profile.path;
    } else if (change.action === "rename" && profile) profile.name = change.name ?? "";
    else if (change.action === "delete") {
      if (!profile || saves.active === change.id) return Promise.reject("Switch to another profile before deleting this one.");
      saves.profiles.splice(saves.profiles.indexOf(profile), 1);
    }
    else if (change.action === "create") {
      if (saves.profiles.some((p) => p.name.toLowerCase() === change.name?.trim().toLowerCase())) return Promise.reject("A profile with this name already exists.");
      const id = `p-${++nextProfile}`;
      saves.profiles.push({ id, name: change.name ?? "", path: `${config.paths.data}/save-profiles/${id}/user`, bytes: 0, modified: null, backups: [], trophies_eligible: true, trophy_unlocks: [], trophy_error: null });
    }
    return wait(undefined);
  },
  listSaves: (id?: string) => wait({ active: saves.active, profiles: structuredClone(saves.profiles.filter((p) => p.id === (id ?? saves.active))) }),
  listCharacters: (id: string) => wait<Character[]>(saves.profiles.some((p) => p.id === id && p.bytes > 0) ? [structuredClone(previewCharacter)] : []),
  editCharacter: (id: string, edit: CharacterEdit) => {
    const profile = saves.profiles.find((p) => p.id === id);
    if (!profile || edit.fingerprint !== previewCharacter.fingerprint) return Promise.reject("Character changed. Refresh the preview.");
    profile.backups.unshift({ id: `b-${++nextBackup}`, created: Math.floor(Date.now() / 1000), bytes: profile.bytes });
    profile.trophies_eligible = false;
    const level = edit.vitality + edit.endurance
      + edit.strength + edit.skill + edit.bloodtinge + edit.arcane - 50;
    previewCharacter = { ...previewCharacter, ...edit, level, fingerprint: `preview-${nextBackup}` };
    return wait(undefined);
  },
  characterInventory: (id: string) => saves.profiles.some((p) => p.id === id && p.bytes > 0)
    ? wait(structuredClone(previewInventory)) : Promise.reject("The character slot is empty."),
  editInventory: (id: string, edit: InventoryEdit) => {
    const profile = saves.profiles.find((p) => p.id === id);
    if (!profile || edit.fingerprint !== previewInventory.fingerprint) return Promise.reject("The character changed since it was opened. Refresh the inventory.");
    profile.backups.unshift({ id: `b-${++nextBackup}`, created: Math.floor(Date.now() / 1000), bytes: profile.bytes });
    profile.trophies_eligible = false;
    for (const change of edit.changes) {
      const entry = previewInventory.entries.find((e) => e.location === change.location && e.index === change.index);
      if (!entry) continue;
      if (change.type === "amount") entry.amount = change.amount;
      else { entry.level = change.level; entry.imprint = change.imprint; }
    }
    previewInventory.fingerprint = `inventory-${nextBackup}`;
    return wait(undefined);
  },
  changeSave: (change: SaveChange) => {
    const profile = saves.profiles.find((p) => p.id === change.id);
    if (!profile) return Promise.reject("Unknown profile.");
    if (change.action === "backup") {
      profile.backups.unshift({ id: `b-${++nextBackup}`, created: Math.floor(Date.now() / 1000), bytes: profile.bytes });
    } else if (change.action === "restore") {
      const backup = profile.backups.find((b) => b.id === change.backup);
      if (backup) {
        profile.backups.unshift({ id: `b-${++nextBackup}`, created: Math.floor(Date.now() / 1000), bytes: profile.bytes });
        profile.bytes = backup.bytes;
      }
    }
    return wait(undefined);
  },
  checkRelease: () => wait(new URLSearchParams(window.location.search).has("update")
    ? { version: "0.8.1", tag: "v0.8.1", newer: true, notes: new URLSearchParams(window.location.search).has("empty-notes") ? "" : "## What’s new\n\n- Improved opening-video playback.\n- Profile and save management in the launcher.\n\nRead the **release notes** before installing. [GitHub](https://github.com)\n\n<script>window.untrustedReleaseScript = true</script>\n![Remote image](https://example.com/image.png)" }
    : { version: "0.8.0", tag: "v0.8.0", newer: false, notes: "" }),
  openRelease: (_tag: string) => wait(undefined),
  loadConfig: () => wait(structuredClone(config)),
  saveSettings: (settings: Partial<Settings>) => wait(void (Object.assign(config.settings, settings),
    config.settings.online_save_password || (config.online_password_saved = false))),
  saveIni: (values: Record<string, string | null>) =>
    wait(
      void Object.entries(values).forEach(([k, v]) => {
        if (v === null) delete config.ini[k];
        else config.ini[k] = v;
      }),
    ),
  checkGame: (dir: string): Promise<GameCheck> =>
    wait(
      dir
        ? { problem: null, game: { title_id: "CUSA03173", title: "Bloodborne™", version: "01.09", region: "europe", old_hunters: true } }
        : { problem: "Choose the game folder.", game: null },
    ),
  listMods: () => wait({ mods, dir: config.paths.mods }),
  saveMods: (order: string[], disabled: string[]) =>
    wait(void (mods = order.map((name) => ({ name, enabled: !disabled.includes(name) })))),
  listPatches: () => wait({ patches, dir: config.paths.patches }),
  savePatches: (_shown: string[], enabled: string[], disabled: string[]) =>
    wait(
      void (patches = patches.map((p) => ({
        ...p,
        enabled: enabled.includes(p.key) || (p.default && !disabled.includes(p.key)),
      }))),
    ),
  listGamepads: () => wait<Gamepad[]>([{ guid: "030000004c050000e60c000000016800", name: "DualSense Wireless Controller" }]),
  listDisplays: () =>
    wait<Display[]>([
      { name: "Built-in Retina Display", size: "1728x1117", primary: true },
      { name: "LG UltraFine", size: "2560x1440", primary: false },
    ]),
  fsr411Support: () => wait<Fsr411Support>({ supported: fsr411Files, reason: fsr411Files ? "" : "AMD's FSR 4.1.1 initializers.bin is missing" }),
  addFsr411Files: (_dll: string) => wait(void (fsr411Files = true)),
  readInput: (kind: "key" | "pad") => wait(kind === "pad" ? "rightshoulder" : "G"),
  openLauncherData: () => wait(undefined),
  openPath: () => wait(undefined),
  launch: (_password?: string) => wait(undefined),
  saveOnlinePassword: (password: string) => wait(void (config.online_password_saved = password !== "")),
  stop: () => wait(undefined),
  onOutput: (_handler: (line: string) => void) => Promise.resolve(() => {}),
  onState: (_handler: (state: GameState) => void) => Promise.resolve(() => {}),
};
