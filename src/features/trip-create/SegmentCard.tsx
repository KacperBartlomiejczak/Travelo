import { useTranslation } from 'react-i18next';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import { AirportField } from '@/components/AirportField';
import { Card } from '@/components/Card';
import { DateTimeField } from '@/components/DateTimeField';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/theme/useTheme';

import type { SegmentDraft } from './draft';

type Field = 'from' | 'to' | 'departAt' | 'arriveAt' | 'flightNumber';

type Props = {
  title: string;
  segment: SegmentDraft;
  onChange: (segment: SegmentDraft) => void;
  /** Translated error per field. */
  errors: Partial<Record<Field, string>>;
  /** Where the departure picker starts when empty (e.g. the previous segment's arrival). */
  suggestedDeparture?: string;
  onRemove?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
};

// One flight segment as a card (D24, D27).
export function SegmentCard({ title, segment, onChange, errors, suggestedDeparture, onRemove, onLayout, testID }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const set = (patch: Partial<SegmentDraft>) => onChange({ ...segment, ...patch });

  return (
    <Card testID={testID} onLayout={onLayout}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: theme.size.touchTarget }}>
        <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary }]}>{title}</Text>
        {onRemove && <TextButton variant="ghost" label={t('newTrip.flights.remove')} onPress={onRemove} />}
      </View>
      <AirportField
        label={t('newTrip.flights.from')}
        iata={segment.fromIata}
        error={errors.from}
        onSelect={(airport) => set({ fromIata: airport?.iata ?? '', departTz: airport?.timezone ?? '' })}
      />
      <AirportField
        label={t('newTrip.flights.to')}
        iata={segment.toIata}
        error={errors.to}
        onSelect={(airport) => set({ toIata: airport?.iata ?? '', arriveTz: airport?.timezone ?? '' })}
      />
      <DateTimeField
        label={t('newTrip.flights.departAt')}
        value={segment.departAt}
        suggested={suggestedDeparture}
        error={errors.departAt}
        onChange={(departAt) => set({ departAt })}
      />
      <DateTimeField
        label={t('newTrip.flights.arriveAt')}
        value={segment.arriveAt}
        suggested={segment.departAt || undefined}
        error={errors.arriveAt}
        onChange={(arriveAt) => set({ arriveAt })}
      />
      <TextField
        label={t('newTrip.flights.flightNumber')}
        optional
        value={segment.flightNumber ?? ''}
        error={errors.flightNumber}
        autoCapitalize="characters"
        autoCorrect={false}
        onChangeText={(flightNumber) => set({ flightNumber })}
      />
    </Card>
  );
}
