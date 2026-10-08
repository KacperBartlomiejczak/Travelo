// Primitive tokens from context/design-context.md §2 and §5.
// Components must not import these directly — use semantic tokens from theme.ts.

export const palette = {
  brand: {
    50: '#FFF1EC',
    100: '#FFE0D7',
    200: '#FFC0AF',
    300: '#F59A82',
    400: '#E9795C',
    500: '#D85C3A',
    600: '#BD472A',
    700: '#96361F',
    800: '#702B1C',
    900: '#4D2118',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F7F3EA',
    100: '#EEE8DD',
    200: '#DDD5C7',
    300: '#C5BBAA',
    400: '#A79C8B',
    500: '#877C6D',
    600: '#665D51',
    700: '#494239',
    800: '#302B26',
    900: '#17211B',
  },
  // Behind bottom sheets: ink (neutral.900, the shadow colour of §6.1) at 50 % (trips-supabase D12).
  overlay: { scrim: 'rgba(23, 33, 27, 0.5)' },
  // §3.2 dark roles that are not part of the neutral scale.
  dark: {
    background: '#111712',
    surface: '#17211B',
    surfaceSecondary: '#202A23',
    surfaceElevated: '#263229',
    textPrimary: '#F7F3EA',
    textSecondary: '#C9C2B6',
    textTertiary: '#9E978B',
    border: '#39443B',
    // D26: input border, one step lighter than `border` so fields stand out on cards.
    inputBorder: '#4A564C',
    divider: '#2A342D',
    brand: '#F08A6C',
    brandPressed: '#F59A82',
    onBrand: '#17211B',
  },
  // §2.3–§2.5 colors defined per theme.
  semantic: {
    light: { success: '#397A5A', warning: '#9A6810', error: '#B13B32', info: '#356F92' },
    dark: { success: '#79C69A', warning: '#E8B85A', error: '#F28B82', info: '#7DB9D8' },
  },
  budget: {
    light: { under: '#397A5A', nearLimit: '#9A6810', over: '#B45F42' },
    dark: { under: '#79C69A', nearLimit: '#E8B85A', over: '#E89A7A' },
  },
  category: {
    light: {
      food: '#D85C3A',
      transport: '#356F92',
      stay: '#71856F',
      activities: '#8A6699',
      other: '#877C6D',
    },
    dark: {
      food: '#F08A6C',
      transport: '#7DB9D8',
      stay: '#A4C39E',
      activities: '#C1A4D1',
      other: '#B9B0A2',
    },
  },
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
  segmented: 10, // §10.14
} as const;

// §5.2 layout sizes, §7 icon sizes, §8 illustration canvas.
export const size = {
  touchTarget: 44,
  buttonPrimary: 52,
  buttonCompact: 44,
  iconInline: 16,
  iconStandard: 20,
  iconPrimary: 24,
  iconFeature: 32,
  iconStroke: 2,
  focusRing: 2,
  illustration: 160,
  maxContentWidth: 720,
  // trips-drawer P1: the side panel is 85 % of the screen up to this width; trip thumbnails in it.
  drawerMaxWidth: 360,
  thumbnail: 48,
} as const;

// design-context §18: below this width the screen uses compact horizontal padding.
export const breakpoints = {
  compact: 360,
} as const;

// §6.1 elevation; shadow color is neutral.900. Dark mode uses surface contrast instead.
export const elevation = {
  card: {
    shadowColor: '#17211B',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
} as const;

// §20 rule 20: gradients only as tokens. Trip hero photo: clear above `start`, fading into ink below
// (trip-flight-tabs-name-cover D4).
export const gradient = {
  heroFade: { start: 0.35 },
} as const;
