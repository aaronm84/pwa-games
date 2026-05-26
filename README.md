# MyOldGames

A small **Progressive Web App** for playing old DOS and Windows 3.x games on an
iPad (or any device). Built for personal use — add it to the home screen and it
launches full-screen like a native app, with on-screen touch controls tuned for
each game.

It runs the games entirely in the browser using [js-dos](https://js-dos.com/)
(DOSBox compiled to WebAssembly). No game data is included — you add your own.

## Features

- **Installable PWA** — "Add to Home Screen" on iPad for a full-screen, offline-capable app.
- **Multiple titles** — a simple library; add a game with one config entry + a file.
- **Touch input, per game:**
  - **Mouse mode** for point-and-click games (drag to move, tap to click).
  - **D-pad + action buttons** for keyboard games, multi-touch (move *and* act at once), with optional diagonals.
  - **On-screen keyboard** for text entry.
- **Offline** — the app shell and (after first run) the emulator + game files are cached.

## Run it

It's all static files. Locally:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

For iPad install you need **HTTPS** — deploy to GitHub Pages (Settings → Pages →
deploy from branch). The app uses relative paths, so it works at a project
subpath like `https://<user>.github.io/<repo>/`.

> Note: on a `file://` path or plain HTTP the emulator may load but the PWA
> won't install. Use the local server above or GitHub Pages.

## Add a game

See [`games/README.md`](games/README.md). In short: build a `.jsdos` bundle,
drop it in `games/<id>/`, and add an entry to [`js/catalog.js`](js/catalog.js).

## How it's wired

| File | Role |
|------|------|
| `index.html` | App shell + js-dos runtime `<script>` |
| `js/config.js` | Emulator source (CDN by default; switch to `vendor/jsdos/` for offline) |
| `js/catalog.js` | The list of games + their touch-control layouts |
| `js/player.js` | Loads a bundle, exposes the js-dos CommandInterface |
| `js/controls.js` | Touch → key/mouse translation (D-pad, buttons, keyboard, mouse) |
| `js/keycodes.js` | Friendly key names → DOSBox key codes |
| `sw.js` | Service worker (offline caching) |

## Legal

Use only games you own or that are freely distributable. This repository
contains no copyrighted game data.
