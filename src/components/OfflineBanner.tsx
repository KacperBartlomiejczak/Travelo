import { WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

// Persistent compact banner while the phone is offline (design-context §12 "Offline", trips-supabase D11).
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
        gap: theme.spacing[2],
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surface.elevated,
      }}
    >
      <WifiOff size={theme.size.iconInline} strokeWidth={theme.size.iconStroke} color={theme.colors.status.info} aria-hidden />
      <Text style={[theme.typography.bodyS, { color: theme.colors.text.primary, flexShrink: 1 }]}>{t('offline.banner')}</Text>
    </View>
  );
}
