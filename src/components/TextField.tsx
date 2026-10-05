import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { Field, inputBoxStyle, inputTextStyle } from './Field';

type Props = Pick<TextInputProps, 'placeholder' | 'autoCapitalize' | 'autoCorrect' | 'keyboardType' | 'maxLength'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  optional?: boolean;
  error?: string;
};

export function TextField({ label, value, onChangeText, optional, error, ...inputProps }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} optional={optional} error={error}>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={theme.colors.text.tertiary}
        style={[inputBoxStyle(theme, { focused, error: Boolean(error) }), inputTextStyle(theme)]}
      />
    </Field>
  );
}
