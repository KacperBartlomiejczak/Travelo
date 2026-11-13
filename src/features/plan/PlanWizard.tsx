import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';

import { AirportField } from '@/components/AirportField';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StepIndicator } from '@/components/StepIndicator';
import { TextButton } from '@/components/TextButton';
import { useReduceMotion } from '@/hooks/useReduceMotion';
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
};

type Card = 'scope' | 'radius' | 'cities' | 'preferences';
type ScopeChoice = 'city_only' | 'nearby';
type Radius = (typeof PLAN_RADII_KM)[number];

const { duration, easing } = tokens.motion;
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

// The question cards of the AI plan (ai-trip-plan D2, D4-D7): one card on screen, sliding sideways; fade only with reduced motion.
export function PlanWizard({ tripId, destination, onSubmit, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReduceMotion() === true;
  const [scope, setScope] = useState<ScopeChoice>('city_only');
  const [radiusKm, setRadiusKm] = useState<Radius>(PLAN_RADII_KM[0]);
  const [cities, setCities] = useState<Airport[]>([]);
  const [cityError, setCityError] = useState<string | undefined>();
  const [preferences, setPreferences] = useState<PlanPreference[]>([]);
  const [position, setPosition] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [target, setTarget] = useState(0);

  const cards: Card[] = scope === 'nearby' ? ['scope', 'radius', 'cities', 'preferences'] : ['scope', 'cities', 'preferences'];
  const card = cards[position];
  const last = position === cards.length - 1;

  // The direction is committed first and the card changes in the next render: the leaving card's exit animation is read from
  // its last committed props, so it must already carry the right direction.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the two-step commit is the point, see above
  useEffect(() => setPosition(target), [target]);
  function go(step: 1 | -1) {
    setDirection(step === 1 ? 'forward' : 'back');
    setTarget(position + step);
  }

  const slideIn = (builder: typeof SlideInRight) =>
    builder.duration(duration.emphasis).easing(Easing.bezier(...easing.enter));
  const slideOut = (builder: typeof SlideOutLeft) =>
    builder.duration(duration.emphasis).easing(Easing.bezier(...easing.exit));
  const forward = direction === 'forward';
  const entering = reduceMotion
    ? FadeIn.duration(duration.reduced)
    : slideIn(forward ? SlideInRight : SlideInLeft);
  const exiting = reduceMotion
    ? FadeOut.duration(duration.reduced)
    : slideOut(forward ? SlideOutLeft : SlideOutRight);

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
    <Text accessibilityRole="header" style={[typography.styles.headingLG, { color: theme.text.primary }]}>
      {text}
    </Text>
  );
  const hint = (text: string) => (
    <Text style={[typography.styles.bodyMD, { color: theme.text.secondary }]}>{text}</Text>
  );

  return (
    <View style={{ flex: 1, gap: spacing[4] }}>
      <StepIndicator current={position + 1} total={cards.length} />
      {/* Clipped, so the sliding card never draws outside the wizard. */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View key={card} testID={`plan-wizard-card-${card}`} entering={entering} exiting={exiting} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing[4] }}>
            {card === 'scope' && (
              <>
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
              </>
            )}
            {card === 'radius' && (
              <>
                {title(t('plan.wizard.radius.title'))}
                <SegmentedControl
                  label={t('plan.wizard.radius.label')}
                  options={PLAN_RADII_KM.map((km) => ({ value: String(km), label: t('plan.wizard.radius.option', { km }) }))}
                  value={String(radiusKm)}
                  onChange={(value) => setRadiusKm(Number(value) as Radius)}
                />
              </>
            )}
            {card === 'cities' && (
              <>
                {title(t('plan.wizard.cities.title'))}
                {hint(t('plan.wizard.cities.hint', { max: MAX_EXTRA_CITIES }))}
                {cities.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
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
                  <AirportField label={t('plan.wizard.cities.field')} iata="" onSelect={addCity} error={cityError} />
                )}
              </>
            )}
            {card === 'preferences' && (
              <>
                {title(t('plan.wizard.preferences.title'))}
                {hint(t('plan.wizard.preferences.hint'))}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                  {PREFERENCES.map(({ value, key }) => (
                    <Chip
                      key={value}
                      label={t(`plan.wizard.preferences.${key}`)}
                      selected={preferences.includes(value)}
                      onToggle={() => togglePreference(value)}
                    />
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
      <View style={{ gap: spacing[2] }}>
        <PrimaryButton label={last ? t('plan.wizard.submit') : t('plan.wizard.next')} onPress={last ? submit : () => go(1)} />
        <TextButton
          variant="ghost"
          label={position === 0 ? t('plan.wizard.cancel') : t('plan.wizard.back')}
          onPress={position === 0 ? onCancel : () => go(-1)}
        />
      </View>
    </View>
  );
}
