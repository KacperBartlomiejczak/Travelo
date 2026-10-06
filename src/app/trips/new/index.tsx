import { Plus, Ticket } from 'lucide-react-native';
import { Fragment, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View, type ScrollView } from 'react-native';

import { LayoverLabel } from '@/components/LayoverLabel';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Stepper } from '@/components/Stepper';
import { TextButton } from '@/components/TextButton';
import { addLayover, withOutbound, type SegmentDraft } from '@/features/trip-create/draft';
import { fieldErrors } from '@/features/trip-create/field-errors';
import { SegmentCard } from '@/features/trip-create/SegmentCard';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import { useGoToNextStep, WizardScreen } from '@/features/trip-create/WizardScreen';
import { layoverMinutes } from '@/lib/layovers';
import { FlightsStepInputSchema, MAX_COMPANIONS } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

type Direction = 'outbound' | 'return';

// Step 1 — when and where the group flies (D3, D4, D24, D25).
export default function FlightsStep() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { draft, setDraft, setCompanionCount } = useTripDraft();
  const goNext = useGoToNextStep('flights');
  // Errors appear after the first "Next" and then follow every change.
  const [submitted, setSubmitted] = useState(false);
  const input = { outbound: draft.outbound, return: draft.return, companionCount: draft.companionCount };
  const errors = submitted ? fieldErrors(FlightsStepInputSchema.safeParse(input)) : {};
  // One direction at a time; the outbound first (trip-flight-tabs-name-cover).
  const [shown, setShown] = useState<Direction>('outbound');
  // Section and card offsets, to scroll to the first card with an error (D29).
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef(0);
  const cardY = useRef<Record<string, number>>({});
  // A card on the other tab is measured only once it is shown; scroll when it is (D5).
  const scrollPending = useRef<string | null>(null);

  function scrollToCard(key: string) {
    const y = sectionY.current + (cardY.current[key] ?? 0);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - theme.spacing[4]), animated: true });
  }

  function setSegments(direction: Direction, segments: SegmentDraft[]) {
    setDraft((current) => (direction === 'outbound' ? withOutbound(current, segments) : { ...current, return: segments }));
  }

  function next() {
    setSubmitted(true);
    const result = FlightsStepInputSchema.safeParse(input);
    if (result.success) {
      goNext();
      return;
    }
    AccessibilityInfo.announceForAccessibility(t('newTrip.fixErrors'));
    const failed = fieldErrors(result);
    const directions: Direction[] = ['outbound', 'return'];
    for (const direction of directions) {
      const index = draft[direction].findIndex((_, i) => Object.keys(failed).some((key) => key.startsWith(`${direction}.${i}.`)));
      if (index >= 0) {
        const key = draft[direction][index].key;
        if (direction === shown) {
          scrollToCard(key);
        } else {
          scrollPending.current = key;
          setShown(direction);
        }
        return;
      }
    }
  }

  function errorFor(direction: Direction, index: number, ...fields: string[]): string | undefined {
    const key = fields.map((field) => errors[`${direction}.${index}.${field}`]).find(Boolean);
    return key ? t(key) : undefined;
  }

  function section(direction: Direction) {
    const segments = draft[direction];
    const title = t(direction === 'outbound' ? 'newTrip.flights.outbound' : 'newTrip.flights.return');
    return (
      <View
        testID={`${title}-section`}
        onLayout={(event) => (sectionY.current = event.nativeEvent.layout.y)}
        style={{ gap: theme.spacing[3] }}
      >
        <Text accessibilityRole="header" style={[theme.typography.heading3, { color: theme.colors.text.primary }]}>
          {title}
        </Text>
        {segments.map((segment, index) => {
          const previous = segments[index - 1];
          const layover = previous ? layoverMinutes(previous, segment) : null;
          const cardTitle = t('newTrip.flights.segment', { number: index + 1 });
          return (
            <Fragment key={segment.key}>
              {previous && layover !== null && <LayoverLabel minutes={layover} airportIata={previous.toIata} />}
              <SegmentCard
                testID={`${title}-${cardTitle}`}
                title={cardTitle}
                segment={segment}
                suggestedDeparture={previous?.arriveAt || undefined}
                onLayout={(event) => {
                  cardY.current[segment.key] = event.nativeEvent.layout.y;
                  if (scrollPending.current === segment.key) {
                    scrollPending.current = null;
                    scrollToCard(segment.key);
                  }
                }}
                errors={{
                  from: errorFor(direction, index, 'fromIata', 'departTz'),
                  to: errorFor(direction, index, 'toIata', 'arriveTz'),
                  departAt: errorFor(direction, index, 'departAt'),
                  arriveAt: errorFor(direction, index, 'arriveAt'),
                  flightNumber: errorFor(direction, index, 'flightNumber'),
                }}
                onChange={(changed) => setSegments(direction, segments.map((s, i) => (i === index ? changed : s)))}
                onRemove={index > 0 ? () => setSegments(direction, segments.filter((_, i) => i !== index)) : undefined}
              />
            </Fragment>
          );
        })}
        <View style={{ alignItems: 'flex-start' }}>
          <TextButton
            variant="ghost"
            icon={Plus}
            label={t('newTrip.flights.addLayover')}
            onPress={() => setSegments(direction, addLayover(segments))}
          />
        </View>
      </View>
    );
  }

  return (
    <WizardScreen step="flights" scrollRef={scrollRef} action={{ label: t('newTrip.next'), onPress: next }}>
      <Text accessibilityRole="header" style={[theme.typography.heading2, { color: theme.colors.text.primary }]}>
        {t('newTrip.flights.heading')}
      </Text>
      {/* D2: ticket parsing comes later; the button is visible but disabled. */}
      <TextButton variant="secondary" icon={Ticket} label={t('newTrip.flights.ticket')} disabled onPress={() => {}} />
      <SegmentedControl
        label={t('newTrip.flights.direction')}
        options={[
          { value: 'outbound', label: t('newTrip.flights.outbound') },
          { value: 'return', label: t('newTrip.flights.return') },
        ]}
        value={shown}
        onChange={setShown}
      />
      {section(shown)}
      <Stepper
        label={t('newTrip.flights.companions')}
        value={draft.companionCount}
        min={0}
        max={MAX_COMPANIONS}
        onChange={setCompanionCount}
      />
    </WizardScreen>
  );
}
