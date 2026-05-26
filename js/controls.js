import { keyCode } from "./keycodes.js";

// Touch input layer. Translates on-screen gestures into js-dos key/mouse events.
// Uses Pointer Events so multiple buttons can be held at once (move + action).
export class TouchControls {
  constructor(ci, { stage, canvas, padHost, keyboardHost }) {
    this.ci = ci;
    this.stage = stage;
    this.canvas = canvas;
    this.padHost = padHost;
    this.keyboardHost = keyboardHost;
    this._held = new Set();           // currently-pressed KBD codes
    this._dpadDirs = new Set();       // active D-pad directions
    this._mouseHandlers = null;
  }

  // ---- key helpers ---------------------------------------------------------
  pressKey(name) {
    const code = keyCode(name);
    if (!code || this._held.has(code)) return;
    this._held.add(code);
    this.ci.sendKeyEvent(code, true);
  }

  releaseKey(name) {
    const code = keyCode(name);
    if (!code || !this._held.has(code)) return;
    this._held.delete(code);
    this.ci.sendKeyEvent(code, false);
  }

  releaseAll() {
    for (const code of this._held) this.ci.sendKeyEvent(code, false);
    this._held.clear();
    this._dpadDirs.clear();
  }

  // ---- build the per-game overlay -----------------------------------------
  render(controls = {}) {
    this.controls = controls;
    this.padHost.innerHTML = "";
    this.teardownMouse();

    if (controls.mode === "mouse") {
      this.padHost.setAttribute("aria-hidden", "true");
      this.setupMouse();
      return;
    }

    this.padHost.removeAttribute("aria-hidden");
    if (controls.dpad) this._buildDpad(controls.dpad, controls.diagonals);
    if (controls.buttons?.length) this._buildButtons(controls.buttons);
    this._buildKeyboard();
  }

  // ---- D-pad ---------------------------------------------------------------
  _buildDpad(dpad, allowDiagonals) {
    const keys = dpad.keys || { up: "up", down: "down", left: "left", right: "right" };
    const pad = document.createElement("div");
    pad.className = "dpad";
    pad.innerHTML = `
      <span class="dpad-arrow up">▲</span>
      <span class="dpad-arrow down">▼</span>
      <span class="dpad-arrow left">◀</span>
      <span class="dpad-arrow right">▶</span>
      <span class="dpad-center"></span>`;
    this.padHost.appendChild(pad);

    const deadzone = 0.28;            // fraction of half-size before a direction fires
    const update = (clientX, clientY) => {
      const r = pad.getBoundingClientRect();
      const nx = (clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (clientY - (r.top + r.height / 2)) / (r.height / 2);
      const want = new Set();
      if (allowDiagonals) {
        if (ny < -deadzone) want.add("up");
        if (ny > deadzone) want.add("down");
        if (nx < -deadzone) want.add("left");
        if (nx > deadzone) want.add("right");
      } else {
        // pick the single dominant axis
        if (Math.abs(nx) > Math.abs(ny)) {
          if (nx < -deadzone) want.add("left"); else if (nx > deadzone) want.add("right");
        } else {
          if (ny < -deadzone) want.add("up"); else if (ny > deadzone) want.add("down");
        }
      }
      for (const dir of ["up", "down", "left", "right"]) {
        const active = want.has(dir);
        const wasActive = this._dpadDirs.has(dir);
        if (active && !wasActive) { this._dpadDirs.add(dir); this.pressKey(keys[dir]); }
        if (!active && wasActive) { this._dpadDirs.delete(dir); this.releaseKey(keys[dir]); }
        pad.querySelector(`.${dir}`).classList.toggle("on", active);
      }
    };
    const clear = () => {
      for (const dir of [...this._dpadDirs]) { this.releaseKey(keys[dir]); }
      this._dpadDirs.clear();
      pad.querySelectorAll(".dpad-arrow").forEach((a) => a.classList.remove("on"));
    };

    let activeId = null;
    pad.addEventListener("pointerdown", (e) => {
      activeId = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      update(e.clientX, e.clientY);
      e.preventDefault();
    });
    pad.addEventListener("pointermove", (e) => {
      if (e.pointerId === activeId) update(e.clientX, e.clientY);
    });
    const end = (e) => { if (e.pointerId === activeId) { activeId = null; clear(); } };
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);
  }

  // ---- action buttons ------------------------------------------------------
  _buildButtons(buttons) {
    const group = document.createElement("div");
    group.className = "buttons";
    for (const b of buttons) {
      const el = document.createElement("button");
      el.className = "action-btn";
      el.textContent = b.label ?? b.key;
      this._bindMomentary(el, b.key);
      group.appendChild(el);
    }
    this.padHost.appendChild(group);
  }

  // press on touch-down, release on touch-up — held keys stay down (multi-touch)
  _bindMomentary(el, key) {
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      el.classList.add("on");
      this.pressKey(key);
      e.preventDefault();
    });
    const up = (e) => {
      el.classList.remove("on");
      this.releaseKey(key);
      e.preventDefault();
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  // ---- on-screen keyboard (toggle) ----------------------------------------
  _buildKeyboard() {
    const host = this.keyboardHost;
    host.innerHTML = "";
    const layout = [
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l", "enter"],
      ["z", "x", "c", "v", "b", "n", "m", "backspace"],
      ["esc", "shift", "ctrl", "alt", "space", "up", "down", "left", "right"],
    ];
    for (const row of layout) {
      const r = document.createElement("div");
      r.className = "kbd-row";
      for (const key of row) {
        const el = document.createElement("button");
        el.className = "kbd-key";
        if (key.length > 1) el.classList.add("wide");
        el.textContent = key === "space" ? "␣" : key;
        this._bindMomentary(el, key);
        r.appendChild(el);
      }
      host.appendChild(r);
    }
  }

  toggleKeyboard(show) {
    this.keyboardHost.hidden = !show;
  }

  // ---- touch-mouse mode (point & click) -----------------------------------
  setupMouse() {
    const send = (clientX, clientY) => {
      const r = this.canvas.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
      this.ci.sendMouseMotion(x, y);
      this.ci.sendMouseSync?.();
    };
    let down = false;
    const onDown = (e) => {
      down = true;
      this.stage.setPointerCapture?.(e.pointerId);
      send(e.clientX, e.clientY);
      this.ci.sendMouseButton(0, true);
      e.preventDefault();
    };
    const onMove = (e) => { if (down) { send(e.clientX, e.clientY); e.preventDefault(); } };
    const onUp = (e) => {
      if (!down) return;
      down = false;
      send(e.clientX, e.clientY);
      this.ci.sendMouseButton(0, false);
      e.preventDefault();
    };
    this.stage.addEventListener("pointerdown", onDown);
    this.stage.addEventListener("pointermove", onMove);
    this.stage.addEventListener("pointerup", onUp);
    this.stage.addEventListener("pointercancel", onUp);
    this._mouseHandlers = { onDown, onMove, onUp };
  }

  teardownMouse() {
    if (!this._mouseHandlers) return;
    const { onDown, onMove, onUp } = this._mouseHandlers;
    this.stage.removeEventListener("pointerdown", onDown);
    this.stage.removeEventListener("pointermove", onMove);
    this.stage.removeEventListener("pointerup", onUp);
    this.stage.removeEventListener("pointercancel", onUp);
    this._mouseHandlers = null;
  }

  destroy() {
    this.releaseAll();
    this.teardownMouse();
    this.padHost.innerHTML = "";
    this.keyboardHost.innerHTML = "";
  }
}
