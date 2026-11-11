import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { radii, tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// Placeholder until the subscription task (RevenueCat or an alternative) replaces it with the real entitlement.
export const IS_PRO = true;

// Small "PRO" pill next to the nick (profile-upgrade D4, D7). The brand-to-sun gradient is the one allowed decorative gradient (D14).
export function ProBadge({ pro = IS_PRO }: { pro?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const gradientId = useId();
  if (!pro) return null;

  return (
    <View
      testID="pro-badge"
      accessible
      accessibilityLabel={t('profile.proLabel')}
      style={{
        borderRadius: radii.pill,
        overflow: 'hidden',
        paddingHorizontal: tokens.spacing[2],
        paddingVertical: tokens.spacing[1],
      }}
    >
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset={0} stopColor={theme.brand.primary} />
            <Stop offset={1} stopColor={theme.accent.sun} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <Text style={[tokens.typography.styles.labelSM, { color: theme.brand.onBrand }]}>{t('profile.pro')}</Text>
    </View>
  );
}
