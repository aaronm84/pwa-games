# pwa-games

A collection of installable **Progressive Web App (PWA)** games — playable in any
browser and installable straight to a phone's home screen, no app store required.

Each game is a self-contained [Quasar](https://quasar.dev) (Vue 3) + Capacitor
project in its own top-level `*-pwa/` folder.

## Games

| Game | Folder | Live |
| --- | --- | --- |
| 🃏 **Solitaire** — relaxing Klondike card game | [`solitaire-pwa/`](solitaire-pwa/) | https://aaronm84.github.io/pwa-games/solitaire/ |

Landing page: **https://aaronm84.github.io/pwa-games/**

## How hosting works

A single GitHub Actions workflow (`.github/workflows/deploy.yml`) builds **every**
game folder on each push to `main` and publishes them to GitHub Pages:

- Each `*-pwa/` folder is built with `PUBLIC_PATH=/pwa-games/<name>/` (the `-pwa`
  suffix is stripped) and copied to `<name>/` on the Pages site.
- A landing page (`index.html`) at the site root links to each game.

So `solitaire-pwa/` is served at `/pwa-games/solitaire/`, and a future
`sudoku-pwa/` would automatically appear at `/pwa-games/sudoku/`.

Games use Vue Router **hash mode**, so deep links work on GitHub Pages with no
server-side routing config.

## Adding a new game

1. Add a new `<name>-pwa/` folder containing a Quasar PWA project (the existing
   games make a good template — copy one and rebrand `package.json`,
   `src-pwa/manifest.json`, the icons in `public/`, and the pages).
2. Add a row to the table above and a card to `index.html`.
3. Push to `main` — the workflow builds and deploys it automatically.

## Local development

```bash
cd solitaire-pwa
npm install
npm run dev        # quasar dev -m pwa
```

See each game's own `README.md` for details.
