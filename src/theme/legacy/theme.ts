import type { ViewStyle } from 'react-native';

import { breakpoints, duration, elevation, gradient, opacity, palette, partnerBrand, radius, size, spacing } from './tokens';
import { typography } from './typography';

// §6.1: shadows in light mode; dark mode relies on surface contrast.
const lightElevation: { card: ViewStyle; floating: ViewStyle; dialog: ViewStyle } = {
  card: elevation.card,
  floating: elevation.floating,
  dialog: elevation.dialog,
};
const darkElevation: { card: ViewStyle; floating: ViewStyle; dialog: ViewStyle } = { card: {}, floating: {}, dialog: {} };

// Hero colours (trip-flight-tabs-name-cover D4, D7): only for things drawn dark over a photo (welcome screen, photo
// viewer, the round menu buttons, photo-tile overlays), so they use the dark-mode text colours in both themes.
const hero = {
  background: palette.neutral[900],
  text: palette.dark.textPrimary,
  textSecondary: palette.dark.textSecondary,
  // Behind the menu button over the photo: ink at 50 %, the scrim value, readable on a bright photo (trips-drawer P5).
  control: palette.overlay.scrim,
};

// Pill navigation (theme-split-and-profile-prefill D2, reverses pill-nav-and-dialog D2): follows the theme, with a
// brand-coloured active item. Light: white pill, brand.600 text (trip-create-wizard D28). Dark: ink pill.
// `pressed` (D8): the tab background while pressed; light neutral.50 keeps brand.600 at 4.63:1 and neutral.600 at 5.84:1.
const lightNav = {
  background: palette.neutral[0],
  border: palette.neutral[200],
  textInactive: palette.neutral[600],
  active: palette.brand[600],
  pressed: palette.neutral[50],
};
const darkNav = {
  background: palette.neutral[900],
  border: palette.dark.border,
  textInactive: palette.dark.textSecondary,
  active: palette.dark.brand,
  pressed: palette.dark.border,
};

// Semantic color roles from context/design-context.md §3.
const light = {
  colors: {
    background: palette.neutral[50],
    surface: {
      default: palette.neutral[0],
      secondary: palette.neutral[100],
      elevated: palette.neutral[0],
    },
    text: {
      primary: palette.neutral[900],
      secondary: palette.neutral[600],
      tertiary: palette.neutral[500],
    },
    border: palette.neutral[200],
    divider: palette.neutral[100],
    input: { border: palette.neutral[300] },
    action: {
      primary: palette.brand[500],
      primaryPressed: palette.brand[600],
      onPrimary: palette.neutral[0],
      // D28: ghost button text (§10.1 brand.600).
      link: palette.brand[600],
      disabled: palette.neutral[200],
      onDisabled: palette.neutral[500],
    },
    status: palette.semantic.light,
    budget: palette.budget.light,
    category: palette.category.light,
    hero,
    nav: lightNav,
    // Sign-in buttons of Google and Discord (D10, D13): the same in both themes.
    brand: partnerBrand,
    overlay: palette.overlay,
    // Snackbar is inverse: ink on light, light on dark (trip-edit-menu D11).
    snackbar: { background: palette.neutral[900], text: palette.neutral[50] },
  },
  elevation: lightElevation,
  gradient,
  spacing,
  radius,
  size,
  opacity,
  duration,
  breakpoints,
  typography,
} as const;

// Color literals widened to string so the dark theme can share the light theme's shape.
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type Theme = Omit<typeof light, 'colors'> & { colors: Widen<typeof light.colors> };

export const lightTheme: Theme = light;

export const darkTheme: Theme = {
  colors: {
    background: palette.dark.background,
    surface: {
      default: palette.dark.surface,
      secondary: palette.dark.surfaceSecondary,
      elevated: palette.dark.surfaceElevated,
    },
    text: {
      primary: palette.dark.textPrimary,
      secondary: palette.dark.textSecondary,
      tertiary: palette.dark.textTertiary,
    },
    border: palette.dark.border,
    divider: palette.dark.divider,
    input: { border: palette.dark.inputBorder },
    action: {
      primary: palette.dark.brand,
      primaryPressed: palette.dark.brandPressed,
      onPrimary: palette.dark.onBrand,
      link: palette.dark.brand,
      // D9: same roles as light mode (border / tertiary text).
      disabled: palette.dark.border,
      onDisabled: palette.dark.textTertiary,
    },
    status: palette.semantic.dark,
    budget: palette.budget.dark,
    category: palette.category.dark,
    hero,
    nav: darkNav,
    brand: partnerBrand,
    overlay: palette.overlay,
    snackbar: { background: palette.neutral[50], text: palette.neutral[900] },
  },
  elevation: darkElevation,
  gradient,
  spacing,
  radius,
  size,
  opacity,
  duration,
  breakpoints,
  typography,
};
