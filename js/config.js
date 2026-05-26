// Central config. Edit JSDOS_BASE to self-host the emulator for full offline use.
//
// Default = js-dos v7 public CDN (works online immediately; the service worker
// caches it after the first run so it also works offline afterwards).
//
// For guaranteed offline play on iPads, download the js-dos v7 runtime into
// ./vendor/jsdos/ (see games/README.md) and set:
//   export const JSDOS_BASE = "vendor/jsdos/";
export const JSDOS_BASE = "https://v7.js-dos.com/latest/";

// Derived: where the wasm/worker live. js-dos expects a trailing slash.
export const JSDOS_EMULATORS = JSDOS_BASE + "emulators/";
