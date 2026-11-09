import { CircleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AirportField } from '@/components/AirportField';
import { Field } from '@/components/Field';
import { InterestChips } from '@/components/InterestChips';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { TextButton } from '@/components/TextButton';
import { AuthFormScreen } from '@/features/auth/AuthFormScreen';
import { usePlaceRecommendations } from '@/hooks/usePlaceRecommendations';
import { useMyProfile } from '@/hooks/useProfile';
import { useIsOffline } from '@/providers/BudgetSync';
import {
  RecommendPlacesRequestSchema,
  type Airport,
  type InterestTag,
  type RecommendPlacesRequest,
  type RecommendPlacesResponse,
} from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { PlaceCard } from './PlaceCard';

const { spacing, typography } = tokens;

/**
 * Discover places (places step C5): pick a city (airport list, D19), confirm the interests (from the profile, editable), and get
 * Google places with a short AI reason (D15). Google and AI text is shown as plain text only. Searching needs internet.
 */
export function DiscoverScreen({
  fetcher,
  bottomInset,
}: {
  fetcher?: (request: RecommendPlacesRequest) => Promise<RecommendPlacesResponse>;
  bottomInset?: number;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const offline = useIsOffline();
  const profileInterests = useMyProfile().data?.profile.interests;
  const [airport, setAirport] = useState<Airport | null>(null);
  // null = untouched: follows the profile once it is loaded.
  const [edited, setEdited] = useState<InterestTag[] | null>(null);
  const interests = edited ?? profileInterests ?? [];
  const { data, loading, error, remainingToday, search, retry } = usePlaceRecommendations(fetcher);

  const request = RecommendPlacesRequestSchema.safeParse({
    city: airport?.city ?? '',
    latitude: airport?.latitude,
    longitude: airport?.longitude,
    interests,
    locale: i18n.language.startsWith('pl') ? 'pl' : 'en',
  });
  const canSearch = request.success && !offline && !loading;

  const note = (text: string) => <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>{text}</Text>;

  let results = null;
  if (loading) {
    results = (
      <View testID="discover-loading" accessibilityLabel={t('discover.loading')} style={{ gap: spacing[3] }}>
        <SkeletonBlock width="100%" height={spacing[10]} />
        <SkeletonBlock width="100%" height={spacing[10]} />
      </View>
    );
  } else if (error === 'limit_reached') {
    results = <Text style={[typography.styles.bodyMD, { color: theme.text.primary }]}>{t('discover.limit')}</Text>;
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
              if (canSearch && request.success) search(request.data);
            }}
          />
        </>
      }
    >
      <AirportField label={t('discover.city')} iata={airport?.iata ?? ''} onSelect={setAirport} />
      <Field label={t('discover.interests')}>
        <InterestChips selected={interests} onChange={setEdited} />
      </Field>
      {results}
    </AuthFormScreen>
  );
}
