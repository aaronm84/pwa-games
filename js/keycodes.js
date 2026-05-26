// DOSBox KBD_* key codes used by js-dos CommandInterface.sendKeyEvent(code, pressed).
// These are the emulator's own enum values (NOT browser keyCodes).
export const KBD = {
  none: 0,
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 0: 10,
  q: 11, w: 12, e: 13, r: 14, t: 15, y: 16, u: 17, i: 18, o: 19, p: 20,
  a: 21, s: 22, d: 23, f: 24, g: 25, h: 26, j: 27, k: 28, l: 29,
  z: 30, x: 31, c: 32, v: 33, b: 34, n: 35, m: 36,
  f1: 37, f2: 38, f3: 39, f4: 40, f5: 41, f6: 42, f7: 43, f8: 44, f9: 45, f10: 46, f11: 47, f12: 48,
  esc: 49, tab: 50, backspace: 51, enter: 52, space: 53,
  leftalt: 54, rightalt: 55, leftctrl: 56, rightctrl: 57, leftshift: 58, rightshift: 59,
  capslock: 60, scrolllock: 61, numlock: 62,
  grave: 63, minus: 64, equals: 65, backslash: 66, leftbracket: 67, rightbracket: 68,
  semicolon: 69, quote: 70, period: 71, comma: 72, slash: 73, extra_lt_gt: 74,
  printscreen: 75, pause: 76,
  insert: 77, home: 78, pageup: 79, delete: 80, end: 81, pagedown: 82,
  up: 83, left: 84, down: 85, right: 86,
  kp1: 87, kp2: 88, kp3: 89, kp4: 90, kp5: 91, kp6: 92, kp7: 93, kp8: 94, kp9: 95, kp0: 96,
  kpdivide: 97, kpmultiply: 98, kpminus: 99, kpplus: 100, kpenter: 101, kpperiod: 102,
};

// Friendly aliases so game configs can say "ctrl" instead of "leftctrl", etc.
const ALIAS = {
  ctrl: "leftctrl", control: "leftctrl",
  alt: "leftalt", option: "leftalt",
  shift: "leftshift",
  return: "enter", escape: "esc", del: "delete", ins: "insert",
  pgup: "pageup", pgdn: "pagedown",
  spacebar: "space", " ": "space",
};

// Resolve a friendly key name (e.g. "space", "ctrl", "a", "1", "up") to a KBD code.
export function keyCode(name) {
  if (typeof name === "number") return name;
  const key = String(name).toLowerCase();
  const resolved = ALIAS[key] || key;
  const code = KBD[resolved];
  if (code === undefined) {
    console.warn(`[keycodes] unknown key "${name}" — ignored`);
    return KBD.none;
  }
  return code;
}
