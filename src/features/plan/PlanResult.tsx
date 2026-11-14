import { ExternalLink, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe } from 'react-native-reanimated';

import { TextButton } from '@/components/TextButton';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { mentionsPersonId } from '@/lib/plan-validate';
import { PlanSlotSchema, type PlaceDetails, type StoredPlanDay, type TripPlan } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  plan: TripPlan;
  places: Record<string, PlaceDetails>;
  cityName: (iata: string) => string;
  onRegenerate: () => void;
  canRegenerate: boolean;
};

const { spacing, typography, motion, layout, iconography } = tokens;
const { cardEnterDuration, cardStagger, maxStaggeredCards } = motion.microinteraction.planGenerated;
const SLOTS = PlanSlotSchema.options;

// The generated plan as a plain list (ai-trip-plan step 7; cards come later). No prices (D10). Day blocks enter per §7.5.
export function PlanResult({ plan, places, cityName, onRegenerate, canRegenerate }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReduceMotion() === true;
  const date = new Intl.DateTimeFormat(i18n.language, { timeZone: 'UTC', day: 'numeric', month: 'short' });

  const entering = (index: number) =>
    reduceMotion
      ? FadeIn.duration(motion.duration.reduced)
      : new Keyframe({
          0: { opacity: 0, transform: [{ translateY: spacing[2] }] },
          100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(...motion.easing.enter) },
        })
          .duration(cardEnterDuration)
          .delay(Math.min(index, maxStaggeredCards - 1) * cardStagger);

  const day = (d: StoredPlanDay, index: number) => (
    <Animated.View key={`${d.date}-${d.cityIata}`} testID={`plan-result-day-${index}`} entering={entering(index)} style={{ gap: spacing[3] }}>
      <Text accessibilityRole="header" style={[typography.styles.headingMD, { color: theme.text.primary }]}>
        {t('plan.result.day', {
          n: index + 1,
          date: date.format(new Date(`${d.date}T00:00:00Z`)),
          city: cityName(d.cityIata),
        })}
      </Text>
      {SLOTS.map((slot) => {
        const items = d.items.filter((item) => item.slot === slot);
        if (items.length === 0) return null;
        return (
          <View key={slot} style={{ gap: spacing[2] }}>
            <Text style={[typography.styles.labelMD, { color: theme.text.secondary }]}>{t(`plan.result.slot.${slot}`)}</Text>
            {items.map((item, i) => {
              const place = places[item.placeId];
              return (
                <View key={`${item.placeId}-${i}`} style={{ gap: spacing[1] }}>
                  <Text style={[typography.styles.labelLG, { color: theme.text.primary }]}>
                    {place?.name ?? t('plan.result.unavailable')}
                  </Text>
                  {place?.address ? (
                    <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>{place.address}</Text>
                  ) : null}
                  {item.reason && !mentionsPersonId(item.reason) ? <Text style={[typography.styles.bodyMD, { color: theme.text.primary }]}>{item.reason}</Text> : null}
                  {place ? (
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={t('plan.result.openMapsLabel', { place: place.name })}
                      onPress={() => Linking.openURL(place.googleMapsUri).catch(() => {})}
                      style={{
                        minHeight: layout.touchTarget,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing[2],
                        alignSelf: 'flex-start',
                      }}
                    >
                      <ExternalLink size={iconography.size.xs} color={theme.text.brand} />
                      <Text style={[typography.styles.labelMD, { color: theme.text.brand }]}>{t('plan.result.openMaps')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
    </Animated.View>
  );

  return (
    <ScrollView contentContainerStyle={{ gap: spacing[5] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <Sparkles size={iconography.size.xs} color={theme.text.secondary} />
        <Text style={[typography.styles.labelMD, { color: theme.text.secondary }]}>{t('plan.result.ai')}</Text>
      </View>
      {plan.days.map(day)}
      {canRegenerate ? <TextButton variant="secondary" label={t('plan.result.regenerate')} onPress={onRegenerate} /> : null}
    </ScrollView>
  );
}
