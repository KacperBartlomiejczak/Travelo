/**
 * Travelo — Sunline Editorial design tokens
 * Phase 2 foundations.
 *
 * Rules:
 * - No component may hardcode a color, spacing value, radius, type style, elevation or motion value.
 * - Use semantic theme colors from `colors.light` / `colors.dark` for UI.
 * - Primitive colors exist for chart/category construction and theme composition only.
 * - React Native units are unitless dp/pt.
 */

type TabularFontVariant = "tabular-nums";
const tabularNums: TabularFontVariant[] = ["tabular-nums"];

export const primitives = {
  pure: {
    white: "#FFFFFF",
    black: "#000000",
  },
  neutral: {
    0: "#FFFFFF",
    100: "#F8F4EC",
    200: "#EEE8DE",
    300: "#DED8CE",
    400: "#B8B1A6",
    500: "#8B857C",
    600: "#6D6962",
    700: "#56524C",
    800: "#35322F",
    900: "#171716",
  },
  ink: "#242321",
  paper: "#FFFCF7",
  coral: {
    100: "#FBE4DC",
    300: "#FF967A",
    400: "#F07D5E",
    500: "#E96F51",
    600: "#DC6B4E",
    700: "#B54A33",
    800: "#913222",
  },
  sea: {
    100: "#DFEDF1",
    300: "#8EC5D4",
    400: "#70A3B2",
    500: "#4C8FA3",
    700: "#1F5060",
  },
  olive: {
    300: "#A4AA78",
    500: "#8D9464",
    700: "#606744",
  },
  gold: {
    100: "#F4E8C8",
    300: "#F1CE78",
    400: "#E0B45E",
    500: "#B9831C",
    700: "#604308",
  },
} as const;

export const colors = {
  light: {
    background: {
      canvas: "#F8F4EC",
      sunken: "#EEE8DE",
    },
    surface: {
      primary: "#FFFCF7",
      elevated: "#FFFFFF",
      inverse: "#242321",
      overlay: "#FFFFFF",
    },
    text: {
      primary: "#242321",
      secondary: "#56524C",
      tertiary: "#6D6962",
      inverse: "#F8F4EC",
      disabled: "#56524C",
      brand: "#913222",
    },
    icon: {
      primary: "#242321",
      secondary: "#6D6962",
      disabled: "#56524C",
      inverse: "#F8F4EC",
    },
    border: {
      subtle: "#DED8CE",
      default: "#B8B1A6",
      interactive: "#8B857C",
      focus: "#B54A33",
    },
    brand: {
      primary: "#E96F51",
      pressed: "#DC6B4E",
      tint: "#FBE4DC",
      text: "#913222",
      focus: "#B54A33",
      onBrand: "#242321",
    },
    accent: {
      sea: "#4C8FA3",
      olive: "#8D9464",
      sun: "#D6A34D",
    },
    semantic: {
      success: {
        foreground: "#1E534E",
        background: "#E1F0ED",
        solid: "#3E8279",
      },
      warning: {
        foreground: "#604308",
        background: "#F4E8C8",
        solid: "#A87512",
      },
      error: {
        foreground: "#7D342D",
        background: "#F7E2DF",
        solid: "#A95449",
      },
      info: {
        foreground: "#1F5060",
        background: "#DFEDF1",
        solid: "#347B98",
      },
    },
    budget: {
      under: {
        foreground: "#1E534E",
        background: "#E1F0ED",
        meter: "#4D948B",
      },
      near: {
        foreground: "#604308",
        background: "#F4E8C8",
        meter: "#B9831C",
      },
      over: {
        foreground: "#7D342D",
        background: "#F7E2DF",
        meter: "#B85B50",
      },
    },
    expenseCategory: {
      food: "#B86F16",
      transport: "#347B98",
      stay: "#8064A2",
      activities: "#357A69",
      other: "#6D6962",
    },
    sync: {
      synced: "#357A69",
      pending: "#A87512",
      failed: "#A95449",
    },
    hero: {
      scrim: "rgba(17, 17, 16, 0.82)",
      text: "#FFFFFF",
      controlBackground: "rgba(17, 17, 16, 0.72)",
      controlBorder: "rgba(255, 255, 255, 0.28)",
    },
    disabled: {
      background: "#EEE8DE",
      foreground: "#56524C",
    },
    skeleton: {
      base: "#EEE8DE",
      highlight: "#FFFCF7",
    },
  },

  dark: {
    background: {
      canvas: "#171716",
      sunken: "#111110",
    },
    surface: {
      primary: "#201F1D",
      elevated: "#292724",
      inverse: "#F8F4EC",
      overlay: "#302E2B",
    },
    text: {
      primary: "#F5F1E8",
      secondary: "#B8B1A6",
      tertiary: "#AAA398",
      inverse: "#171716",
      disabled: "#AAA398",
      brand: "#FF967A",
    },
    icon: {
      primary: "#F5F1E8",
      secondary: "#B8B1A6",
      disabled: "#AAA398",
      inverse: "#171716",
    },
    border: {
      subtle: "#3A3733",
      default: "#4D4943",
      interactive: "#777064",
      focus: "#FF967A",
    },
    brand: {
      primary: "#F07D5E",
      pressed: "#E96F51",
      tint: "#442A24",
      text: "#FF967A",
      focus: "#FF967A",
      onBrand: "#171716",
    },
    accent: {
      sea: "#82AFBA",
      olive: "#A4AA78",
      sun: "#E0B45E",
    },
    semantic: {
      success: {
        foreground: "#9AD3CB",
        background: "#1A3431",
        solid: "#67B59D",
      },
      warning: {
        foreground: "#F1CE78",
        background: "#3A311C",
        solid: "#E0B45E",
      },
      error: {
        foreground: "#F2A29A",
        background: "#3A2522",
        solid: "#E5897F",
      },
      info: {
        foreground: "#8EC5D4",
        background: "#1B3037",
        solid: "#70A3B2",
      },
    },
    budget: {
      under: {
        foreground: "#9AD3CB",
        background: "#1A3431",
        meter: "#67B59D",
      },
      near: {
        foreground: "#F1CE78",
        background: "#3A311C",
        meter: "#E0B45E",
      },
      over: {
        foreground: "#F2A29A",
        background: "#3A2522",
        meter: "#E5897F",
      },
    },
    expenseCategory: {
      food: "#E6A64D",
      transport: "#68A9C1",
      stay: "#B49AD1",
      activities: "#67B59D",
      other: "#B8B1A6",
    },
    sync: {
      synced: "#67B59D",
      pending: "#E0B45E",
      failed: "#E5897F",
    },
    hero: {
      scrim: "rgba(17, 17, 16, 0.82)",
      text: "#FFFFFF",
      controlBackground: "rgba(17, 17, 16, 0.72)",
      controlBorder: "rgba(255, 255, 255, 0.28)",
    },
    disabled: {
      background: "#292724",
      foreground: "#AAA398",
    },
    skeleton: {
      base: "#292724",
      highlight: "#35322F",
    },
  },
} as const;

export const typography = {
  family: {
    bodyRegular: "DMSans_400Regular",
    bodyMedium: "DMSans_500Medium",
    bodySemiBold: "DMSans_600SemiBold",
    bodyBold: "DMSans_700Bold",
    displayMedium: "Fraunces_500Medium",
    displaySemiBold: "Fraunces_600SemiBold",
  },

  styles: {
    displayXL: {
      fontFamily: "Fraunces_600SemiBold",
      fontSize: 40,
      lineHeight: 44,
      fontWeight: "600",
      letterSpacing: -0.6,
    },
    displayLG: {
      fontFamily: "Fraunces_600SemiBold",
      fontSize: 34,
      lineHeight: 40,
      fontWeight: "600",
      letterSpacing: -0.4,
    },
    headingXL: {
      fontFamily: "Fraunces_600SemiBold",
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "600",
      letterSpacing: -0.2,
    },
    headingLG: {
      fontFamily: "DMSans_700Bold",
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "700",
      letterSpacing: -0.2,
    },
    headingMD: {
      fontFamily: "DMSans_700Bold",
      fontSize: 20,
      lineHeight: 26,
      fontWeight: "700",
      letterSpacing: -0.1,
    },
    headingSM: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "600",
      letterSpacing: 0,
    },
    bodyLG: {
      fontFamily: "DMSans_400Regular",
      fontSize: 17,
      lineHeight: 26,
      fontWeight: "400",
      letterSpacing: 0,
    },
    bodyMD: {
      fontFamily: "DMSans_400Regular",
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "400",
      letterSpacing: 0,
    },
    bodySM: {
      fontFamily: "DMSans_400Regular",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "400",
      letterSpacing: 0.1,
    },
    labelLG: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "600",
      letterSpacing: 0,
    },
    labelMD: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "600",
      letterSpacing: 0.1,
    },
    labelSM: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    caption: {
      fontFamily: "DMSans_500Medium",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "500",
      letterSpacing: 0.2,
    },
    eyebrow: {
      fontFamily: "DMSans_700Bold",
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "700",
      letterSpacing: 1.4,
    },
    moneyXL: {
      fontFamily: "DMSans_700Bold",
      fontSize: 32,
      lineHeight: 38,
      fontWeight: "700",
      letterSpacing: -0.4,
      fontVariant: tabularNums,
    },
    moneyLG: {
      fontFamily: "DMSans_700Bold",
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "700",
      letterSpacing: -0.2,
      fontVariant: tabularNums,
    },
    moneyMD: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "600",
      letterSpacing: 0,
      fontVariant: tabularNums,
    },
    numeric: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "600",
      letterSpacing: 0,
      fontVariant: tabularNums,
    },
  },
} as const;

// The sign-in buttons wear their provider's official colours: written exceptions to the Sunline palette
// (auth-onboarding D10 Google, D13 Discord), used for these two buttons and nowhere else, the same in both themes.
// `pressed` is the provider's own pressed/hover colour (Google: a 12 % state layer of the text colour on white).
export const partnerBrand = {
  google: {
    background: "#FFFFFF",
    border: "#747775",
    text: "#1F1F1F",
    pressed: "#E4E4E4",
    logo: { red: "#EA4335", blue: "#4285F4", yellow: "#FBBC05", green: "#34A853" },
  },
  discord: { background: "#5865F2", pressed: "#4752C4", text: "#FFFFFF" },
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radii = {
  none: 0,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  hero: 28,
  sheet: 28,
  pill: 999,
} as const;

export const layout = {
  screenGutterCompact: 16,
  compactBreakpoint: 390, // design-context §4.2: narrower screens use screenGutterCompact
  screenGutter: 20,
  screenGutterTablet: 32,
  maxContentWidth: 720,
  sectionGap: 32,
  cardGap: 12,
  inlineGap: 8,
  touchTarget: 44,
  primaryControlHeight: 52,
  compactControlHeight: 44,
  fabSize: 56,
  navPillHeight: 64,
  bottomActionGap: 12,
  thumbZoneStartRatio: 0.6,
} as const;

export const components = {
  button: {
    height: 52,
    compactHeight: 44,
    horizontalPadding: 20,
    iconGap: 8,
    radius: radii.md,
    borderWidth: 1, // sunline-redesign D10
  },
  iconButton: {
    size: 44,
    largeSize: 52,
    radius: radii.pill,
  },
  focusRing: { width: 2, offset: 2 }, // sunline-redesign D10: §8.0 focused state, 2 dp ring with a 2 dp gap
  fab: {
    size: 56,
    iconSize: 24,
    bottomClearance: 84,
  },
  input: {
    height: 52,
    amountHeight: 72,
    horizontalPadding: 16,
    labelGap: 8,
    helperGap: 6,
    radius: radii.md,
    borderWidth: 1,
    focusBorderWidth: 2,
  },
  chip: {
    visualHeight: 36,
    touchHeight: 44,
    horizontalPadding: 14,
    iconGap: 6,
    radius: radii.pill,
    borderWidth: 1,
  },
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
    groupOverlap: 10,
    groupMaxVisible: 4,
    borderWidth: 2,
    xxl: 96, // profile setup photo (auth-onboarding P2)
  },
  listRow: {
    minHeight: 56,
    verticalPadding: 12,
    horizontalPadding: 16,
    leadingSize: 40,
    trailingMinWidth: 44,
  },
  card: {
    padding: 16,
    compactPadding: 12,
    radius: radii.lg,
    borderWidth: 1,
    tripImageHeight: 156,
    activityImageHeight: 128,
    flightConnectorWidth: 24,
  },
  bottomSheet: {
    radius: radii.sheet,
    maxHeightRatio: 0.92,
    handleWidth: 36,
    handleHeight: 4,
    handleTopMargin: 10,
    contentTopPadding: 20,
    horizontalPadding: 20,
    footerPaddingBottom: 16,
    backdropOpacity: 0.48,
  },
  tabs: {
    height: 64,
    horizontalPadding: 8,
    itemMinWidth: 56,
    iconSize: 22,
    labelGap: 3,
    radius: radii.pill,
  },
  segmentedControl: {
    height: 44,
    padding: 4,
    segmentRadius: radii.sm,
  },
  progress: {
    trackHeight: 8,
    largeTrackHeight: 12,
    radius: radii.pill,
    markerSize: 16,
  },
  snackbar: {
    minHeight: 48,
    horizontalPadding: 16,
    verticalPadding: 12,
    radius: radii.md,
    maxWidth: 520,
    durationShort: 3500,
    durationWithAction: 6000,
  },
  dialog: {
    maxWidth: 360,
    horizontalMargin: 20,
    padding: 20,
    radius: radii.xl,
    backdropOpacity: 0.48,
  },
  skeleton: {
    lineHeight: 14,
    titleHeight: 22,
    radius: radii.sm,
  },
  timeline: {
    timeColumnWidth: 56,
    railColumnWidth: 24,
    railWidth: 2,
    nodeSize: 12,
    sharedCardMinHeight: 88,
    laneMinWidth: 132,
    laneGap: 8,
    splitHeaderHeight: 44,
    laneMarkerHeight: 3,
  },
  drawer: { maxWidth: 360, thumbnailSize: 48 }, // trips-drawer P1
  coverPicker: { tileWidth: 112 }, // trip-covers P1
  emptyState: { illustrationSize: 96 }, // sunline-redesign D22: §8.20 empty-state illustration
  offlineBanner: {
    minHeight: 44,
    horizontalPadding: 16,
    verticalPadding: 10,
  },
} as const;

export const screenMetrics = {
  tripOverview: {
    heroMinHeight: 360,
    heroHeightRatio: 0.52,
    photoStripHeight: 80,
    bottomContentInset: 92,
    heroFadeStart: 0.35, // trip-flight-tabs-name-cover D4: photo clear above this fraction, fading into the canvas below
  },
  quickExpense: {
    categoryVisibleCount: 5,
    targetCompletionMs: 5000,
  },
  shareSummary: {
    exportWidth: 1080,
    exportHeight: 1350,
    previewAspectRatio: 0.8,
    safeInset: 72,
    photoHeightRatio: 0.4,
  },
} as const;

export const elevation = {
  light: {
    level0: {
      shadowColor: "#171716",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    level1: {
      shadowColor: "#171716",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    level2: {
      shadowColor: "#171716",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 5,
    },
    level3: {
      shadowColor: "#171716",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
      elevation: 9,
    },
  },
  dark: {
    level0: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      borderWidth: 0,
    },
    level1: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      borderWidth: 1,
      borderColor: "#3A3733",
    },
    level2: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      borderWidth: 1,
      borderColor: "#4D4943",
    },
    level3: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      borderWidth: 1,
      borderColor: "#777064",
    },
  },
} as const;

export const iconography = {
  library: "lucide-react-native",
  strokeWidth: 1.75,
  size: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
  },
  touchTarget: 44,
} as const;

export const motion = {
  duration: {
    instant: 0,
    pressIn: 90,
    fast: 120,
    standard: 180,
    emphasis: 260,
    slow: 360,
    reduced: 80,
  },
  easing: {
    standard: [0.2, 0, 0, 1],
    enter: [0.16, 1, 0.3, 1],
    exit: [0.4, 0, 1, 1],
    linear: [0, 0, 1, 1],
  },
  press: { scale: 0.98 }, // sunline-redesign D10: §8.1 pressed motion of every button
  microinteraction: {
    expenseSaved: {
      pressScale: 0.98,
      pressDuration: 90,
      checkFadeDuration: 160,
      snackbarEnterDuration: 220,
    },
    planGenerated: {
      cardEnterDuration: 220,
      cardStagger: 45,
      maxStaggeredCards: 6,
    },
    activityLocked: {
      lockScaleFrom: 0.92,
      lockScaleTo: 1,
      duration: 180,
    },
    welcomeRevealed: { itemDuration: 500 }, // theme-split-and-profile-prefill D13
    skeletonPulse: { duration: 1200, minOpacity: 0.5 }, // sunline-redesign D5, profile-screen D9
    groupSplitRevealed: {
      laneOffset: 16,
      duration: 260,
      labelFadeDuration: 180,
    },
  },
} as const;

export const tokens = {
  primitives,
  colors,
  partnerBrand,
  typography,
  spacing,
  radii,
  layout,
  elevation,
  components,
  screenMetrics,
  iconography,
  motion,
} as const;

export type ThemeMode = keyof typeof colors;
export type ThemeColors = (typeof colors)[ThemeMode];
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type TypographyStyleName = keyof typeof typography.styles;
export type ElevationLevel = keyof typeof elevation.light;
export type ComponentTokenGroup = keyof typeof components;
export type IconSize = keyof typeof iconography.size;
