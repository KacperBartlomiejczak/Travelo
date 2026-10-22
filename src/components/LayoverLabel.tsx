import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { formatDuration } from '@/lib/layovers';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// Layover label between two flight segments (§8.12): Clock icon + text in the neutral info color (the warning palette
// waits for a product threshold).
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
  const color = theme.semantic.info.foreground;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[1], paddingLeft: inset ? tokens.spacing[4] : tokens.spacing[0] }}>
      <Clock
        testID="layover-icon"
        size={tokens.iconography.size.xs}
        strokeWidth={tokens.iconography.strokeWidth}
        color={color}
        aria-hidden
      />
      <Text style={[tokens.typography.styles.labelMD, { color }]}>
        {t('layover', { duration: formatDuration(minutes, t), airport: airportIata })}
      </Text>
    </View>
  );
}
