/** SDL's scancode names (SDL_GetScancodeName, which the runtime's key.* lines take back through
 *  SDL_GetScancodeFromName) for the DOM's KeyboardEvent.code, both named after the physical key. */
const NAMED: Record<string, string> = {
  Enter: "Return", Escape: "Escape", Backspace: "Backspace", Tab: "Tab", Space: "Space",
  Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";",
  Quote: "'", Backquote: "`", Comma: ",", Period: ".", Slash: "/", IntlBackslash: "NonUSBackslash",
  CapsLock: "CapsLock", PrintScreen: "PrintScreen", ScrollLock: "ScrollLock", Pause: "Pause",
  Insert: "Insert", Home: "Home", PageUp: "PageUp", Delete: "Delete", End: "End", PageDown: "PageDown",
  ArrowRight: "Right", ArrowLeft: "Left", ArrowDown: "Down", ArrowUp: "Up", NumLock: "Numlock",
  NumpadDivide: "Keypad /", NumpadMultiply: "Keypad *", NumpadSubtract: "Keypad -", NumpadAdd: "Keypad +",
  NumpadEnter: "Keypad Enter", NumpadDecimal: "Keypad .", NumpadEqual: "Keypad =", ContextMenu: "Application",
  ControlLeft: "Left Ctrl", ShiftLeft: "Left Shift", AltLeft: "Left Alt", MetaLeft: "Left GUI",
  ControlRight: "Right Ctrl", ShiftRight: "Right Shift", AltRight: "Right Alt", MetaRight: "Right GUI",
};

/** The modifiers that start a chord ("Left Shift+G") instead of binding at once. */
export const CHORD_MODIFIERS = new Set(["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight"]);

/** The runtime's name for a key, or null for keys SDL does not name. */
export function keyName(code: string): string | null {
  if (code in NAMED) return NAMED[code];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^Digit([0-9])$/.exec(code);
  if (m) return m[1];
  m = /^Numpad([0-9])$/.exec(code);
  if (m) return `Keypad ${m[1]}`;
  m = /^F([0-9]{1,2})$/.exec(code);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 24) return code;
  return null;
}
