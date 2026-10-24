import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkeletonBlock } from '@/components/SkeletonBlock';
import { HomeSkeleton } from '@/features/home/HomeSkeleton';
import { usePillBottomOffset } from '@/features/nav/usePillClearance';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// What the gate shows while the session or the profile is read and the splash screen is already gone, e.g. right after
// signing in (app-loading-skeleton D2, A3, A4): always the home skeleton, because the app does not know yet whether the
// account is new. The drawer and the tabs do not exist in the gate, so the menu button and the pill navigation are
// placeholders with the real ones' geometry (`HeroMenuButton`, `PillNav`), and nothing moves when the app takes over.
// The two placeholders use `border.default` in both schemes: unlike `skeleton.base` they stay visible over the hero
// skeleton and the canvas (sunline-merge-main D1).
// Busy and labelled for screen readers; every block inside is hidden from them.
const ABOVE_CONTENT = 1;

export function AppLoading() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pillBottom = usePillBottomOffset();
  const { spacing, layout, radii, components } = tokens;
  const chrome = theme.border.default;
  const side = width < layout.compactBreakpoint ? layout.screenGutterCompact : layout.screenGutter;
  return (
    <View
      testID="app-loading"
      accessible
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('app.loading')}
      style={{ flex: 1, backgroundColor: theme.background.canvas }}
    >
      <View style={{ position: 'absolute', zIndex: ABOVE_CONTENT, top: insets.top + spacing[2], left: side }}>
        <SkeletonBlock testID="app-loading-menu" width={components.iconButton.size} height={components.iconButton.size} radius={components.iconButton.radius} color={chrome} />
      </View>
      <HomeSkeleton />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: pillBottom, alignItems: 'center' }}>
        <SkeletonBlock
          testID="app-loading-pill"
          width={Math.min(width - 2 * spacing[4], layout.maxContentWidth)}
          height={components.tabs.height}
          radius={radii.pill}
          color={chrome}
        />
      </View>
    </View>
  );
}
