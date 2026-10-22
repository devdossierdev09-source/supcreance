/**
 * Terminal noir / vert — synchronisé avec artifacts/creances/src/index.css
 * (bloc « TERMINAL NOIR / VERT — thème forcé »). Thème unique, indépendant du système.
 */
const terminal = {
  text: '#b6f2c8',
  tint: '#0aff4f',

  background: '#060a07', // 140 25% 3%
  foreground: '#b6f2c8', // 140 70% 84%

  card: '#0a120c', // 140 30% 5.5%
  cardForeground: '#b6f2c8',

  primary: '#0aff4f', // 140 100% 52%
  primaryForeground: '#061009',

  secondary: '#142419', // 140 30% 11%
  secondaryForeground: '#b6f2c8',

  muted: '#111d14', // 140 28% 9%
  mutedForeground: '#92bc9d', // 140 28% 66%

  accent: '#17301e', // 140 35% 14%
  accentForeground: '#c7f9d6',

  destructive: '#f75252', // 0 92% 64%
  destructiveForeground: '#141414',
  destructiveSoft: '#2a0e0e',

  debt: '#9cf5b6', // 140 85% 76%
  settled: '#0aff4f',
  settledSoft: '#0f2416',
  warn: '#f2d36b',
  warnSoft: '#262009',

  border: '#22592f', // 140 45% 24%
  input: '#309150', // 140 50% 38%
};

const colors = {
  light: terminal,
  dark: terminal,
  radius: 2,
};

export default colors;
