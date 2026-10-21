import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { formatDuration } from '@/lib/layovers';
import { useTheme } from '@/theme/useTheme';

// Amber layover label between two flight segments (§10.11, D27).
// `inset` keeps the 16 dp left indent between the wizard's segment cards (trip-create-wizard D27); by default
// there is none, so the label lines up with the flight text lines on the home screen and in the summary
// (friend-invite D8).
export function LayoverLabel({
  minutes,
  airportIata,
  inset = false,
}: {
  minutes: number;
  airportIata: string;
  inset?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const color = theme.colors.status.warning;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1], paddingLeft: inset ? theme.spacing[4] : theme.spacing[0] }}>
      <Clock size={theme.size.iconInline} strokeWidth={theme.size.iconStroke} color={color} aria-hidden />
      <Text style={[theme.typography.bodyMMedium, { color }]}>
        {t('layover', { duration: formatDuration(minutes, t), airport: airportIata })}
      </Text>
    </View>
  );
}
