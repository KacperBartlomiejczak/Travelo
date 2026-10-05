import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import type { DateTimeFieldProps } from './DateTimeFieldBase';
import { Field, inputBorder } from './Field';

// Web: the browser's date-time input (the @expo/ui picker renders nothing on web).
export function DateTimeField({ label, value, onChange, error }: DateTimeFieldProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const [focused, setFocused] = useState(false);
  const border = inputBorder(theme, { focused, error: Boolean(error) });
  return (
    <Field label={label} error={error}>
      <input
        type="datetime-local"
        aria-label={label}
        value={value}
        onChange={(event: { target: { value: string } }) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          boxSizing: 'border-box',
          minHeight: theme.size.buttonPrimary,
          padding: `0 ${theme.spacing[4]}px`,
          borderRadius: theme.radius.sm,
          border: `${border.borderWidth}px solid ${border.borderColor}`,
          outline: 'none',
          backgroundColor: theme.colors.surface.default,
          color: theme.colors.text.primary,
          fontFamily: theme.typography.bodyM.fontFamily,
          fontSize: theme.typography.bodyM.fontSize,
          colorScheme: scheme === 'dark' ? 'dark' : 'light',
        }}
      />
    </Field>
  );
}
