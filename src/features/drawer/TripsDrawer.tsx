import { Check, CircleAlert, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoverImage } from '@/components/CoverImage';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useCurrentTrip, useSelectTrip, useTripList } from '@/hooks/useTrips';
import { formatDateRange } from '@/lib/date-time';
import { deviceToday, tripSections } from '@/lib/trip-sections';
import { useIsOffline } from '@/providers/BudgetSync';
import type { TripListItem } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { onClose: () => void; onCreate: () => void };

const SKELETON_ROWS = 3;

const { drawer, listRow, skeleton, focusRing } = tokens.components;
const { styles } = tokens.typography;
const { spacing } = tokens;
const { duration: pulseDuration, minOpacity } = tokens.motion.microinteraction.skeletonPulse;

// The side panel (trips-drawer D4, P1): every trip in "Nadchodzące" / "Minione", the open one marked,
// "Nowa podróż" pinned at the bottom. Follows the system theme (A7).
export function TripsDrawer({ onClose, onCreate }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
        <Text style={[styles.labelLG, { color: theme.text.primary }]}>{t('trips.empty.heading')}</Text>
        <Text style={[styles.bodySM, { color: theme.text.secondary }]}>{t('trips.empty.description')}</Text>
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
          <CircleAlert
            testID="drawer-error-icon"
            size={tokens.iconography.size.sm}
            strokeWidth={tokens.iconography.strokeWidth}
            color={theme.semantic.error.foreground}
            aria-hidden
          />
          <Text style={[styles.bodyMD, { color: theme.text.primary, flexShrink: 1 }]}>{t('trips.loadError')}</Text>
        </View>
        <TextButton variant="secondary" label={t('trips.retry')} onPress={() => trips.refetch()} />
      </View>
    );
  } else {
    body = <SkeletonRows />;
  }

  return (
    <View testID="trips-drawer" style={{ flex: 1, paddingTop: insets.top + spacing[4] }}>
      <Text accessibilityRole="header" style={[styles.headingLG, { color: theme.text.primary, paddingHorizontal: spacing[4] }]}>
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
  if (trips.length === 0) return null;
  return (
    <View testID={`drawer-section-${id}`}>
      <Text
        accessibilityRole="header"
        style={[styles.caption, { color: theme.text.secondary, paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2] }]}
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

// List row (§8.8): thumbnail, name and dates, a check on the open trip. The open trip is marked by the brand tint and the
// check, never colour alone (§1.3); pressed is `background.sunken`, focused a 2dp inset `border.focus` paid for by the
// padding so the text stays put; the divider above starts at the text column.
function TripRow({ trip, selected, divider, onPress }: RowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const dates = formatDateRange(trip.startDate, trip.endDate, i18n.language);
  // The placeholder surface sits behind the cover while it loads; a cover that fails to load falls back to the default
  // preset in `CoverImage`, so the thumbnail is never a hole.
  // On the selected row (tinted) it takes the panel's surface instead, so it stays visible (D8).
  const thumbnail = {
    width: drawer.thumbnailSize,
    height: drawer.thumbnailSize,
    borderRadius: tokens.radii.sm,
    backgroundColor: selected ? theme.surface.elevated : theme.background.sunken,
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('drawer.trip', { name: trip.name, dates })}
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: listRow.minHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingHorizontal: listRow.horizontalPadding - (focused ? focusRing.width : 0),
        paddingVertical: listRow.verticalPadding - (focused ? focusRing.width : 0),
        backgroundColor: pressed ? theme.background.sunken : selected ? theme.brand.tint : undefined,
        ...(focused ? { borderWidth: focusRing.width, borderColor: theme.border.focus } : {}),
      })}
    >
      {divider && (
        <View
          testID="drawer-trip-divider"
          style={{
            position: 'absolute',
            top: 0,
            left: listRow.horizontalPadding + drawer.thumbnailSize + spacing[3],
            right: 0,
            height: tokens.components.card.borderWidth,
            backgroundColor: theme.border.subtle,
          }}
        />
      )}
      <CoverImage testID="trip-row-cover" cover={trip.coverImageUri} urls={trip.coverUrls} variant="thumbnail" style={thumbnail} />
      <View style={{ flex: 1, gap: spacing[1] }}>
        <Text numberOfLines={2} style={[styles.labelLG, { color: theme.text.primary }]}>
          {trip.name}
        </Text>
        <Text style={[styles.bodySM, { color: theme.text.secondary }]}>{dates}</Text>
      </View>
      {selected && (
        <Check
          testID="trip-row-check"
          aria-hidden
          size={tokens.iconography.size.sm}
          strokeWidth={tokens.iconography.strokeWidth}
          color={theme.text.brand}
        />
      )}
    </Pressable>
  );
}

// Placeholder rows with a list row's geometry while the list loads (§8.19, §10.1). They pulse their opacity 1 → minOpacity → 1
// over `pulseDuration` (sunline-redesign D5, D19) and are static under reduce motion and until the system has answered.
function SkeletonRows() {
  const { t } = useTranslation();
  const theme = useTheme();
  const pulses = useReduceMotion() === false;
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!pulses) {
      opacity.setValue(1);
      return;
    }
    // JS driver: the native driver does not update the rendered style under Jest.
    const step = (toValue: number) =>
      Animated.timing(opacity, { toValue, duration: pulseDuration / 2, easing: Easing.bezier(...tokens.motion.easing.linear), useNativeDriver: false });
    const pulse = Animated.loop(Animated.sequence([step(minOpacity), step(1)]));
    pulse.start();
    return () => pulse.stop();
  }, [pulses, opacity]);

  const bar = { borderRadius: skeleton.radius, backgroundColor: theme.skeleton.base };
  return (
    <Animated.View testID="drawer-loading" accessible accessibilityLabel={t('trips.loading')} accessibilityState={{ busy: true }} style={{ opacity }}>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <View
          key={index}
          testID="drawer-skeleton-row"
          style={{
            minHeight: listRow.minHeight,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[3],
            paddingHorizontal: listRow.horizontalPadding,
            paddingVertical: listRow.verticalPadding,
          }}
        >
          <View
            testID="drawer-skeleton-thumbnail"
            style={{ width: drawer.thumbnailSize, height: drawer.thumbnailSize, borderRadius: tokens.radii.sm, backgroundColor: theme.skeleton.base }}
          />
          <View style={{ flex: 1, gap: spacing[2] }}>
            <View testID="drawer-skeleton-title" style={[bar, { height: skeleton.titleHeight, width: '70%' }]} />
            <View testID="drawer-skeleton-line" style={[bar, { height: skeleton.lineHeight, width: '45%' }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
