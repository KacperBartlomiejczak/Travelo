import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fromPickerDate, toPickerDate } from '@/lib/date-time';
import { useTheme } from '@/theme/useTheme';

import { DateTimeFieldBase, fallbackSuggestion, type DateTimeFieldProps } from './DateTimeFieldBase';

// iOS: tapping the field shows a wheel picker under it (D24).
export function DateTimeField({ label, value, onChange, suggested, error }: DateTimeFieldProps) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const start = value || suggested || fallbackSuggestion();

  function toggle() {
    // The wheel shows a value right away, so opening an empty field takes that value.
    if (!open && !value) onChange(start);
    setOpen(!open);
  }

  return (
    <DateTimeFieldBase label={label} value={value} error={error} open={open} onPress={toggle}>
      {open && (
        <DateTimePicker
          mode="datetime"
          display="spinner"
          value={toPickerDate(start)}
          timeZoneName="UTC"
          locale={i18n.language}
          accentColor={theme.colors.action.primary}
          onValueChange={(_, date) => onChange(fromPickerDate(date))}
        />
      )}
    </DateTimeFieldBase>
  );
}
