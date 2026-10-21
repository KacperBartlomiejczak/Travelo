import type { ViewStyle } from 'react-native';

import { colors, elevation, type ElevationLevel } from './tokens';

// Color literals widened to string so both modes share one type.
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

// Semantic colors of one mode at the top level, plus that mode's elevation (sunline-redesign D3).
export type Theme = Widen<typeof colors.light> & { elevation: Record<ElevationLevel, ViewStyle> };

export const lightTheme: Theme = { ...colors.light, elevation: elevation.light };
export const darkTheme: Theme = { ...colors.dark, elevation: elevation.dark };
