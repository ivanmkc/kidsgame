// Storybook-circus palette: warm cream paper, circus red, big-top teal,
// sunshine gold. Chunky rounded "sticker" cards with soft drop shadows.
export const colors = {
  bg: '#FFF6E9',
  paper: '#FFFDF7',
  card: '#FFFFFF',
  ink: '#43304B', // deep plum, softer than black for storybook text
  inkSoft: '#6E5C7B', // secondary text — keeps >=4.5:1 on the cream surfaces
  red: '#E8564F',
  teal: '#2FB8AC',
  gold: '#FFC24B',
  purple: '#9B7EDE',
  green: '#5FBF6E',
  blush: '#FFE3D2',
  ring: '#5FBF6E',
};

export const fonts = {
  display: 'Baloo2_800ExtraBold',
  displayMed: 'Baloo2_600SemiBold',
  body: 'Nunito_700Bold',
  bodyReg: 'Nunito_600SemiBold',
};

export const shadows = {
  sticker: {
    shadowColor: '#B8905F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  soft: {
    shadowColor: '#B8905F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  // deeper warm ambient for hero cards; pair with `soft` on an inner view
  // for a layered two-shadow look
  lifted: {
    shadowColor: '#8A5A3B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 10,
  },
  glowGold: {
    shadowColor: '#FFC24B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 8,
  },
};

export function darken(hex: string, amount = 0.22): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
