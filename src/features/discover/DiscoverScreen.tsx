import { CircleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AirportField } from '@/components/AirportField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { TextButton } from '@/components/TextButton';
import { AuthFormScreen } from '@/features/auth/AuthFormScreen';
import { usePlaceRecommendations } from '@/hooks/usePlaceRecommendations';
import { useMyProfile } from '@/hooks/useProfile';
import { findAirport } from '@/lib/airport-search';
import { useIsOffline } from '@/providers/BudgetSync';
import {
  RecommendPlacesRequestSchema,
  type Airport,
  type RecommendPlacesRequest,
  type RecommendPlacesResponse,
} from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { PlaceCard } from './PlaceCard';

const { spacing, typography } = tokens;

/**
 * Discover places (places step C5): pick a city (airport list, D19), and get
 * Google places for the profile interests with a short AI reason (D15). Google and AI text is shown as plain text only. Searching needs internet.
 */
export function DiscoverScreen({
  fetcher,
  bottomInset,
  destination,
}: {
  fetcher?: (request: RecommendPlacesRequest) => Promise<RecommendPlacesResponse>;
  bottomInset?: number;
  /** Trip destination (IATA): prefilled as the city and searched once on its own. */
  destination?: string;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const offline = useIsOffline();
  const profile = useMyProfile();
  // undefined = follow the trip destination; an airport or null (typed text, not picked yet) = the user's own choice.
  const [manual, setManual] = useState<Airport | null | undefined>(undefined);
  const [seenDestination, setSeenDestination] = useState(destination);
  if (seenDestination !== destination) {
    setSeenDestination(destination);
    setManual(undefined);
  }
  const airport = manual === undefined ? (destination ? (findAirport(destination) ?? null) : null) : manual;
  const { data, loading, error, remainingToday, search, retry } = usePlaceRecommendations(fetcher);
  const [searched, setSearched] = useState<RecommendPlacesRequest | null>(null);

  const interests = profile.data?.profile.interests;
  const locale = i18n.language.startsWith('pl') ? 'pl' : 'en';
  const request = useMemo(
    () =>
      RecommendPlacesRequestSchema.safeParse({
        city: airport?.city ?? '',
        latitude: airport?.latitude,
        longitude: airport?.longitude,
        interests: interests ?? [],
        locale,
      }),
    [airport, interests, locale],
  );
  const autoRequest = manual === undefined && airport && interests && request.success && !offline ? request.data : null;
  // Same request = cache hit in the hook, so remounting or reconnecting never calls the fetcher again.
  useEffect(() => {
    if (autoRequest) search(autoRequest);
  }, [autoRequest, search]);
  // The automatic search above is for autoRequest, so remember it during render (same pattern as seenDestination).
  if (autoRequest && searched !== autoRequest) setSearched(autoRequest);
  const canSearch = request.success && !offline && !loading;
  // Results belong to the city they were searched for; a different (or half-typed) city hides them.
  const current = request.success ? request.data : null;
  const stale =
    !current || !searched || current.city !== searched.city || current.latitude !== searched.latitude || current.longitude !== searched.longitude;

  const note = (text: string) => <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>{text}</Text>;

  let results = null;
  if (loading || profile.isPending) {
    results = (
      <View testID="discover-loading" accessibilityLabel={t('discover.loading')} style={{ gap: spacing[3] }}>
        <SkeletonBlock width="100%" height={spacing[10]} />
        <SkeletonBlock width="100%" height={spacing[10]} />
      </View>
    );
  } else if (profile.isError) {
    results = note(t('discover.profileError'));
  } else if (error === 'limit_reached') {
    results = <Text style={[typography.styles.bodyMD, { color: theme.text.primary }]}>{t('discover.limit')}</Text>;
  } else if (stale) {
    results = null;
  } else if (error) {
    results = (
      <View testID="discover-error" style={{ gap: spacing[2], alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
          <CircleAlert size={tokens.iconography.size.xs} strokeWidth={tokens.iconography.strokeWidth} color={theme.semantic.error.foreground} aria-hidden />
          <Text style={[typography.styles.bodyMD, { color: theme.text.primary, flexShrink: 1 }]}>{t('discover.error')}</Text>
        </View>
        <TextButton variant="secondary" label={t('discover.retry')} onPress={retry} />
      </View>
    );
  } else if (data) {
    results =
      data.places.length === 0 ? (
        <Text style={[typography.styles.bodyMD, { color: theme.text.primary }]}>{t('discover.empty')}</Text>
      ) : (
        <View style={{ gap: spacing[3] }}>
          {data.places.map((place) => (
            <PlaceCard key={place.placeId} place={place} />
          ))}
          {note(t('discover.attribution'))}
        </View>
      );
  }

  return (
    <AuthFormScreen
      testID="discover-screen"
      title={t('discover.title')}
      hint={t('discover.hint')}
      offlineText={t('discover.offline')}
      bottomInset={bottomInset}
      footer={
        <>
          {remainingToday !== undefined && note(t('discover.remaining', { count: remainingToday }))}
          <PrimaryButton
            label={t('discover.search')}
            loading={loading}
            disabled={!canSearch}
            onPress={() => {
              if (canSearch && request.success) {
                search(request.data);
                setSearched(request.data);
              }
            }}
          />
        </>
      }
    >
      <AirportField label={t('discover.city')} iata={airport?.iata ?? ''} onSelect={setManual} />
      {results}
    </AuthFormScreen>
  );
}
