import { useIsFocused } from 'expo-router';
import { CircleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { TextButton } from '@/components/TextButton';
import { TripPlanCallError } from '@/data/trip-plan';
import { useGenerateTripPlan } from '@/hooks/useGenerateTripPlan';
import { planPlaceIds, usePlaceDetails } from '@/hooks/usePlaceDetails';
import { useIsTripOwner } from '@/hooks/useProfile';
import { useTripPlan } from '@/hooks/useTripPlan';
import { findAirport } from '@/lib/airport-search';
import { useIsOffline } from '@/providers/BudgetSync';
import { PLANS_PER_DAY, type GenerateTripPlanRequest, type TripSummary } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { PlanGenerating } from './PlanGenerating';
import { PlanResult } from './PlanResult';
import { PlanWizard } from './PlanWizard';

const { spacing, typography, iconography } = tokens;

// The "Plan" side of the Plan tab (ai-trip-plan step 9): load the saved plan, or let the owner generate one.
export function TripPlanSide({ trip }: { trip: Pick<TripSummary, 'id' | 'ownerId' | 'destination'> }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const focused = useIsFocused();
  const offline = useIsOffline();
  const owner = useIsTripOwner(trip.ownerId);
  const locale = i18n.language.startsWith('pl') ? 'pl' : 'en';
  const plan = useTripPlan(trip.id);
  const details = usePlaceDetails(plan.data ? planPlaceIds(plan.data) : [], locale);
  const generate = useGenerateTripPlan(trip.id);
  const [wizard, setWizard] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [lastRequest, setLastRequest] = useState<GenerateTripPlanRequest | null>(null);
  const destination = findAirport(trip.destination);
  const canGenerate = owner && !offline && !!destination;

  const message = (text: string) => <Text style={[typography.styles.bodyMD, { color: theme.text.primary }]}>{text}</Text>;
  const failure = (text: string, retry: () => void, retryLabel = t('plan.side.retry')) => (
    <View style={{ gap: spacing[2], alignItems: 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
        <CircleAlert size={iconography.size.xs} strokeWidth={iconography.strokeWidth} color={theme.semantic.error.foreground} aria-hidden />
        <Text style={[typography.styles.bodyMD, { color: theme.text.primary, flexShrink: 1 }]}>{text}</Text>
      </View>
      <TextButton variant="secondary" label={retryLabel} onPress={retry} />
    </View>
  );
  const skeleton = (
    <View accessibilityLabel={t('plan.side.loading')} style={{ gap: spacing[3] }}>
      <SkeletonBlock width="100%" height={spacing[10]} />
      <SkeletonBlock width="100%" height={spacing[10]} />
    </View>
  );
  const openWizard = () => {
    generate.reset();
    setWizard(true);
  };

  const kind = generate.error instanceof TripPlanCallError ? generate.error.kind : 'failed';
  const errorText =
    kind === 'limit_reached'
      ? t('plan.error.limit', { count: PLANS_PER_DAY })
      : kind === 'no_places'
        ? t('plan.error.noPlaces')
        : kind === 'offline'
          ? t('plan.error.offline')
          : t('plan.error.title');
  // Shown alone when there is no saved plan, above the plan when a regeneration failed (design-context §12.11).
  const errorPanel = (
    <View style={{ gap: spacing[2], alignItems: 'flex-start' }}>
      {kind === 'limit_reached' ? message(errorText) : failure(errorText, () => (lastRequest ? generate.mutate(lastRequest) : openWizard()), t('plan.error.retry'))}
      <TextButton variant="ghost" label={t('plan.error.cancel')} onPress={() => generate.reset()} />
    </View>
  );

  let body;
  if (generate.isPending) {
    body = <PlanGenerating />;
  } else if (wizard && destination) {
    body = (
      <PlanWizard
        tripId={trip.id}
        destination={destination}
        backActive={focused}
        onCancel={() => setWizard(false)}
        onSubmit={(request) => {
          setWizard(false);
          setLastRequest(request);
          generate.mutate(request);
        }}
      />
    );
  } else if (generate.isError && !plan.data) {
    body = errorPanel;
  } else if (offline) {
    body = message(t('plan.side.needsInternet'));
  } else if (plan.isPending) {
    body = skeleton;
  } else if (plan.isError) {
    body = failure(t('plan.side.loadError'), () => void plan.refetch());
  } else if (plan.data) {
    body = details.isError
      ? failure(t('plan.side.detailsError'), () => void details.refetch())
      : details.data
        ? <PlanResult
            plan={plan.data}
            places={details.data}
            cityName={(iata) => findAirport(iata)?.city ?? iata}
            canRegenerate={canGenerate}
            onRegenerate={() => setConfirmReplace(true)}
          />
        : skeleton;
  } else {
    body = owner ? (
      <Text accessibilityRole="header" style={[typography.styles.headingMD, { color: theme.text.primary }]}>
        {t('plan.side.emptyTitle')}
      </Text>
    ) : (
      message(t('plan.side.friendEmpty'))
    );
  }

  // Always the same tree shape, so PlanResult stays mounted when the error shows or is dismissed (no replayed entry animation).
  const inlineError = generate.isError && plan.data && !wizard && !generate.isPending ? errorPanel : null;

  const noPlan = offline || (!plan.data && !plan.isError && !plan.isPending);
  return (
    <View testID="plan-side" style={{ flex: 1, gap: spacing[4] }}>
      {offline && <OfflineBanner />}
      <View style={{ flex: 1, gap: spacing[4] }}>
        {inlineError}
        <View style={{ flex: 1 }}>{body}</View>
      </View>
      {owner && !!destination && noPlan && !wizard && !generate.isPending && !generate.isError && (
        <PrimaryButton label={t('plan.side.emptyAction')} disabled={!canGenerate} onPress={openWizard} />
      )}
      <ConfirmDialog
        visible={confirmReplace}
        title={t('plan.side.replaceTitle')}
        message={t('plan.side.replaceMessage')}
        destructive
        confirmLabel={t('plan.side.replaceConfirm')}
        cancelLabel={t('plan.side.replaceCancel')}
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => {
          setConfirmReplace(false);
          openWizard();
        }}
      />
    </View>
  );
}
