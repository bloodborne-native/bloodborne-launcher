// The PS4 pad's inputs (src/runtime_pad.c): bbport.ini "key.<id>=" and "pad.<id>=" replace a
// default binding; without a line the default applies. pad: null = keyboard only. Labels:
// i18n controls.inputs.<id>, groups controls.groups.<group>.
export type ControlGroup = "Face buttons" | "Shoulders and sticks" | "System" | "D-pad" | "Movement and camera";

export type Control = {
  id: string;
  label: string;
  glyph?: string;
  key: string;
  pad: string | null;
  group: ControlGroup;
};

export const CONTROL_GROUPS: ControlGroup[] = ["Face buttons", "Shoulders and sticks", "System", "D-pad", "Movement and camera"];

export const CONTROLS: Control[] = [
  // Defaults as the runtime's (src/runtime_pad.c bind_defaults: Dark Souls III's PC layout, from
  // bbport 0.6). Several keys: comma-separated; a chord: "Left Shift+Mouse Left".
  { id: "cross", label: "Cross", glyph: "✕", key: "F, Return", pad: "a", group: "Face buttons" },
  { id: "circle", label: "Circle", glyph: "○", key: "", pad: "b", group: "Face buttons" },
  { id: "square", label: "Square", glyph: "□", key: "Tab, R", pad: "x", group: "Face buttons" },
  { id: "triangle", label: "Triangle", glyph: "△", key: "Q", pad: "y", group: "Face buttons" },
  { id: "l1", label: "L1", key: "E, Mouse X2", pad: "leftshoulder", group: "Shoulders and sticks" },
  { id: "r1", label: "R1", key: "Mouse Left", pad: "rightshoulder", group: "Shoulders and sticks" },
  { id: "l2", label: "L2", key: "Mouse Right", pad: "lefttrigger", group: "Shoulders and sticks" },
  { id: "r2", label: "R2", key: "Left Shift+Mouse Left, Mouse X1", pad: "righttrigger", group: "Shoulders and sticks" },
  { id: "l3", label: "L3", key: "Left Ctrl", pad: "leftstick", group: "Shoulders and sticks" },
  { id: "r3", label: "R3", key: "C, Mouse Middle", pad: "rightstick", group: "Shoulders and sticks" },
  { id: "options", label: "Options", key: "Escape", pad: "start", group: "System" },
  { id: "touchpad", label: "Touchpad (left half)", key: "G", pad: "back, touchpad", group: "System" },
  { id: "touchpad_right", label: "Touchpad (right half)", key: "Backspace", pad: "", group: "System" },
  // Keyboard only, on a new press with Command already held (app issue #20). Not assignable as a
  // Command chord here: the launcher's own window would take Command+Q as its Quit.
  { id: "quit", label: "Quit the game", key: "Left GUI+Q, Right GUI+Q", pad: null, group: "System" },
  { id: "up", label: "D-pad up", key: "3, Up, Wheel Up", pad: "dpup", group: "D-pad" },
  { id: "down", label: "D-pad down", key: "4, Down, Wheel Down", pad: "dpdown", group: "D-pad" },
  { id: "left", label: "D-pad left", key: "1, Left", pad: "dpleft", group: "D-pad" },
  { id: "right", label: "D-pad right", key: "2, Right", pad: "dpright", group: "D-pad" },
  { id: "move_up", label: "Move forward", key: "W", pad: null, group: "Movement and camera" },
  { id: "move_down", label: "Move back", key: "S", pad: null, group: "Movement and camera" },
  { id: "move_left", label: "Move left", key: "A", pad: null, group: "Movement and camera" },
  { id: "move_right", label: "Move right", key: "D", pad: null, group: "Movement and camera" },
  { id: "sprint", label: "Run", key: "Left Shift", pad: null, group: "Movement and camera" },
  { id: "dodge", label: "Dodge", key: "Space", pad: null, group: "Movement and camera" },
  { id: "walk", label: "Walk (hold)", key: "Left Alt", pad: null, group: "Movement and camera" },
  { id: "look_up", label: "Camera up", key: "I", pad: null, group: "Movement and camera" },
  { id: "look_down", label: "Camera down", key: "K", pad: null, group: "Movement and camera" },
  { id: "look_left", label: "Camera left", key: "J", pad: null, group: "Movement and camera" },
  { id: "look_right", label: "Camera right", key: "L", pad: null, group: "Movement and camera" },
];

/** SDL gamepad button names, as PlayStation / Xbox labels. */
const PAD_NAMES: Record<string, string> = {
  a: "✕ / A",
  b: "○ / B",
  x: "□ / X",
  y: "△ / Y",
  leftshoulder: "L1 / LB",
  rightshoulder: "R1 / RB",
  lefttrigger: "L2 / LT",
  righttrigger: "R2 / RT",
  leftstick: "L3",
  rightstick: "R3",
  start: "Options / Menu",
  back: "Share / View",
  touchpad: "Touchpad",
  guide: "PS / Home",
  dpup: "D-pad ↑",
  dpdown: "D-pad ↓",
  dpleft: "D-pad ←",
  dpright: "D-pad →",
  misc1: "Mute / Share",
};

/** A gamepad binding ("back, touchpad") as button labels; `or` joins alternatives. */
export function padLabel(binding: string, or: string): string {
  return binding
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => PAD_NAMES[b] ?? b)
    .join(` ${or} `);
}
