import { Image } from 'expo-image';
import { Check, CircleX, Plane, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { useCurrentTrip, useSelectTrip, useTripList } from '@/hooks/useTrips';
import { formatDateRange } from '@/lib/date-time';
import { deviceToday, tripSections } from '@/lib/trip-sections';
import { useIsOffline } from '@/providers/BudgetSync';
import type { TripListItem } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

type Props = { onClose: () => void; onCreate: () => void };

const SKELETON_ROWS = 3;

// The side panel (trips-drawer D4, P1): every trip in "Nadchodzące" / "Minione", the open one marked,
// "Nowa podróż" pinned at the bottom. Follows the system theme (A7).
export function TripsDrawer({ onClose, onCreate }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { spacing, colors, typography } = theme;
  const trips = useTripList();
  const currentId = useCurrentTrip().data?.overview.trip.id;
  const selectTrip = useSelectTrip();
  const offline = useIsOffline();

  // The open trip only closes the panel: choosing it again would reload the home screen for nothing.
  function open(tripId: string) {
    if (tripId !== currentId) selectTrip.mutate(tripId);
    onClose();
  }

  // A list already shown stays when a later read fails (§12); the error shows only when there is nothing to show.
  let body;
  if (trips.data && trips.data.length === 0) {
    // No trips is never an empty panel (D5).
    body = (
      <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[1] }}>
        <Text style={[typography.bodyMMedium, { color: colors.text.primary }]}>{t('trips.empty.heading')}</Text>
        <Text style={[typography.bodyS, { color: colors.text.secondary }]}>{t('trips.empty.description')}</Text>
      </View>
    );
  } else if (trips.data) {
    const { upcoming, past } = tripSections(trips.data, deviceToday(new Date()));
    body = (
      <>
        <Section id="upcoming" title={t('drawer.upcoming')} trips={upcoming} currentId={currentId} onOpen={open} />
        <Section id="past" title={t('drawer.past')} trips={past} currentId={currentId} onOpen={open} />
      </>
    );
  } else if (trips.isError) {
    body = (
      <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[3], alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <CircleX size={theme.size.iconStandard} strokeWidth={theme.size.iconStroke} color={colors.status.error} aria-hidden />
          <Text style={[typography.bodyM, { color: colors.text.primary, flexShrink: 1 }]}>{t('trips.loadError')}</Text>
        </View>
        <TextButton variant="secondary" label={t('trips.retry')} onPress={() => trips.refetch()} />
      </View>
    );
  } else {
    body = (
      <View testID="drawer-loading" accessible accessibilityLabel={t('trips.loading')} accessibilityState={{ busy: true }}>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <SkeletonRow key={index} />
        ))}
      </View>
    );
  }

  return (
    <View testID="trips-drawer" style={{ flex: 1, paddingTop: insets.top + spacing[4] }}>
      <Text accessibilityRole="header" style={[typography.heading1, { color: colors.text.primary, paddingHorizontal: spacing[4] }]}>
        {t('trips.title')}
      </Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: spacing[2] }}>
        {body}
      </ScrollView>
      <View
        testID="drawer-footer"
        style={{ paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: insets.bottom + spacing[4], gap: spacing[3] }}
      >
        {offline && <OfflineBanner />}
        <PrimaryButton label={t('drawer.newTrip')} icon={Plus} onPress={onCreate} />
      </View>
    </View>
  );
}

type SectionProps = {
  id: 'upcoming' | 'past';
  title: string;
  trips: TripListItem[];
  currentId: string | undefined;
  onOpen: (tripId: string) => void;
};

function Section({ id, title, trips, currentId, onOpen }: SectionProps) {
  const theme = useTheme();
  const { spacing } = theme;
  if (trips.length === 0) return null;
  return (
    <View testID={`drawer-section-${id}`}>
      <Text
        accessibilityRole="header"
        style={[
          theme.typography.caption,
          { color: theme.colors.text.secondary, paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2] },
        ]}
      >
        {title}
      </Text>
      {trips.map((trip, index) => (
        <TripRow key={trip.id} trip={trip} selected={trip.id === currentId} divider={index > 0} onPress={() => onOpen(trip.id)} />
      ))}
    </View>
  );
}

type RowProps = { trip: TripListItem; selected: boolean; divider: boolean; onPress: () => void };

// List row (§10.8): thumbnail, name and dates, a check on the open trip — marked by background and icon,
// never colour alone (§15).
function TripRow({ trip, selected, divider, onPress }: RowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { spacing, colors, size } = theme;
  const dates = formatDateRange(trip.startDate, trip.endDate, i18n.language);
  // The placeholder's surface also sits behind a cover, so a photo the phone has since cleared is not a hole.
  const thumbnail = { width: size.thumbnail, height: size.thumbnail, borderRadius: theme.radius.sm, backgroundColor: colors.surface.secondary };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('drawer.trip', { name: trip.name, dates })}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        // §10.8: rows are at least 64dp high.
        minHeight: spacing[16],
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2],
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: colors.divider,
        backgroundColor: pressed || selected ? colors.surface.secondary : undefined,
      })}
    >
      {trip.coverImageUri ? (
        <Image testID="trip-row-cover" aria-hidden source={{ uri: trip.coverImageUri }} contentFit="cover" style={thumbnail} />
      ) : (
        <View
          testID="trip-row-placeholder"
          aria-hidden
          style={[thumbnail, { alignItems: 'center', justifyContent: 'center' }]}
        >
          <Plane size={size.iconStandard} strokeWidth={size.iconStroke} color={colors.text.secondary} />
        </View>
      )}
      <View style={{ flex: 1, gap: spacing[1] }}>
        <Text numberOfLines={2} style={[theme.typography.bodyMMedium, { color: colors.text.primary }]}>
          {trip.name}
        </Text>
        <Text style={[theme.typography.bodyS, { color: colors.text.secondary }]}>{dates}</Text>
      </View>
      {selected && (
        <Check testID="trip-row-check" aria-hidden size={size.iconStandard} strokeWidth={size.iconStroke} color={colors.action.primary} />
      )}
    </Pressable>
  );
}

// Static placeholder with a row's geometry while the list loads (§10.18; no shimmer).
function SkeletonRow() {
  const theme = useTheme();
  const { spacing, colors, size, radius } = theme;
  const bar = { borderRadius: radius.sm, backgroundColor: colors.surface.secondary };
  return (
    <View style={{ minHeight: spacing[16], flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4] }}>
      <View style={[bar, { width: size.thumbnail, height: size.thumbnail }]} />
      <View style={{ flex: 1, gap: spacing[2] }}>
        <View style={[bar, { height: spacing[4], width: '70%' }]} />
        <View style={[bar, { height: spacing[3], width: '45%' }]} />
      </View>
    </View>
  );
}
