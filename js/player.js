import { JSDOS_EMULATORS } from "./config.js";

// Thin wrapper around the js-dos v7 runtime. Owns the canvas + CommandInterface.
export class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.dos = null;
    this.ci = null;
  }

  async load(bundleUrl) {
    if (!window.Dos || !window.emulators) {
      throw new Error("js-dos runtime not loaded (check network / JSDOS_BASE).");
    }
    // Confirm the bundle exists before booting the emulator, so a missing file
    // gives a clear message instead of an opaque emulator error. This GET is
    // served from cache by the service worker, so it doesn't double-download
    // once the app is installed.
    const probe = await fetch(bundleUrl, { method: "GET" });
    if (!probe.ok) {
      throw new Error(`Game file not found: ${bundleUrl}`);
    }

    window.emulators.pathPrefix = JSDOS_EMULATORS;
    this.dos = window.Dos(this.canvas);
    this.ci = await this.dos.run(bundleUrl);
    return this.ci;
  }

  stop() {
    try {
      this.ci?.exit?.();
    } catch (_) { /* ignore */ }
    try {
      this.dos?.stop?.();
    } catch (_) { /* ignore */ }
    this.ci = null;
    this.dos = null;
  }
}
