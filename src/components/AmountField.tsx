import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { Field, inputBorder } from './Field';

type Props = {
  label: string;
  /** The amount as typed. */
  amountText: string;
  currency: string;
  onChangeText: (text: string) => void;
  error?: string;
};

const AMOUNT_HEIGHT = 64; // §10.5

// Amount + its currency code side by side (§10.5); money is never shown without a currency.
export function AmountField({ label, amountText, currency, onChangeText, error }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} error={error}>
      <View
        testID="amount-field-box"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[2],
          minHeight: AMOUNT_HEIGHT,
          paddingHorizontal: theme.spacing[4],
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surface.default,
          ...inputBorder(theme, { focused, error: Boolean(error) }),
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
          placeholderTextColor={theme.colors.text.tertiary}
          style={[
            theme.typography.numericXL,
            { flex: 1, minWidth: 0, color: theme.colors.text.primary, outlineStyle: 'solid', outlineWidth: 0 },
          ]}
        />
        <Text style={[theme.typography.numericM, { color: theme.colors.text.secondary, flexShrink: 0 }]}>{currency}</Text>
      </View>
    </Field>
  );
}
