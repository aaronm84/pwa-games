# Adding games

Each game is a **`.jsdos` bundle** (just a ZIP file) plus one entry in
[`js/catalog.js`](../js/catalog.js). Nothing else needs to change.

> ⚖️ **Note:** only add games you own or that are freely distributable. This
> project ships no game data — you supply your own files. The bundled
> `sample/` is a tiny DOS config written from scratch (no copyrighted content)
> just to prove the emulator works.

---

## 1. Build a `.jsdos` bundle

A bundle is a ZIP containing a `.jsdos/dosbox.conf` file at its root, plus the
game's files. Minimal layout:

```
mygame.jsdos  (a zip)
├── .jsdos/
│   └── dosbox.conf        # how to mount + launch the game
├── GAME.EXE
└── ...other game files
```

Example `dosbox.conf` for a simple DOS game:

```ini
[autoexec]
mount c .
c:
GAME.EXE
exit
```

Zip it up (note the leading `.jsdos` folder must be included):

```bash
cd mygame_folder
zip -r ../mygame.jsdos .jsdos GAME.EXE
```

> The easiest way to build/test bundles is the **DOS Zone Studio**
> (https://dos.zone/studio/) — drop your files in, configure the launch
> command, and export a `.jsdos` you can drop straight into a folder here.

Put the result at `games/<id>/<id>.jsdos`.

---

## 2. Windows 3.x games (e.g. *I Can Be an Animal Doctor*)

These don't run directly — they need Windows 3.1 running **inside** DOSBox.
Two common approaches:

1. **Pre-built Win 3.1 bundle (easiest):** start from a `.jsdos` that already
   has Windows 3.1 installed, copy the game's files into its `C:` drive, and
   set the `autoexec` to launch `WIN` then the game. DOS Zone Studio has Win 3.1
   templates for exactly this.
2. **Install yourself:** mount Win 3.1 setup disks in DOSBox, install, then add
   the game.

Either way the game ends up point-and-click, so in the catalog use
`controls: { mode: "mouse" }` (already set for `animal-doctor`).

When ready, save it as `games/animal-doctor/animal-doctor.jsdos`.

---

## 3. Register it in the catalog

Add an entry to `js/catalog.js`:

```js
{
  id: "animal-doctor",
  title: "I Can Be an Animal Doctor",
  year: "1995",
  bundle: "games/animal-doctor/animal-doctor.jsdos",
  cover: "games/animal-doctor/cover.svg",
  controls: { mode: "mouse" },   // point-and-click
}
```

For keyboard games use a D-pad layout instead:

```js
controls: {
  mode: "dpad",
  dpad: { keys: { up: "up", down: "down", left: "left", right: "right" } },
  diagonals: true,
  buttons: [
    { label: "Jump", key: "space" },
    { label: "Fire", key: "ctrl" },
  ],
}
```

Key names you can use: letters `a`–`z`, digits `0`–`9`, `up/down/left/right`,
`space`, `enter`, `esc`, `tab`, `shift`, `ctrl`, `alt`, `f1`–`f12`, and more
(see [`js/keycodes.js`](../js/keycodes.js)).

---

## 4. Offline use (optional but recommended for iPads)

By default the emulator runtime loads from the js-dos CDN and is cached after
the first run. For guaranteed offline play, self-host it:

1. Download the js-dos **v7** runtime (`js-dos.js`, `js-dos.css`, and the whole
   `emulators/` folder) from https://v7.js-dos.com/latest/ into `vendor/jsdos/`.
2. In `js/config.js` set `JSDOS_BASE = "vendor/jsdos/"`.
3. Point the `<script src>` in `index.html` at `vendor/jsdos/js-dos.js`.
