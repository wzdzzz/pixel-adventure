export const UI_THEME = Object.freeze({
  colors: Object.freeze({
    ink: 0x09110f,
    backdrop: 0x0d1714,
    panel: 0x12201b,
    panelRaised: 0x192b24,
    panelHover: 0x233a31,
    border: 0x456b5b,
    borderMuted: 0x29443a,
    jade: 0x62bc91,
    jadeBright: 0x85d3ad,
    cinnabar: 0xb94f43,
    cinnabarBright: 0xda7465,
    brass: 0xc6a45f,
    brassMuted: 0x816c43,
    paper: 0xd9ddd4,
    muted: 0x89998f,
    disabled: 0x536059,
    shadow: 0x050907,
  }),
  text: Object.freeze({
    paper: '#d9ddd4',
    muted: '#89998f',
    disabled: '#536059',
    jade: '#62bc91',
    jadeBright: '#85d3ad',
    cinnabar: '#b94f43',
    cinnabarBright: '#da7465',
    brass: '#c6a45f',
    brassMuted: '#816c43',
    shadow: '#050907',
  }),
  font: Object.freeze({
    display: '"Microsoft YaHei", "Noto Sans SC", sans-serif',
    body: '"Microsoft YaHei", "Noto Sans SC", sans-serif',
    mono: '"Cascadia Mono", "Microsoft YaHei", monospace',
  }),
});

export const RARITY_THEME = Object.freeze({
  common: Object.freeze({ bg: 0x27312d, border: 0x69766f, text: '#c5cbc7' }),
  uncommon: Object.freeze({ bg: 0x173326, border: 0x4a9a6c, text: '#79c592' }),
  rare: Object.freeze({ bg: 0x172d33, border: 0x4b8b9c, text: '#78b5c4' }),
  epic: Object.freeze({ bg: 0x302737, border: 0x9870a7, text: '#c098cc' }),
  legendary: Object.freeze({ bg: 0x382e1d, border: 0xc6a45f, text: '#dabb75' }),
  mythic: Object.freeze({ bg: 0x3b211d, border: 0xb94f43, text: '#da7465' }),
});

export function getRarityTheme(rarity) {
  return RARITY_THEME[rarity] || RARITY_THEME.common;
}
