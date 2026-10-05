import { Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { formatDateRange } from '@/lib/date-time';
import { formatMoney } from '@/lib/money';
import type { TripSummary } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

import { Card } from './Card';

// Trip card on the trips list (§10.9, D14, D39): no avatars yet, the organizer has no profile.
export function TripCard({ trip }: { trip: TripSummary }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const body = [theme.typography.bodyM, { color: theme.colors.text.secondary }];
  return (
    <Card testID={`trip-card-${trip.destination}`}>
      <Text accessibilityRole="header" style={[theme.typography.heading3, { color: theme.colors.text.primary }]}>
        {trip.name}
      </Text>
      <Text style={body}>{formatDateRange(trip.startDate, trip.endDate, i18n.language)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
        <Users size={theme.size.iconInline} strokeWidth={theme.size.iconStroke} color={theme.colors.text.secondary} aria-hidden />
        <Text style={body}>{t('trips.travellers', { count: trip.travellerCount })}</Text>
      </View>
      <Text
        accessibilityLabel={t('trips.budgetA11y', { amount: formatMoney(trip.budgetPerPerson, i18n.language) })}
        style={[theme.typography.bodyM, { color: theme.colors.text.primary }]}
      >
        {t('trips.budget', { amount: formatMoney(trip.budgetPerPerson, i18n.language) })}
      </Text>
    </Card>
  );
}
