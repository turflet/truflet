/** Design tokens drawn from the Turflet logo: deep forest green wordmark, coral ball, warm paper ground.
 *  Mirrors mobile/lib/core/theme/app_colors.dart one-to-one. */
export const C = {
  ink: '#0C2419',
  muted: '#5E6B63',
  mutedInk: '#3D4B43',
  ground: '#F7F5EF',
  line: '#E5E2D8',
  divider: '#EFECE4',
  brand: '#143D2B',
  brandDark: '#0B2A1D',
  green700: '#1F5A40',
  green900: '#0F3324',
  coral: '#F2552C',
  coralSoft: '#FFE8E0',
  lime: '#FFDCCF',
  limeSoft: '#E6EEE7',
  mint: '#E9F0EA',
  chip: '#F1EEE6',
  segment: '#EAE7DE',
  dashed: '#D8D4C8',
  radioOff: '#AEB5AE',
  dotOff: '#CCD0CA',
  blue: '#1D4ED8',
  blueSoft: '#DBEAFE',
  blueInk: '#1E3A8A',
  purple: '#6D28D9',
  purpleSoft: '#EDE9FE',
  amber: '#854D0E',
  amberSoft: '#FEF3C7',
  teal: '#0E7490',
  tealSoft: '#CFFAFE',
  orange: '#D9441F',
  orangeSoft: '#FFEDD5',
  orangeInk: '#9A3412',
  orangeDeep: '#7C2D12',
  orangeBg: '#FFF7ED',
  red: '#DC2626',
  redInk: '#B91C1C',
  redSoft: '#FEE2E2',
  rose: '#E11D48',
  roseSoft: '#FFE4E6',
  warnBg: '#FDF1E7',
  warnInk: '#8A3C07',
  star: '#EAB308',
  white: '#FFFFFF',
};

/** `#RRGGBB` from the API, or the fallback. */
export const hex = (s, fallback = C.brand) => (typeof s === 'string' && s.length >= 7 ? s.slice(0, 7) : fallback);

export const shadow = {
  card: '0 8px 24px rgba(12,36,25,0.07)',
  soft: '0 4px 14px rgba(12,36,25,0.05)',
  big: '0 12px 32px rgba(12,36,25,0.094)',
  brand: '0 10px 24px rgba(20,61,43,0.25)',
  brandSm: '0 8px 18px rgba(20,61,43,0.22)',
};

/** Body text — `t()` in the Flutter app. */
export const t = (size, o = {}) => ({
  fontSize: size,
  fontWeight: o.w ?? 400,
  color: o.c ?? C.ink,
  lineHeight: o.h ?? 1.35,
  letterSpacing: o.ls,
});

/** Display text: extra-bold and tightly tracked like the logo — `d()` in the Flutter app. */
export const d = (size, o = {}) => ({
  fontSize: size,
  fontWeight: o.w ?? 800,
  color: o.c ?? C.ink,
  lineHeight: o.h ?? 1.2,
  letterSpacing: o.ls ?? -0.03 * size,
});

export const avatarColors = [C.brand, C.blue, C.purple, C.orange, C.teal, C.amber, C.redInk, '#0F766E'];

/** Width at which the web app switches from the phone layout to the desktop layout. */
export const DESKTOP_MIN = 960;
