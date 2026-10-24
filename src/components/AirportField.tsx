import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';

import { findAirport, searchAirports } from '@/lib/airport-search';
import type { Airport } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Field, inputBoxStyle, inputCursorProps, inputTextStyle } from './Field';

type Props = {
  label: string;
  /** Chosen airport's IATA code, or '' when none. */
  iata: string;
  onSelect: (airport: Airport | null) => void;
  error?: string;
};

const { input, listRow, focusRing } = tokens.components;
const { styles } = tokens.typography;

// One result: a list row (§8.8). Pressed is background.sunken, focused a 2dp inset border.focus (paid for by the padding,
// so the text stays put); the divider above starts at the text column.
function AirportOption({ airport, first, onChoose }: { airport: Airport; first: boolean; onChoose: (airport: Airport) => void }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${airport.city} · ${airport.iata}, ${airport.name}`}
      onPress={() => onChoose(airport)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: listRow.minHeight,
        justifyContent: 'center',
        paddingHorizontal: listRow.horizontalPadding - (focused ? focusRing.width : 0),
        paddingVertical: listRow.verticalPadding - (focused ? focusRing.width : 0),
        backgroundColor: pressed ? theme.background.sunken : theme.surface.primary,
        ...(focused ? { borderWidth: focusRing.width, borderColor: theme.border.focus } : {}),
      })}
    >
      {!first && (
        <View
          testID="airport-option-divider"
          style={{
            position: 'absolute',
            top: 0,
            left: listRow.horizontalPadding,
            right: 0,
            height: input.borderWidth,
            backgroundColor: theme.border.subtle,
          }}
        />
      )}
      <Text style={[styles.labelLG, { color: theme.text.primary }]}>{`${airport.city} · ${airport.iata}`}</Text>
      <Text numberOfLines={1} style={[styles.caption, { color: theme.text.secondary }]}>
        {airport.name}
      </Text>
    </Pressable>
  );
}

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
        placeholderTextColor={theme.text.tertiary}
        {...inputCursorProps(theme)}
        autoCorrect={false}
        autoCapitalize="words"
        style={[inputBoxStyle(theme, { focused, error: Boolean(error) }), inputTextStyle(theme)]}
      />
      {query ? (
        <View
          testID="airport-field-list"
          style={{
            borderWidth: input.borderWidth,
            borderColor: theme.border.default,
            borderRadius: input.radius,
            backgroundColor: theme.surface.primary,
            overflow: 'hidden',
          }}
        >
          {results.length === 0 ? (
            <Text style={[styles.bodyMD, { color: theme.text.secondary, padding: listRow.horizontalPadding }]}>
              {t('airportField.noResults')}
            </Text>
          ) : (
            results.map((airport, index) => (
              <AirportOption key={airport.iata} airport={airport} first={index === 0} onChoose={choose} />
            ))
          )}
        </View>
      ) : null}
    </Field>
  );
}
