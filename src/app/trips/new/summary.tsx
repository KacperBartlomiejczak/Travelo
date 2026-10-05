import { Redirect, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Fragment, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { LayoverLabel } from '@/components/LayoverLabel';
import { TextButton } from '@/components/TextButton';
import { toCreateTripInput, type SegmentDraft } from '@/features/trip-create/draft';
import { stepRoute, type WizardStep } from '@/features/trip-create/steps';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import { WizardScreen } from '@/features/trip-create/WizardScreen';
import { useCreateTrip } from '@/hooks/useTrips';
import { destinationName } from '@/lib/airport-search';
import { formatDateRange, formatLocalShort } from '@/lib/date-time';
import { layoverMinutes } from '@/lib/layovers';
import { formatMoney } from '@/lib/money';
import { perPersonPerDay, tripDayCount } from '@/lib/trip-days';
import { deriveTripDates } from '@/lib/trip-dates';
import { CreateTripInputSchema } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

// Step 4 — check everything, then save (D6, D38).
export default function SummaryStep() {
  const { draft, isComplete } = useTripDraft();
  const { i18n } = useTranslation();
  // Reached only through the earlier steps; an incomplete draft (e.g. a web deep link) starts over.
  if (!isComplete && !CreateTripInputSchema.safeParse(toCreateTripInput(draft, i18n.language)).success) {
    return <Redirect href="/trips/new" />;
  }
  return <Summary />;
}

function Summary() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { draft, isComplete, complete } = useTripDraft();
  const createTrip = useCreateTrip();
  const locale = i18n.language;

  // Leave only after the guard knows the trip was saved (D38: no discard question).
  useEffect(() => {
    if (isComplete) router.dismissTo('/');
  }, [isComplete, router]);

  const destination = draft.outbound[draft.outbound.length - 1].toIata;
  const { startDate, endDate } = deriveTripDates(draft);
  const days = tripDayCount(startDate, endDate);
  const travellers = draft.companionCount + 1;
  const input = toCreateTripInput(draft, locale);
  const perPerson = input.budget.budgetPerPerson;
  const perDay = formatMoney(perPersonPerDay(perPerson, days), locale);
  const text = (style: 'primary' | 'secondary') => [theme.typography.bodyM, { color: theme.colors.text[style] }];

  const goTo = (step: WizardStep) => router.dismissTo(stepRoute(step));

  function save() {
    createTrip.mutate(input, {
      onSuccess: complete,
      // The message is also shown above the button; VoiceOver needs it announced.
      onError: () => AccessibilityInfo.announceForAccessibility(t('newTrip.summary.saveError')),
    });
  }

  function segmentLines(segments: SegmentDraft[]) {
    return segments.map((segment, index) => {
      const previous = segments[index - 1];
      const layover = previous ? layoverMinutes(previous, segment) : null;
      return (
        <Fragment key={segment.key}>
          {previous && layover !== null && <LayoverLabel minutes={layover} airportIata={previous.toIata} />}
          <Text style={text('primary')}>
            {t('newTrip.summary.segment', {
              from: segment.fromIata,
              departAt: formatLocalShort(segment.departAt, locale),
              to: segment.toIata,
              arriveAt: formatLocalShort(segment.arriveAt, locale),
            })}
          </Text>
        </Fragment>
      );
    });
  }

  return (
    <WizardScreen
      step="summary"
      action={{
        label: t('newTrip.summary.create'),
        icon: Plus,
        onPress: save,
        loading: createTrip.isPending,
        error: createTrip.isError ? t('newTrip.summary.saveError') : undefined,
      }}
    >
      <Text accessibilityRole="header" style={[theme.typography.heading2, { color: theme.colors.text.primary }]}>
        {t('newTrip.summary.heading')}
      </Text>

      <SummaryCard testID="summary-trip" title={destinationName(destination)} heading onChange={() => goTo('flights')}>
        <Text style={text('secondary')}>
          {t('newTrip.summary.dateLine', {
            range: formatDateRange(startDate, endDate, locale),
            days: t('newTrip.summary.days', { count: days }),
          })}
        </Text>
        {/* Extra space above each direction so outbound and return read as separate groups. */}
        <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary, marginTop: theme.spacing[2] }]}>
          {t('newTrip.flights.outbound')}
        </Text>
        {segmentLines(draft.outbound)}
        <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary, marginTop: theme.spacing[2] }]}>
          {t('newTrip.flights.return')}
        </Text>
        {segmentLines(draft.return)}
      </SummaryCard>

      <SummaryCard
        testID="summary-travellers"
        title={t('newTrip.summary.travellers', { count: travellers })}
        onChange={() => goTo(draft.companionCount > 0 ? 'friends' : 'flights')}
      >
        <Text style={text('primary')}>{t('newTrip.summary.you')}</Text>
        {draft.friends.map((friend, index) => (
          <Text key={index} style={text('primary')}>
            {friend.interests.length > 0
              ? t('newTrip.summary.friendInterests', {
                  name: friend.displayName.trim(),
                  interests: friend.interests.map((interest) => t(`interests.${interest}`)).join(', '),
                })
              : t('newTrip.summary.friendNoInterests', { name: friend.displayName.trim() })}
          </Text>
        ))}
      </SummaryCard>

      <SummaryCard testID="summary-budget" title={t('newTrip.summary.budgetTitle')} onChange={() => goTo('budget')}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: theme.spacing[2] }}>
          <Text style={[theme.typography.numericL, { color: theme.colors.text.primary }]}>{formatMoney(perPerson, locale)}</Text>
          <Text style={text('secondary')}>{t('newTrip.summary.perPerson')}</Text>
        </View>
        <Text style={text('secondary')}>
          {travellers > 1
            ? t('newTrip.summary.totals', {
                total: formatMoney({ ...perPerson, amountMinor: perPerson.amountMinor * travellers }, locale),
                perDay,
              })
            : t('newTrip.summary.perDay', { perDay })}
        </Text>
      </SummaryCard>
    </WizardScreen>
  );
}

function SummaryCard({
  title,
  heading = false,
  onChange,
  testID,
  children,
}: {
  title: string;
  heading?: boolean;
  onChange: () => void;
  testID: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
        <Text
          accessibilityRole="header"
          style={[heading ? theme.typography.heading3 : theme.typography.bodyMMedium, { color: theme.colors.text.primary, flexShrink: 1 }]}
        >
          {title}
        </Text>
        <TextButton
          variant="ghost"
          label={t('newTrip.summary.change')}
          accessibilityLabel={t('newTrip.summary.changeSection', { section: title })}
          onPress={onChange}
        />
      </View>
      {children}
    </Card>
  );
}
