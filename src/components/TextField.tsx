import { useState, type Ref } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { Field, inputBoxStyle, inputCursorProps, inputTextStyle } from './Field';

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
  /** Shown under the field until an error replaces it. */
  hint?: string;
  error?: string;
  /** Lets a screen focus the input, e.g. to correct a wrong code. */
  inputRef?: Ref<TextInput>;
};

export function TextField({ label, value, onChangeText, optional, hint, error, inputRef, ...inputProps }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const disabled = inputProps.editable === false;
  return (
    <Field label={label} optional={optional} hint={hint} error={error}>
      <TextInput
        {...inputProps}
        ref={inputRef}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={theme.text.tertiary}
        {...inputCursorProps(theme)}
        style={[inputBoxStyle(theme, { focused, error: Boolean(error), disabled }), inputTextStyle(theme, disabled)]}
      />
    </Field>
  );
}
