import type { TextStyle } from 'react-native';

// Font family names as registered by @expo-google-fonts in the root layout.
// Weight is encoded in the family name, so styles do not set fontWeight.
export const fontFamily = {
  sansRegular: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  displayMedium: 'Fraunces_500Medium',
  displaySemiBold: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

// Type scale from context/design-context.md §4.2.
export const typography = {
  displayXL: { fontFamily: fontFamily.displaySemiBold, fontSize: 36, lineHeight: 42, letterSpacing: -0.7 },
  displayL: { fontFamily: fontFamily.displaySemiBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  heading1: { fontFamily: fontFamily.sansBold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  heading2: { fontFamily: fontFamily.sansBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heading3: { fontFamily: fontFamily.sansBold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  bodyL: { fontFamily: fontFamily.sansRegular, fontSize: 17, lineHeight: 24, letterSpacing: 0 },
  bodyM: { fontFamily: fontFamily.sansRegular, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyMMedium: { fontFamily: fontFamily.sansMedium, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyS: { fontFamily: fontFamily.sansRegular, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: fontFamily.sansMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  button: { fontFamily: fontFamily.sansSemiBold, fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  numericXL: { fontFamily: fontFamily.sansBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.5, fontVariant: tabular },
  numericL: { fontFamily: fontFamily.sansBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3, fontVariant: tabular },
  numericM: { fontFamily: fontFamily.sansSemiBold, fontSize: 17, lineHeight: 22, letterSpacing: 0, fontVariant: tabular },
} as const satisfies Record<string, TextStyle>;
