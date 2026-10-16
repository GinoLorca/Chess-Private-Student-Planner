// Repertoire Lab's palettes (src/lib/skins.js and the :root block of
// styles.css there), carried over so the analysis board and its panels look
// as they do in Repertoire Lab under the same skin. Folder, this app's own
// look, wears Repertoire Lab's own colours (its Custom theme), board included.

export interface Palette {
  tokens: Record<string, string>
  boardLight: string
  boardDark: string
  pieceLight: string
  pieceDark: string
}

// Repertoire Lab's built-in board: blue squares, react-chessboard's own pieces.
export const DEFAULT_SQUARE_LIGHT = '#c6d3e1'
export const DEFAULT_SQUARE_DARK = '#4a6a8f'

const BASE: Record<'light' | 'dark', Record<string, string>> = {
  "dark": {
    "--bg": "#14171d",
    "--panel": "#1c2028",
    "--card": "#232833",
    "--card-hover": "#293040",
    "--border": "#313847",
    "--text": "#e9ecf2",
    "--muted": "#8b93a7",
    "--accent": "#3b9cff",
    "--accent-dim": "#2d6fb5",
    "--green": "#2ecc71",
    "--red": "#e5534b",
    "--amber": "#e8b339",
    "--track": "#171a21",
    "--shadow": "rgba(0, 0, 0, 0.45)"
  },
  "light": {
    "--bg": "#f4f6fa",
    "--panel": "#ffffff",
    "--card": "#ffffff",
    "--card-hover": "#eef2f8",
    "--border": "#d7dded",
    "--text": "#1a1f29",
    "--muted": "#5d6577",
    "--accent": "#1f6fd0",
    "--accent-dim": "#2f80e0",
    "--green": "#1a9c53",
    "--red": "#d03a32",
    "--amber": "#b8820c",
    "--track": "#e3e8f1",
    "--shadow": "rgba(31, 41, 61, 0.18)"
  }
}

type Raw = Record<string, string>
const SKINS: Record<string, { light: Raw; dark: Raw }> = {
  "felt": {
    "light": {
      "--bg": "#dcd2b4",
      "--panel": "#fdfaf1",
      "--card": "#eee2c6",
      "--card-hover": "#e4d5b2",
      "--border": "#c9ba90",
      "--text": "#1e1a12",
      "--muted": "#665d49",
      "--accent": "#8a6a16",
      "--accent-dim": "#a9841f",
      "--green": "#2f7d4f",
      "--red": "#b6392f",
      "--amber": "#b4691a",
      "--track": "#ddd0ad",
      "boardLight": "#ecdfc0",
      "boardDark": "#55684f",
      "pieceLight": "#f7f0dd",
      "pieceDark": "#20180c"
    },
    "dark": {
      "--bg": "#142a1b",
      "--panel": "#1b2117",
      "--card": "#232a1d",
      "--card-hover": "#2d3526",
      "--border": "#343a28",
      "--text": "#ede6d3",
      "--muted": "#a89f88",
      "--accent": "#e0b13c",
      "--accent-dim": "#8a6a16",
      "--green": "#4fb374",
      "--red": "#e2665a",
      "--amber": "#e0a63e",
      "--track": "#101d13",
      "boardLight": "#e9dfc3",
      "boardDark": "#3a4a3a",
      "pieceLight": "#f4ecd6",
      "pieceDark": "#20180c"
    }
  },
  "hustler": {
    "light": {
      "--bg": "#c9c6bd",
      "--panel": "#deded4",
      "--card": "#c2bfb5",
      "--card-hover": "#b7b4a9",
      "--border": "#a5a196",
      "--text": "#1c1e20",
      "--muted": "#585d61",
      "--accent": "#3f8a76",
      "--accent-dim": "#357462",
      "--green": "#2f7d4f",
      "--red": "#b23a2c",
      "--amber": "#b4691a",
      "--track": "#b4b1a7",
      "boardLight": "#efece3",
      "boardDark": "#242423",
      "pieceLight": "#f4f2ea",
      "pieceDark": "#17171a"
    },
    "dark": {
      "--bg": "#191b1d",
      "--panel": "#232629",
      "--card": "#2d3134",
      "--card-hover": "#383d41",
      "--border": "#3a3f43",
      "--text": "#e9e6df",
      "--muted": "#979da1",
      "--accent": "#5fcab0",
      "--accent-dim": "#2f6b5d",
      "--green": "#4fb374",
      "--red": "#e2665a",
      "--amber": "#e0a63e",
      "--track": "#141618",
      "boardLight": "#efece3",
      "boardDark": "#242423",
      "pieceLight": "#f4f2ea",
      "pieceDark": "#17171a"
    }
  },
  "bauhaus": {
    "light": {
      "--bg": "#ece7dc",
      "--panel": "#faf7f0",
      "--card": "#e6e0d2",
      "--card-hover": "#dbd4c3",
      "--border": "#141414",
      "--text": "#141414",
      "--muted": "#5c5850",
      "--accent": "#1a4fa0",
      "--accent-dim": "#16407f",
      "--green": "#1a4fa0",
      "--red": "#d8232a",
      "--amber": "#e0a500",
      "--track": "#d5cebd",
      "boardLight": "#f2ede1",
      "boardDark": "#1a4fa0",
      "pieceLight": "#faf7f0",
      "pieceDark": "#141414"
    },
    "dark": {
      "--bg": "#121212",
      "--panel": "#1e1e1e",
      "--card": "#2a2a2a",
      "--card-hover": "#353535",
      "--border": "#4a4a4a",
      "--text": "#f5f2ea",
      "--muted": "#a8a29a",
      "--accent": "#f2c200",
      "--accent-dim": "#1a4fa0",
      "--green": "#3d7bd1",
      "--red": "#e8453c",
      "--amber": "#f2c200",
      "--track": "#0c0c0c",
      "boardLight": "#e8e2d5",
      "boardDark": "#1a4fa0",
      "pieceLight": "#f5f2ea",
      "pieceDark": "#141414"
    }
  },
  "gameboy": {
    "light": {
      "--bg": "#c9cdb6",
      "--panel": "#dee2cf",
      "--card": "#c3c7ac",
      "--card-hover": "#b7bba0",
      "--border": "#93967f",
      "--text": "#1c1d14",
      "--muted": "#5f6350",
      "--accent": "#b8236b",
      "--accent-dim": "#9a1c59",
      "--green": "#2f9e44",
      "--red": "#c23b3b",
      "--amber": "#c2701a",
      "--track": "#b5b99e",
      "boardLight": "#9bbc0f",
      "boardDark": "#306230",
      "pieceLight": "#e8f0c0",
      "pieceDark": "#0f380f"
    },
    "dark": {
      "--bg": "#1c2016",
      "--panel": "#262b1d",
      "--card": "#313629",
      "--card-hover": "#3c4133",
      "--border": "#3c4130",
      "--text": "#e4e8d4",
      "--muted": "#9aa088",
      "--accent": "#e2528f",
      "--accent-dim": "#8f2f5a",
      "--green": "#4bbf5e",
      "--red": "#e2665a",
      "--amber": "#e0a63e",
      "--track": "#161a11",
      "boardLight": "#8bac0f",
      "boardDark": "#0f380f",
      "pieceLight": "#e4e8d4",
      "pieceDark": "#0b280b"
    }
  },
  "outerspace": {
    "light": {
      "--bg": "#161b26",
      "--panel": "#1d2330",
      "--card": "#262d3d",
      "--card-hover": "#313949",
      "--border": "#323a4d",
      "--text": "#eee8d8",
      "--muted": "#8b93a3",
      "--accent": "#ff5a36",
      "--accent-dim": "#b8351a",
      "--green": "#4fd6c4",
      "--red": "#ff3b3b",
      "--amber": "#ffb347",
      "--track": "#11151e",
      "boardLight": "#e8b578",
      "boardDark": "#12141c",
      "pieceLight": "#f3ecda",
      "pieceDark": "#14161e"
    },
    "dark": {
      "--bg": "#0b0e14",
      "--panel": "#12151f",
      "--card": "#191d29",
      "--card-hover": "#232839",
      "--border": "#252b3a",
      "--text": "#f0ead8",
      "--muted": "#7c8494",
      "--accent": "#ff6a45",
      "--accent-dim": "#c03f22",
      "--green": "#5eead4",
      "--red": "#ff4d4d",
      "--amber": "#ffc266",
      "--track": "#070910",
      "boardLight": "#e8b578",
      "boardDark": "#0d0f16",
      "pieceLight": "#f0ead8",
      "pieceDark": "#101219"
    }
  },
  // The newer Chess Arcade themes, from Arcade's own colours (Repertoire Lab has none of them).
  "drivethru": {
    "light": {
      "--bg": "#fff4de",
      "--panel": "#ffffff",
      "--card": "#fff3d1",
      "--card-hover": "color-mix(in srgb, #fff3d1 90%, #2a1810)",
      "--border": "#f2dca8",
      "--text": "#2a1810",
      "--muted": "#6b4a35",
      "--accent": "#c8221a",
      "--accent-dim": "#ffd966",
      "--green": "#237a33",
      "--red": "#c8221a",
      "--amber": "#e07b00",
      "--track": "#fff3d1",
      "boardLight": "#fff6e3",
      "boardDark": "#d7261e",
      "pieceLight": "#ffc72c",
      "pieceDark": "#5b2c8e"
    },
    "dark": {
      "--bg": "#140e0c",
      "--panel": "#22170f",
      "--card": "#2c1e15",
      "--card-hover": "color-mix(in srgb, #2c1e15 90%, #fff4e0)",
      "--border": "#3e2a1f",
      "--text": "#fff4e0",
      "--muted": "#c9a98f",
      "--accent": "#ffc72c",
      "--accent-dim": "#ffd966",
      "--green": "#5fd17a",
      "--red": "#ff5a47",
      "--amber": "#ffa94d",
      "--track": "#2c1e15",
      "boardLight": "#f3e2c0",
      "boardDark": "#b01e16",
      "pieceLight": "#ffc72c",
      "pieceDark": "#5b2c8e"
    }
  },
  "rose": {
    "light": {
      "--bg": "#fbeef1",
      "--panel": "#fffcfd",
      "--card": "#fbe3ea",
      "--card-hover": "color-mix(in srgb, #fbe3ea 90%, #3a1a2a)",
      "--border": "#efd3db",
      "--text": "#3a1a2a",
      "--muted": "#7d5867",
      "--accent": "#a3245e",
      "--accent-dim": "#b73d72",
      "--green": "#1f7a5a",
      "--red": "#c0392b",
      "--amber": "#c2661a",
      "--track": "#fbe3ea",
      "boardLight": "#fbe6eb",
      "boardDark": "#d58ca2",
      "pieceLight": "#fff8f3",
      "pieceDark": "#5a1e3d"
    },
    "dark": {
      "--bg": "#1e0f17",
      "--panel": "#2a1622",
      "--card": "#341c2b",
      "--card-hover": "color-mix(in srgb, #341c2b 90%, #f8e6ec)",
      "--border": "#4a2a3d",
      "--text": "#f8e6ec",
      "--muted": "#c7a1b0",
      "--accent": "#f48fb1",
      "--accent-dim": "#f7b2c8",
      "--green": "#5ed1a8",
      "--red": "#ff6b6b",
      "--amber": "#ffae5c",
      "--track": "#341c2b",
      "boardLight": "#e8c3cd",
      "boardDark": "#a9576f",
      "pieceLight": "#fff8f3",
      "pieceDark": "#4a1230"
    }
  },
  "chessbook": {
    "light": {
      "--bg": "#ece4d4",
      "--panel": "#f8f4ea",
      "--card": "#efe8d9",
      "--card-hover": "color-mix(in srgb, #efe8d9 90%, #1c1a17)",
      "--border": "#d8cdb6",
      "--text": "#1c1a17",
      "--muted": "#5e574c",
      "--accent": "#7a2e1f",
      "--accent-dim": "#9e4a36",
      "--green": "#2f6b3f",
      "--red": "#9e2b1f",
      "--amber": "#9a5a12",
      "--track": "#efe8d9",
      "boardLight": "#f6f1e5",
      "boardDark": "#c9bda4",
      "pieceLight": "#fbf8f1",
      "pieceDark": "#1c1a17"
    },
    "dark": {
      "--bg": "#1b1814",
      "--panel": "#24201a",
      "--card": "#2c2720",
      "--card-hover": "color-mix(in srgb, #2c2720 90%, #e9e1cf)",
      "--border": "#3a342a",
      "--text": "#e9e1cf",
      "--muted": "#a89e8a",
      "--accent": "#d98c6e",
      "--accent-dim": "#e7a88e",
      "--green": "#7dbf8a",
      "--red": "#e2735e",
      "--amber": "#e0a35e",
      "--track": "#2c2720",
      "boardLight": "#e3dac6",
      "boardDark": "#b9ad94",
      "pieceLight": "#fbf8f1",
      "pieceDark": "#1c1a17"
    }
  },
  "uptown": {
    "light": {
      "--bg": "#e8e6e0",
      "--panel": "#fcfcfa",
      "--card": "#f1f0eb",
      "--card-hover": "color-mix(in srgb, #f1f0eb 90%, #121314)",
      "--border": "#d6d4cd",
      "--text": "#121314",
      "--muted": "#4a4e55",
      "--accent": "#1e5a6d",
      "--accent-dim": "#2b6a80",
      "--green": "#006e36",
      "--red": "#b5122b",
      "--amber": "#a33f00",
      "--track": "#f1f0eb",
      "boardLight": "#eceae3",
      "boardDark": "#5094aa",
      "pieceLight": "#ffffff",
      "pieceDark": "#161719"
    },
    "dark": {
      "--bg": "#0c0d0f",
      "--panel": "#17191c",
      "--card": "#202328",
      "--card-hover": "color-mix(in srgb, #202328 90%, #f2f1ec)",
      "--border": "#2e3238",
      "--text": "#f2f1ec",
      "--muted": "#aeb3ba",
      "--accent": "#7fc4d6",
      "--accent-dim": "#9fd3e0",
      "--green": "#4ade8f",
      "--red": "#ff6b6b",
      "--amber": "#ff9447",
      "--track": "#202328",
      "boardLight": "#d8d6ce",
      "boardDark": "#5094aa",
      "pieceLight": "#fafaf6",
      "pieceDark": "#131416"
    }
  }
}

const BOARD_KEYS = ['boardLight', 'boardDark', 'pieceLight', 'pieceDark']

/** The palette for one of this app's skins in light or dark. */
export function paletteFor(skin: string, theme: 'light' | 'dark'): Palette {
  const s = SKINS[skin]
  if (!s) {
    return { tokens: BASE[theme], boardLight: DEFAULT_SQUARE_LIGHT, boardDark: DEFAULT_SQUARE_DARK, pieceLight: '#ffffff', pieceDark: '#000000' }
  }
  const raw = s[theme] ?? s.dark
  const tokens: Record<string, string> = { ...BASE[theme] }
  for (const [k, v] of Object.entries(raw)) if (!BOARD_KEYS.includes(k)) tokens[k] = v
  return { tokens, boardLight: raw.boardLight, boardDark: raw.boardDark, pieceLight: raw.pieceLight, pieceDark: raw.pieceDark }
}
