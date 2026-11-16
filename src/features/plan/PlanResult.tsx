import { ExternalLink, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe } from 'react-native-reanimated';

import { AvatarGroup } from '@/components/AvatarGroup';
import { Card } from '@/components/Card';
import { TextButton } from '@/components/TextButton';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { avatarColorIndex, avatarInitial } from '@/lib/avatar-color';
import type { PlanPersonView } from '@/lib/plan-people-view';
import { mentionsPersonId } from '@/lib/plan-validate';
import { PlanSlotSchema, type PlaceDetails, type PlanPersonRef, type TripPlan } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { PlanDayPicker } from './PlanDayPicker';

type Props = {
  plan: TripPlan;
  places: Record<string, PlaceDetails>;
  cityName: (iata: string) => string;
  travellerCount: number;
  resolvePeople: (forPeople: readonly PlanPersonRef[]) => PlanPersonView[];
  onRegenerate: () => void;
  canRegenerate: boolean;
  /** Local `YYYY-MM-DD`; picks the opening day when it is a plan day. Injectable for tests. */
  today?: string;
};

const { spacing, typography, motion, layout, iconography } = tokens;
const { timeline } = tokens.components;
const { cardEnterDuration, cardStagger, maxStaggeredCards } = motion.microinteraction.planGenerated;
const SLOTS = PlanSlotSchema.options;

const localToday = () => {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// The generated plan as a one-day timeline (plan-timeline step 3): day chips, a header, then slot-ordered cards on a rail.
// No prices (D10). Cards enter per §7.5 and again when the day changes.
export function PlanResult({ plan, places, cityName, travellerCount, resolvePeople, onRegenerate, canRegenerate, today }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReduceMotion() === true;
  const { fontScale } = useWindowDimensions();
  const [picked, setPicked] = useState<number | null>(null);

  const todayIndex = plan.days.findIndex((d) => d.date === (today ?? localToday()));
  const index = picked !== null && picked < plan.days.length ? picked : Math.max(0, todayIndex);
  const day = plan.days[index];
  const at = new Date(`${day.date}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat(i18n.language, { timeZone: 'UTC', weekday: 'short' }).format(at);
  const date = new Intl.DateTimeFormat(i18n.language, { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(at);
  // Stable sort: slot order first, the plan's own order inside a slot.
  const items = [...day.items].sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));

  const entering = (i: number) =>
    reduceMotion
      ? FadeIn.duration(motion.duration.reduced)
      : new Keyframe({
          0: { opacity: 0, transform: [{ translateY: spacing[2] }] },
          100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(...motion.easing.enter) },
        })
          .duration(cardEnterDuration)
          .delay(Math.min(i, maxStaggeredCards - 1) * cardStagger);

  return (
    <ScrollView contentContainerStyle={{ gap: spacing[4] }}>
      <PlanDayPicker dates={plan.days.map((d) => d.date)} selected={index} onSelect={setPicked} />
      <View style={{ gap: spacing[1] }}>
        <Text style={[typography.styles.labelMD, { color: theme.text.secondary, textTransform: 'uppercase' }]}>
          {t('plan.result.dayHeader', { n: index + 1, weekday, date })}
        </Text>
        <Text accessibilityRole="header" style={[typography.styles.headingLG, { color: theme.text.primary }]}>
          {cityName(day.cityIata)}
        </Text>
        <Text style={[typography.styles.bodyMD, { color: theme.text.secondary }]}>{t('plan.result.travellers', { count: travellerCount })}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }}>
        <Sparkles size={iconography.size.xs} color={theme.text.secondary} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.styles.labelMD, { color: theme.text.secondary }]}>{t('plan.result.ai')}</Text>
          <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>{t('plan.result.aiHint')}</Text>
        </View>
        {canRegenerate ? <TextButton variant="ghost" label={t('plan.result.regenerate')} onPress={onRegenerate} /> : null}
      </View>
      {items.length === 0 ? (
        <Text style={[typography.styles.bodyMD, { color: theme.text.secondary }]}>{t('plan.result.emptyDay')}</Text>
      ) : (
        <View>
          {items.map((item, i) => {
            const place = places[item.placeId];
            const people = resolvePeople(item.forPeople).map((p) => ({
              ...p,
              initial: avatarInitial(p.name),
              colorIndex: avatarColorIndex(p.key, theme.avatarFallback.length),
            }));
            const firstOfSlot = i === 0 || items[i - 1].slot !== item.slot;
            return (
              <View key={`${index}-${i}`} style={{ flexDirection: 'row' }}>
                <View style={{ width: timeline.timeColumnWidth * Math.max(1, fontScale), paddingTop: spacing[4] }}>
                  {firstOfSlot ? (
                    <Text style={[typography.styles.labelSM, { color: theme.text.secondary }]}>{t(`plan.result.slot.${item.slot}`)}</Text>
                  ) : null}
                </View>
                <View aria-hidden style={{ width: timeline.railColumnWidth, alignItems: 'center' }}>
                  <View style={{ position: 'absolute', top: 0, bottom: 0, width: timeline.railWidth, backgroundColor: theme.border.default }} />
                  <View
                    style={{
                      marginTop: spacing[4],
                      width: timeline.nodeSize,
                      height: timeline.nodeSize,
                      borderRadius: timeline.nodeSize / 2,
                      backgroundColor: theme.brand.primary,
                    }}
                  />
                </View>
                <Animated.View testID={`plan-result-item-${i}`} entering={entering(i)} style={{ flex: 1, paddingBottom: spacing[3] }}>
                  <Card>
                    <View style={{ gap: spacing[1], minHeight: timeline.sharedCardMinHeight - 2 * spacing[4] }}>
                      <Text style={[typography.styles.labelLG, { color: theme.text.primary }]}>{place?.name ?? t('plan.result.unavailable')}</Text>
                      {item.reason && !mentionsPersonId(item.reason) ? (
                        <Text style={[typography.styles.bodyMD, { color: theme.text.primary }]}>{item.reason}</Text>
                      ) : null}
                      {place?.address ? <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>{place.address}</Text> : null}
                    </View>
                    {place ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={t('plan.result.openMapsLabel', { place: place.name })}
                        onPress={() => Linking.openURL(place.googleMapsUri).catch(() => {})}
                        style={{ minHeight: layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' }}
                      >
                        <ExternalLink size={iconography.size.xs} color={theme.text.brand} />
                        <Text style={[typography.styles.labelMD, { color: theme.text.brand }]}>{t('plan.result.openMaps')}</Text>
                      </Pressable>
                    ) : null}
                    <View style={{ alignSelf: 'flex-end' }}>
                      <AvatarGroup people={people} />
                    </View>
                  </Card>
                </Animated.View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
