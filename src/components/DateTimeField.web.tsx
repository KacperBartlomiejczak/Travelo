import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import type { DateTimeFieldProps } from './DateTimeFieldBase';
import { Field, inputBoxStyle } from './Field';

// Web: the browser's date-time input (the @expo/ui picker renders nothing on web).
export function DateTimeField({ label, value, onChange, error }: DateTimeFieldProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const [focused, setFocused] = useState(false);
  const box = inputBoxStyle(theme, { focused, error: Boolean(error) });
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
          minHeight: box.minHeight,
          padding: `0 ${box.paddingHorizontal}px`,
          borderRadius: box.borderRadius,
          border: `${box.borderWidth}px solid ${box.borderColor}`,
          outline: 'none',
          backgroundColor: box.backgroundColor,
          color: theme.text.primary,
          fontFamily: tokens.typography.styles.bodyLG.fontFamily,
          fontSize: tokens.typography.styles.bodyLG.fontSize,
          colorScheme: scheme === 'dark' ? 'dark' : 'light',
        }}
      />
    </Field>
  );
}
