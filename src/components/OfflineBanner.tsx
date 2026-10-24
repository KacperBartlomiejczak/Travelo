import { WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const { offlineBanner } = tokens.components;

// Persistent compact banner while the phone is offline (design-context §10.4 "Global OfflineBanner", trips-supabase D11):
// info colors, 20dp WifiOff icon and explicit text.
export function OfflineBanner() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      testID="offline-banner"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing[2],
        minHeight: offlineBanner.minHeight,
        paddingHorizontal: offlineBanner.horizontalPadding,
        paddingVertical: offlineBanner.verticalPadding,
        borderRadius: tokens.radii.sm,
        backgroundColor: theme.semantic.info.background,
      }}
    >
      <WifiOff
        testID="offline-banner-icon"
        size={tokens.iconography.size.sm}
        strokeWidth={tokens.iconography.strokeWidth}
        color={theme.semantic.info.foreground}
        aria-hidden
      />
      <Text style={[tokens.typography.styles.bodySM, { color: theme.semantic.info.foreground, flexShrink: 1 }]}>
        {t('offline.banner')}
      </Text>
    </View>
  );
}
