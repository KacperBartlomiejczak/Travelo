import { useIsFocused, useRouter } from 'expo-router';
import { useDrawerStatus } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { Fragment, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { LayoverLabel } from '@/components/LayoverLabel';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SyncIndicator } from '@/components/SyncIndicator';
import { TextButton } from '@/components/TextButton';
import { TripHero } from '@/components/TripHero';
import { usePillClearance } from '@/features/nav/usePillClearance';
import { PhotoStrip } from '@/features/trip-photos/PhotoStrip';
import { useIsTripOwner, useMyProfileId } from '@/hooks/useProfile';
import { useTripPhotos } from '@/hooks/useTripPhotos';
import { formatLocalShort } from '@/lib/date-time';
import { savedLayoverMinutes } from '@/lib/layovers';
import { formatMoney } from '@/lib/money';
import { isoToLocal } from '@/lib/time';
import { perPersonPerDay, tripDayCount } from '@/lib/trip-days';
import { useIsOffline, useRequestBudgetSync } from '@/providers/BudgetSync';
import type { FlightSegment, SyncStatus, TripOverview } from '@/schemas';
import { darkTheme } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';

import { BudgetSheet } from './BudgetSheet';
import { DeleteTripSheet } from './DeleteTripSheet';
import { HeroMenuButton } from './HeroMenuButton';
import { TripDetailsSheet } from './TripDetailsSheet';
import { TripMenuButton } from './TripMenuButton';
import { TripMenuSheet } from './TripMenuSheet';

type Props = { overview: TripOverview; budgetSyncStatus: SyncStatus; onOpenMenu: () => void; onDeleted: () => void };

// One sheet at a time (trip-edit-menu A6): choosing a menu item swaps the menu's Modal for the next sheet's in one
// render (D16; the device check decides if that is enough).
type Sheet = 'menu' | 'details' | 'budget' | 'delete';

// Home screen with a trip (D4, A5): the hero, then flights, travellers and budget — data only.
// Follows the phone's theme: the photo fades into the theme's background and the content continues on it
// (theme-split D1, D6; reverses trip-flight-tabs-name-cover A4).
// A new trip starts from the side panel; the menu button stays over the photo (trips-drawer D4, P5).
// A friend linked by code sees the same trip read-only (friend-invite A3): no ⋮ menu, no budget "Zmień", no add-photo tile.
export function CurrentTrip({ overview, budgetSyncStatus, onOpenMenu, onDeleted }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const clearance = usePillClearance();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { spacing, colors } = theme;
  const side = width < theme.breakpoints.compact ? spacing[4] : spacing[5];
  const { trip, members, segments, organizerUsername } = overview;
  const owner = useIsTripOwner(trip.ownerId);
  const myId = useMyProfileId();
  // A member of a trip without photos gets no strip and no space for it (friend-invite D17); the owner keeps the add tile.
  // The same query as the strip's, so it asks the server once.
  const photoCount = useTripPhotos(trip.id).data?.length;
  const noPhotosToShow = !owner && photoCount === 0;
  // The screen stays mounted under the wizard; only the focused screen may keep the bar light. Over the open
  // side panel, which follows the system theme, the bar follows it too (trips-drawer A7).
  const focused = useIsFocused();
  const panelOpen = useDrawerStatus() === 'open';
  const offline = useIsOffline();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const closeSheet = () => setSheet(null);

  return (
    <View testID="home-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={focused && !panelOpen ? 'light' : 'auto'} />
      {/* First, so screen readers reach the navigation before the trip (§15); drawn above the photo. */}
      <HeroMenuButton onPress={onOpenMenu} />
      {owner && <TripMenuButton onPress={() => setSheet('menu')} />}
      {/* The pill floats over the scene: the last card ends above it. Offline, the banner below already clears the pill. */}
      <ScrollView testID="home-scroll" contentContainerStyle={{ paddingBottom: offline ? spacing[6] : clearance + spacing[4] }}>
        <TripHero trip={trip} />
        {/* Its own wrapper, not the padded column: the row scrolls sideways and pads itself by `side` (trip-photos P1). */}
        {!noPhotosToShow && (
          <View
            testID="home-photos"
            style={{ width: '100%', maxWidth: theme.size.maxContentWidth, alignSelf: 'center', marginBottom: spacing[4] }}
          >
            <PhotoStrip
              tripId={trip.id}
              sidePadding={side}
              readOnly={!owner}
              onOpenPhoto={(photoId) => router.push({ pathname: '/trips/[tripId]/photos', params: { tripId: trip.id, photoId } })}
            />
          </View>
        )}
        <View style={{ gap: spacing[4], paddingHorizontal: side, width: '100%', maxWidth: theme.size.maxContentWidth, alignSelf: 'center' }}>
          <Section testID="home-flights" title={t('home.flights')}>
            <Direction label={t('newTrip.flights.outbound')} segments={segments.filter((s) => s.direction === 'outbound')} />
            <Direction label={t('newTrip.flights.return')} segments={segments.filter((s) => s.direction === 'return')} />
          </Section>
          <Section testID="home-travellers" title={t('newTrip.summary.travellers', { count: trip.travellerCount })}>
            {/* A linked member sees the organizer first, then themselves, then the others (friend-invite D4, D15). */}
            {!owner && <Body>{organizerUsername ? t('home.organizer', { name: organizerUsername }) : t('home.organizerUnknown')}</Body>}
            <Body>{t('newTrip.summary.you')}</Body>
            {members
              .filter((member) => owner || member.userId !== myId)
              .map((member) => (
                <Body key={member.id}>{member.displayName}</Body>
              ))}
          </Section>
          <Budget trip={trip} syncStatus={budgetSyncStatus} onChangeBudget={owner ? () => setSheet('budget') : undefined} />
        </View>
      </ScrollView>
      {sheet === 'menu' && (
        <TripMenuSheet
          offline={offline}
          onEditDetails={() => setSheet('details')}
          onChangeBudget={() => setSheet('budget')}
          onDelete={() => setSheet('delete')}
          onClose={closeSheet}
        />
      )}
      {sheet === 'details' && <TripDetailsSheet trip={trip} onClose={closeSheet} />}
      {sheet === 'budget' && <BudgetSheet trip={trip} onClose={closeSheet} />}
      {sheet === 'delete' && <DeleteTripSheet trip={trip} onClose={closeSheet} onDeleted={onDeleted} />}
      {offline && (
        <View
          testID="home-action"
          style={{
            width: '100%',
            maxWidth: theme.size.maxContentWidth,
            alignSelf: 'center',
            paddingHorizontal: side,
            paddingTop: spacing[3],
            paddingBottom: clearance + spacing[3],
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
  // Light: white with the card shadow, like the wizard's Card (theme-split D7). Dark: the secondary surface, because the
  // default surface is close to the background itself; no shadow there (elevation.card is empty in dark).
  const surface = theme === darkTheme ? theme.colors.surface.secondary : theme.colors.surface.default;
  return (
    <View
      testID={testID}
      style={[{ backgroundColor: surface, borderRadius: theme.radius.lg, padding: theme.spacing[4], gap: theme.spacing[3] }, theme.elevation.card]}
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

type BudgetProps = { trip: TripOverview['trip']; syncStatus: SyncStatus; onChangeBudget?: () => void };

function Budget({ trip, syncStatus, onChangeBudget }: BudgetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const requestSync = useRequestBudgetSync();
  const locale = i18n.language;
  const perPerson = trip.budgetPerPerson;
  const perDay = formatMoney(perPersonPerDay(perPerson, tripDayCount(trip.startDate, trip.endDate)), locale);
  return (
    <Section
      testID="home-budget"
      title={t('newTrip.summary.budgetTitle')}
      action={
        onChangeBudget && (
          <TextButton
            variant="ghost"
            label={t('newTrip.summary.change')}
            accessibilityLabel={t('home.changeBudget')}
            onPress={onChangeBudget}
          />
        )
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
    </Section>
  );
}
