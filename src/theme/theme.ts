import { breakpoints, palette, radius, size, spacing } from './tokens';
import { typography } from './typography';

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
    action: {
      primary: palette.brand[500],
      primaryPressed: palette.brand[600],
      onPrimary: palette.neutral[0],
      disabled: palette.neutral[200],
      onDisabled: palette.neutral[500],
    },
    status: palette.semantic.light,
    budget: palette.budget.light,
    category: palette.category.light,
  },
  spacing,
  radius,
  size,
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
    action: {
      primary: palette.dark.brand,
      primaryPressed: palette.dark.brandPressed,
      onPrimary: palette.dark.onBrand,
      // D9: same roles as light mode (border / tertiary text).
      disabled: palette.dark.border,
      onDisabled: palette.dark.textTertiary,
    },
    status: palette.semantic.dark,
    budget: palette.budget.dark,
    category: palette.category.dark,
  },
  spacing,
  radius,
  size,
  breakpoints,
  typography,
};
