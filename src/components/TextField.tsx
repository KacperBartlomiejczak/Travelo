import { useState, type Ref } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { Field, inputBoxStyle, inputTextStyle } from './Field';

type Props = Pick<
  TextInputProps,
  | 'placeholder'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'keyboardType'
  | 'maxLength'
  | 'autoComplete'
  | 'textContentType'
  | 'autoFocus'
  | 'editable'
  | 'returnKeyType'
  | 'onSubmitEditing'
> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  optional?: boolean;
  error?: string;
  /** Lets a screen focus the input, e.g. to correct a wrong code. */
  inputRef?: Ref<TextInput>;
};

export function TextField({ label, value, onChangeText, optional, error, inputRef, ...inputProps }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} optional={optional} error={error}>
      <TextInput
        {...inputProps}
        ref={inputRef}
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={theme.colors.text.tertiary}
        style={[
          inputBoxStyle(theme, { focused, error: Boolean(error) }),
          // §10.4: a disabled input is neutral.100.
          inputProps.editable === false && { backgroundColor: theme.colors.surface.secondary },
          inputTextStyle(theme),
        ]}
      />
    </Field>
  );
}
