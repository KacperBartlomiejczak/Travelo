import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';

import { AirportField } from '@/components/AirportField';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextButton } from '@/components/TextButton';
import {
  type Airport,
  type GenerateTripPlanRequest,
  GenerateTripPlanRequestSchema,
  MAX_EXTRA_CITIES,
  PLAN_RADII_KM,
  type PlanPreference,
} from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  tripId: string;
  destination: Airport;
  onSubmit: (request: GenerateTripPlanRequest) => void;
  onCancel: () => void;
  /** False while the Plan screen is not focused, so system Back is left to other screens. */
  backActive?: boolean;
};

type ScopeChoice = 'city_only' | 'nearby';
type Radius = (typeof PLAN_RADII_KM)[number];
const DEFAULT_RADIUS_KM: Radius = 100;

const { chip, focusRing } = tokens.components;
const { spacing, typography } = tokens;

const PREFERENCES: { value: PlanPreference; key: string }[] = [
  { value: 'pace_relaxed', key: 'relaxed' },
  { value: 'pace_intense', key: 'intense' },
  { value: 'more_food', key: 'food' },
  { value: 'no_museums', key: 'noMuseums' },
];
const PACE_OPPOSITE: Partial<Record<PlanPreference, PlanPreference>> = {
  pace_relaxed: 'pace_intense',
  pace_intense: 'pace_relaxed',
};

// A chosen extra city; removing it is one 44dp target (the chip is 36dp visually, hitSlop covers the rest).
function CityTag({ airport, onRemove }: { airport: Airport; onRemove: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const slop = (chip.touchHeight - chip.visualHeight) / 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('plan.wizard.cities.remove', { city: airport.city })}
      hitSlop={{ top: slop, bottom: slop, left: 0, right: 0 }}
      onPress={onRemove}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: chip.visualHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: chip.iconGap,
        paddingHorizontal: chip.horizontalPadding,
        borderRadius: chip.radius,
        borderWidth: focused ? focusRing.width : chip.borderWidth,
        borderColor: focused ? theme.border.focus : theme.border.default,
        backgroundColor: pressed ? theme.background.sunken : theme.surface.primary,
      })}
    >
      <Text style={[typography.styles.labelMD, { color: theme.text.primary }]}>{airport.city}</Text>
      <X size={tokens.iconography.size.xs} strokeWidth={tokens.iconography.strokeWidth} color={theme.text.secondary} aria-hidden />
    </Pressable>
  );
}

// The AI plan form (ai-trip-plan D2, D4-D7): one centered form, all sections under each other, no steps and no transitions.
export function PlanWizard({ tripId, destination, onSubmit, onCancel, backActive = true }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [scope, setScope] = useState<ScopeChoice>('city_only');
  const [radiusKm, setRadiusKm] = useState<Radius>(DEFAULT_RADIUS_KM);
  const [cities, setCities] = useState<Airport[]>([]);
  const [cityError, setCityError] = useState<string | undefined>();
  const [preferences, setPreferences] = useState<PlanPreference[]>([]);

  // System Back acts like the Cancel button (ai-trip-plan D24).
  useEffect(() => {
    if (!backActive) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => subscription.remove();
  });

  function addCity(airport: Airport | null) {
    if (!airport) return;
    if (airport.iata === destination.iata || cities.some((c) => c.iata === airport.iata)) {
      setCityError(t('plan.wizard.cities.invalid'));
      return;
    }
    setCityError(undefined);
    setCities([...cities, airport]);
  }

  function togglePreference(value: PlanPreference) {
    setPreferences((current) =>
      current.includes(value)
        ? current.filter((p) => p !== value)
        : [...current.filter((p) => p !== PACE_OPPOSITE[value]), value],
    );
  }

  function submit() {
    const request = GenerateTripPlanRequestSchema.safeParse({
      tripId,
      scope: scope === 'nearby' ? { kind: 'nearby', radiusKm } : { kind: 'city_only' },
      extraCities: cities.map((c) => c.iata),
      preferences,
      locale: i18n.language.startsWith('pl') ? 'pl' : 'en',
    });
    if (request.success) onSubmit(request.data);
  }

  const title = (text: string) => (
    <Text accessibilityRole="header" style={[typography.styles.headingLG, { color: theme.text.primary, textAlign: 'center' }]}>
      {text}
    </Text>
  );
  const hint = (text: string) => (
    <Text style={[typography.styles.bodyMD, { color: theme.text.secondary, textAlign: 'center' }]}>{text}</Text>
  );
  const section = { gap: spacing[4] } as const;
  const chipRow = { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[2] } as const;

  return (
    <ScrollView
      testID="plan-wizard"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: spacing[6] }}
    >
      <View style={section}>
        {title(t('plan.wizard.scope.title'))}
        <SegmentedControl
          label={t('plan.wizard.scope.label')}
          options={[
            { value: 'city_only', label: t('plan.wizard.scope.only', { city: destination.city }) },
            { value: 'nearby', label: t('plan.wizard.scope.nearby') },
          ]}
          value={scope}
          onChange={setScope}
        />
      </View>
      {scope === 'nearby' && (
        <View style={section}>
          {title(t('plan.wizard.radius.title'))}
          <SegmentedControl
            label={t('plan.wizard.radius.label')}
            options={PLAN_RADII_KM.map((km) => ({ value: String(km), label: t('plan.wizard.radius.option', { km }) }))}
            value={String(radiusKm)}
            onChange={(value) => setRadiusKm(Number(value) as Radius)}
          />
        </View>
      )}
      <View style={section}>
        {title(t('plan.wizard.cities.title'))}
        {hint(t('plan.wizard.cities.hint', { max: MAX_EXTRA_CITIES }))}
        {cities.length > 0 && (
          <View style={chipRow}>
            {cities.map((airport) => (
              <CityTag
                key={airport.iata}
                airport={airport}
                onRemove={() => setCities(cities.filter((c) => c.iata !== airport.iata))}
              />
            ))}
          </View>
        )}
        {cities.length < MAX_EXTRA_CITIES && (
          <AirportField label={t('plan.wizard.cities.field')} iata="" onSelect={addCity} error={cityError} onQueryChange={() => setCityError(undefined)} />
        )}
      </View>
      <View style={section}>
        {title(t('plan.wizard.preferences.title'))}
        {hint(t('plan.wizard.preferences.hint'))}
        <View style={chipRow}>
          {PREFERENCES.map(({ value, key }) => (
            <Chip
              key={value}
              label={t(`plan.wizard.preferences.${key}`)}
              selected={preferences.includes(value)}
              onToggle={() => togglePreference(value)}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: spacing[2] }}>
        <PrimaryButton label={t('plan.wizard.submit')} onPress={submit} />
        <TextButton variant="ghost" label={t('plan.wizard.cancel')} onPress={onCancel} />
      </View>
    </ScrollView>
  );
}
