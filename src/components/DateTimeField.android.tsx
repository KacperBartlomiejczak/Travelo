import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { getCalendars } from 'expo-localization';
import { useState } from 'react';

import { androidDateValue, androidResultToLocal, androidTimeValue } from '@/lib/date-time';
import { useTheme } from '@/theme/useTheme';

import { DateTimeFieldBase, fallbackSuggestion, type DateTimeFieldProps } from './DateTimeFieldBase';

// Android: a date dialog, then a time dialog (D24). Nothing is reported until both are confirmed.
export function DateTimeField({ label, value, onChange, suggested, error }: DateTimeFieldProps) {
  const theme = useTheme();
  const [stage, setStage] = useState<'date' | 'time' | null>(null);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const start = value || suggested || fallbackSuggestion();

  return (
    <DateTimeFieldBase label={label} value={value} error={error} open={stage !== null} onPress={() => setStage('date')}>
      {stage === 'date' && (
        <DateTimePicker
          mode="date"
          presentation="dialog"
          value={androidDateValue(start)}
          accentColor={theme.colors.action.primary}
          onDismiss={() => setStage(null)}
          onValueChange={(_, date) => {
            setPickedDate(date);
            setStage('time');
          }}
        />
      )}
      {stage === 'time' && pickedDate && (
        <DateTimePicker
          mode="time"
          presentation="dialog"
          value={androidTimeValue(start)}
          // D30: the device's 12/24h setting, not the app language.
          is24Hour={getCalendars()[0]?.uses24hourClock ?? undefined}
          accentColor={theme.colors.action.primary}
          onDismiss={() => setStage(null)}
          onValueChange={(_, time) => {
            onChange(androidResultToLocal(pickedDate, time));
            setStage(null);
          }}
        />
      )}
    </DateTimeFieldBase>
  );
}
