import { useIsFocused } from 'expo-router';
import { useDrawerStatus } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { Fragment, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LayoverLabel } from '@/components/LayoverLabel';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SyncIndicator } from '@/components/SyncIndicator';
import { TextButton } from '@/components/TextButton';
import { TripHero } from '@/components/TripHero';
import { formatLocalShort } from '@/lib/date-time';
import { savedLayoverMinutes } from '@/lib/layovers';
import { formatMoney } from '@/lib/money';
import { isoToLocal } from '@/lib/time';
import { perPersonPerDay, tripDayCount } from '@/lib/trip-days';
import { useIsOffline, useRequestBudgetSync } from '@/providers/BudgetSync';
import type { FlightSegment, SyncStatus, TripOverview } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

import { BudgetSheet } from './BudgetSheet';
import { HeroMenuButton } from './HeroMenuButton';

type Props = { overview: TripOverview; budgetSyncStatus: SyncStatus; onOpenMenu: () => void };

// Home screen with a trip (D4, A5): the hero, then flights, travellers and budget — data only.
// Rendered inside DarkThemeScope: the photo fades into ink and the content continues on it (A4).
// A new trip starts from the side panel; the menu button stays over the photo (trips-drawer D4, P5).
export function CurrentTrip({ overview, budgetSyncStatus, onOpenMenu }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { spacing, colors } = theme;
  const side = width < theme.breakpoints.compact ? spacing[4] : spacing[5];
  const { trip, members, segments } = overview;
  // The screen stays mounted under the wizard; only the focused screen may keep the bar light. Over the open
  // side panel, which follows the system theme, the bar follows it too (trips-drawer A7).
  const focused = useIsFocused();
  const panelOpen = useDrawerStatus() === 'open';
  const offline = useIsOffline();

  return (
    <View testID="home-screen" style={{ flex: 1, backgroundColor: colors.hero.background }}>
      <StatusBar style={focused && !panelOpen ? 'light' : 'auto'} />
      {/* First, so screen readers reach the navigation before the trip (§15); drawn above the photo. */}
      <HeroMenuButton onPress={onOpenMenu} />
      <ScrollView testID="home-scroll" contentContainerStyle={{ paddingBottom: spacing[6] }}>
        <TripHero trip={trip} />
        <View style={{ gap: spacing[4], paddingHorizontal: side, width: '100%', maxWidth: theme.size.maxContentWidth, alignSelf: 'center' }}>
          <Section testID="home-flights" title={t('home.flights')}>
            <Direction label={t('newTrip.flights.outbound')} segments={segments.filter((s) => s.direction === 'outbound')} />
            <Direction label={t('newTrip.flights.return')} segments={segments.filter((s) => s.direction === 'return')} />
          </Section>
          <Section testID="home-travellers" title={t('newTrip.summary.travellers', { count: trip.travellerCount })}>
            <Body>{t('newTrip.summary.you')}</Body>
            {members.map((member) => (
              <Body key={member.id}>{member.displayName}</Body>
            ))}
          </Section>
          <Budget trip={trip} syncStatus={budgetSyncStatus} />
        </View>
      </ScrollView>
      {offline && (
        <View
          testID="home-action"
          style={{
            width: '100%',
            maxWidth: theme.size.maxContentWidth,
            alignSelf: 'center',
            paddingHorizontal: side,
            paddingTop: spacing[3],
            paddingBottom: insets.bottom + spacing[4],
          }}
        >
          <OfflineBanner />
        </View>
      )}
    </View>
  );
}

function Section({ title, testID, action, children }: { title: string; testID: string; action?: ReactNode; children: ReactNode }) {
  const theme = useTheme();
  // Secondary surface: the default dark surface is the ink background itself.
  return (
    <View
      testID={testID}
      style={{ backgroundColor: theme.colors.surface.secondary, borderRadius: theme.radius.lg, padding: theme.spacing[4], gap: theme.spacing[3] }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
        <Text accessibilityRole="header" style={[theme.typography.heading3, { color: theme.colors.text.primary, flexShrink: 1 }]}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function Body({ children, tone = 'primary' }: { children: ReactNode; tone?: 'primary' | 'secondary' }) {
  const theme = useTheme();
  return <Text style={[theme.typography.bodyM, { color: theme.colors.text[tone] }]}>{children}</Text>;
}

function Direction({ label, segments }: { label: string; segments: FlightSegment[] }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const sorted = [...segments].sort((a, b) => a.order - b.order);
  // Stored as instants; shown as on the ticket, in each airport's time.
  const shown = (iso: string, timeZone: string) => formatLocalShort(isoToLocal(iso, timeZone), i18n.language);
  return (
    <View style={{ gap: theme.spacing[2] }}>
      <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary }]}>{label}</Text>
      {sorted.map((segment, index) => {
        const previous = sorted[index - 1];
        const layover = previous ? savedLayoverMinutes(previous, segment) : null;
        return (
          <Fragment key={segment.id}>
            {previous && layover !== null && <LayoverLabel minutes={layover} airportIata={previous.toIata} />}
            <Body>
              {t('newTrip.summary.segment', {
                from: segment.fromIata,
                departAt: shown(segment.departAt, segment.departTz),
                to: segment.toIata,
                arriveAt: shown(segment.arriveAt, segment.arriveTz),
              })}
            </Body>
          </Fragment>
        );
      })}
    </View>
  );
}

function Budget({ trip, syncStatus }: { trip: TripOverview['trip']; syncStatus: SyncStatus }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const requestSync = useRequestBudgetSync();
  const [changing, setChanging] = useState(false);
  const locale = i18n.language;
  const perPerson = trip.budgetPerPerson;
  const perDay = formatMoney(perPersonPerDay(perPerson, tripDayCount(trip.startDate, trip.endDate)), locale);
  return (
    <Section
      testID="home-budget"
      title={t('newTrip.summary.budgetTitle')}
      action={
        <TextButton
          variant="ghost"
          label={t('newTrip.summary.change')}
          accessibilityLabel={t('home.changeBudget')}
          onPress={() => setChanging(true)}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: theme.spacing[2] }}>
        <Text style={[theme.typography.numericL, { color: theme.colors.text.primary }]}>{formatMoney(perPerson, locale)}</Text>
        <Body tone="secondary">{t('newTrip.summary.perPerson')}</Body>
      </View>
      <Body tone="secondary">
        {trip.travellerCount > 1
          ? t('newTrip.summary.totals', {
              total: formatMoney({ ...perPerson, amountMinor: perPerson.amountMinor * trip.travellerCount }, locale),
              perDay,
            })
          : t('newTrip.summary.perDay', { perDay })}
      </Body>
      <SyncIndicator status={syncStatus} onRetry={requestSync} />
      {changing && <BudgetSheet trip={trip} onClose={() => setChanging(false)} />}
    </Section>
  );
}
