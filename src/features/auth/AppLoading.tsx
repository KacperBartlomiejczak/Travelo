import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkeletonBlock } from '@/components/SkeletonBlock';
import { HomeSkeleton } from '@/features/home/HomeSkeleton';
import { usePillBottomOffset } from '@/features/nav/usePillClearance';
import { useTheme } from '@/theme/useTheme';

// What the gate shows while the session or the profile is read and the splash screen is already gone, e.g. right after
// signing in (app-loading-skeleton D2, A3, A4): always the home skeleton, because the app does not know yet whether the
// account is new. The drawer and the tabs do not exist in the gate, so the menu button and the pill navigation are
// placeholders with the real ones' geometry (`HeroMenuButton`, `PillNav`), and nothing moves when the app takes over.
// The two placeholders use `colors.input.border` in both schemes: unlike the default skeleton colour (which equals the
// border) they stay visible over the hero skeleton, the page and the cards (app-loading-skeleton D6; profile-screen D24, D25, D27).
// Busy and labelled for screen readers; every block inside is hidden from them.
const ABOVE_CONTENT = 1;

export function AppLoading() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pillBottom = usePillBottomOffset();
  const { spacing, size, radius, colors } = theme;
  const chrome = colors.input.border;
  const side = width < theme.breakpoints.compact ? spacing[4] : spacing[5];
  return (
    <View
      testID="app-loading"
      accessible
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('app.loading')}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={{ position: 'absolute', zIndex: ABOVE_CONTENT, top: insets.top + spacing[2], left: side }}>
        <SkeletonBlock testID="app-loading-menu" width={size.touchTarget} height={size.touchTarget} radius={radius.full} color={chrome} />
      </View>
      <HomeSkeleton />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: pillBottom, alignItems: 'center' }}>
        <SkeletonBlock
          testID="app-loading-pill"
          width={Math.min(width - 2 * spacing[4], size.maxContentWidth)}
          height={size.navPill}
          radius={radius.full}
          color={chrome}
        />
      </View>
    </View>
  );
}
