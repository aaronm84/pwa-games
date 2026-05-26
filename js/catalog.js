// ============================================================================
//  GAME CATALOG  —  add a game by copying an entry and dropping its files in.
// ----------------------------------------------------------------------------
//  Each entry:
//   id        unique slug (also the folder name under games/)
//   title     shown in the library
//   year      optional, shown as a subtitle
//   cover     path to a cover image (svg/png/jpg). Optional; a placeholder is
//             generated from the title if omitted.
//   bundle    path to the .jsdos bundle (a ZIP — see games/README.md)
//   controls  touch input layout (see below)
//
//  controls.mode:
//   "mouse"   point-and-click: drag to move the cursor, tap to click.
//             Best for kids' games like "I Can Be an Animal Doctor".
//   "dpad"    on-screen D-pad + action buttons mapped to keys.
//
//  controls.dpad   { keys: { up, down, left, right } }  (friendly key names)
//  controls.buttons[]  { label, key }   action buttons (multi-touch friendly)
//  controls.diagonals  true to allow pressing two D-pad directions at once
// ============================================================================

export const CATALOG = [
  {
    id: "sample",
    title: "Emulator Test",
    year: "demo",
    bundle: "games/sample/sample.jsdos",
    cover: "games/sample/cover.svg",
    controls: {
      mode: "dpad",
      dpad: { keys: { up: "up", down: "down", left: "left", right: "right" } },
      diagonals: true,
      buttons: [
        { label: "D", key: "d" },     // tapping types a 'd' at the DOS prompt — proves input works
        { label: "↵", key: "enter" },
        { label: "ESC", key: "esc" },
      ],
    },
  },

  {
    // First real game. Drop the bundle at games/animal-doctor/animal-doctor.jsdos
    // (see games/README.md for how to build it). It is a point-and-click kids'
    // title, so it is configured for touch-mouse input.
    id: "animal-doctor",
    title: "I Can Be an Animal Doctor",
    year: "1995",
    bundle: "games/animal-doctor/animal-doctor.jsdos",
    cover: "games/animal-doctor/cover.svg",
    controls: {
      mode: "mouse",
    },
  },
];
