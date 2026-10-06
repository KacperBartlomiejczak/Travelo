import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';

import { findAirport, searchAirports } from '@/lib/airport-search';
import type { Airport } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

import { Field, inputBoxStyle, inputTextStyle } from './Field';

type Props = {
  label: string;
  /** Chosen airport's IATA code, or '' when none. */
  iata: string;
  onSelect: (airport: Airport | null) => void;
  error?: string;
};

const LIST_ROW_MIN_HEIGHT = 64; // §10.8

// Type a city or code, pick from the bundled airport list (D9).
export function AirportField({ label, iata, onSelect, error }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  // Text being typed; null shows the chosen airport.
  const [query, setQuery] = useState<string | null>(null);
  const chosen = iata ? findAirport(iata) : undefined;
  const shown = query ?? (chosen ? `${chosen.city} · ${chosen.iata}` : iata);
  const results = query ? searchAirports(query) : [];

  function type(text: string) {
    setQuery(text);
    if (iata) onSelect(null);
  }

  function choose(airport: Airport) {
    onSelect(airport);
    setQuery(null);
  }

  return (
    <Field label={label} error={error}>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        value={shown}
        onChangeText={type}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('airportField.placeholder')}
        placeholderTextColor={theme.colors.text.tertiary}
        autoCorrect={false}
        autoCapitalize="words"
        style={[inputBoxStyle(theme, { focused, error: Boolean(error) }), inputTextStyle(theme)]}
      />
      {query ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.colors.input.border,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.colors.surface.default,
            overflow: 'hidden',
          }}
        >
          {results.length === 0 ? (
            <Text style={[theme.typography.bodyM, { color: theme.colors.text.secondary, padding: theme.spacing[4] }]}>
              {t('airportField.noResults')}
            </Text>
          ) : (
            results.map((airport, index) => (
              <Pressable
                key={airport.iata}
                accessibilityRole="button"
                accessibilityLabel={`${airport.city} · ${airport.iata}, ${airport.name}`}
                onPress={() => choose(airport)}
                style={({ pressed }) => ({
                  minHeight: LIST_ROW_MIN_HEIGHT,
                  justifyContent: 'center',
                  paddingHorizontal: theme.spacing[4],
                  backgroundColor: pressed ? theme.colors.surface.secondary : undefined,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.colors.divider,
                })}
              >
                <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary }]}>
                  {`${airport.city} · ${airport.iata}`}
                </Text>
                <Text numberOfLines={1} style={[theme.typography.bodyS, { color: theme.colors.text.secondary }]}>
                  {airport.name}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </Field>
  );
}
