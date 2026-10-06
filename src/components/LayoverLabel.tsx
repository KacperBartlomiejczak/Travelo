import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { formatDuration } from '@/lib/layovers';
import { useTheme } from '@/theme/useTheme';

// Amber layover label between two flight segments (§10.11, D27).
export function LayoverLabel({ minutes, airportIata }: { minutes: number; airportIata: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const color = theme.colors.status.warning;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1], paddingLeft: theme.spacing[4] }}>
      <Clock size={theme.size.iconInline} strokeWidth={theme.size.iconStroke} color={color} aria-hidden />
      <Text style={[theme.typography.bodyMMedium, { color }]}>
        {t('layover', { duration: formatDuration(minutes, t), airport: airportIata })}
      </Text>
    </View>
  );
}
