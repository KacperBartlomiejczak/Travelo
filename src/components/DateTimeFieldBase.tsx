import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { formatLocalDateTime } from '@/lib/date-time';
import { useTheme } from '@/theme/useTheme';

import { Field, inputBoxStyle } from './Field';

export type DateTimeFieldProps = {
  label: string;
  /** Airport-local wall clock "2026-11-02T10:15", or '' when not chosen. */
  value: string;
  onChange: (local: string) => void;
  /** Where the picker starts when the field is empty. */
  suggested?: string;
  error?: string;
};

/** Default start for an empty field: today, 12:00. */
export function fallbackSuggestion(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T12:00`;
}

// The tappable field shared by the iOS and Android pickers; `children` is the platform picker.
export function DateTimeFieldBase({
  label,
  value,
  error,
  open,
  onPress,
  children,
}: Pick<DateTimeFieldProps, 'label' | 'value' | 'error'> & { open: boolean; onPress: () => void; children?: ReactNode }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  return (
    <Field label={label} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={error}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        style={[inputBoxStyle(theme, { focused: open, error: Boolean(error) }), { justifyContent: 'center' }]}
      >
        <Text style={[theme.typography.bodyM, { color: value ? theme.colors.text.primary : theme.colors.text.tertiary }]}>
          {value ? formatLocalDateTime(value, i18n.language) : t('dateTimeField.placeholder')}
        </Text>
      </Pressable>
      {children}
    </Field>
  );
}
