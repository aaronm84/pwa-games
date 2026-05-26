import { CATALOG } from "./catalog.js";
import { Player } from "./player.js";
import { TouchControls } from "./controls.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  body: document.body,
  library: $("#library"),
  player: $("#player"),
  canvas: $("#screen"),
  stage: $("#stage"),
  pad: $("#touch-controls"),
  keyboard: $("#virtual-keyboard"),
  loading: $("#loading"),
  loadingText: $("#loading-text"),
  title: $("#player-title"),
  btnExit: $("#btn-exit"),
  btnKeyboard: $("#btn-keyboard"),
  btnFullscreen: $("#btn-fullscreen"),
  installHint: $("#install-hint"),
};

let player = null;
let controls = null;

// ---- library ---------------------------------------------------------------
function renderLibrary() {
  els.library.innerHTML = "";
  for (const game of CATALOG) {
    const card = document.createElement("button");
    card.className = "game-card";
    card.innerHTML = `
      <span class="cover" style="${game.cover ? `background-image:url('${game.cover}')` : ""}">
        ${game.cover ? "" : `<span class="cover-fallback">${escapeHtml(game.title)}</span>`}
      </span>
      <span class="game-title">${escapeHtml(game.title)}</span>
      ${game.year ? `<span class="game-year">${escapeHtml(game.year)}</span>` : ""}`;
    card.addEventListener("click", () => launch(game));
    els.library.appendChild(card);
  }
}

// ---- launch / exit ---------------------------------------------------------
async function launch(game) {
  els.title.textContent = game.title;
  els.body.classList.replace("view-home", "view-player");
  els.player.setAttribute("aria-hidden", "false");
  showLoading(`Loading ${game.title}…`);

  // the on-screen keyboard toggle only applies to keyboard (D-pad) games
  const isMouse = game.controls?.mode === "mouse";
  els.btnKeyboard.hidden = isMouse;
  setPressed(els.btnKeyboard, false);
  els.keyboard.hidden = true;

  player = new Player(els.canvas);
  try {
    const ci = await player.load(game.bundle);
    controls = new TouchControls(ci, {
      stage: els.stage,
      canvas: els.canvas,
      padHost: els.pad,
      keyboardHost: els.keyboard,
    });
    controls.render(game.controls || {});
    hideLoading();
  } catch (err) {
    showError(err);
  }
}

function exitGame() {
  controls?.destroy();
  player?.stop();
  controls = null;
  player = null;
  els.body.classList.replace("view-player", "view-home");
  els.player.setAttribute("aria-hidden", "true");
  els.keyboard.hidden = true;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  }
}

// ---- loading / error UI ----------------------------------------------------
function showLoading(text) {
  els.loadingText.textContent = text;
  els.loading.hidden = false;
  els.loading.classList.remove("error");
}
function hideLoading() { els.loading.hidden = true; }
function showError(err) {
  console.error(err);
  els.loading.classList.add("error");
  els.loadingText.textContent = String(err.message || err) +
    "\n\nIf you haven't added this game's file yet, see games/README.md.";
  els.loading.hidden = false;
}

// ---- top bar ---------------------------------------------------------------
els.btnExit.addEventListener("click", exitGame);
els.btnKeyboard.addEventListener("click", () => {
  const show = els.keyboard.hidden;
  controls?.toggleKeyboard(show);
  setPressed(els.btnKeyboard, show);
});
els.btnFullscreen.addEventListener("click", () => {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  else (els.player.requestFullscreen || els.player.webkitRequestFullscreen)?.call(els.player);
});

// ---- helpers ---------------------------------------------------------------
function setPressed(btn, on) { btn.setAttribute("aria-pressed", String(on)); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// show the iOS "add to home screen" hint when running in a browser tab
function maybeShowInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
  if (isIOS && !standalone) els.installHint.hidden = false;
}

// ---- service worker --------------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW failed", e));
  });
}

renderLibrary();
maybeShowInstallHint();
