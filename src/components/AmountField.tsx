import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Field, inputBoxStyle, inputCursorProps } from './Field';

type Props = {
  label: string;
  /** The amount as typed. */
  amountText: string;
  currency: string;
  onChangeText: (text: string) => void;
  error?: string;
};

const { input } = tokens.components;

// Amount + its currency code side by side (§8.5); money is never shown without a currency.
export function AmountField({ label, amountText, currency, onChangeText, error }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} error={error}>
      <View
        testID="amount-field-box"
        style={{
          ...inputBoxStyle(theme, { focused, error: Boolean(error) }),
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing[2],
          minHeight: input.amountHeight,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          value={amountText}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={theme.text.tertiary}
          {...inputCursorProps(theme)}
          style={[
            tokens.typography.styles.moneyXL,
            { flex: 1, minWidth: 0, color: theme.text.primary, outlineStyle: 'solid', outlineWidth: 0 },
          ]}
        />
        <Text style={[tokens.typography.styles.moneyMD, { color: theme.text.secondary, flexShrink: 0 }]}>{currency}</Text>
      </View>
    </Field>
  );
}
