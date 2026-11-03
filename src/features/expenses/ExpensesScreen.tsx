import { useNavigation, useRouter } from 'expo-router';
import type { DrawerNavigationProp } from 'expo-router/drawer';
import { CircleX, Menu, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Fab } from '@/components/Fab';
import { IconButton } from '@/components/IconButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { Snackbar } from '@/components/Snackbar';
import { TextButton } from '@/components/TextButton';
import { usePillClearance } from '@/features/nav/usePillClearance';
import { useCanEditExpense, useExpenses } from '@/hooks/useExpenses';
import { useIsTripOwner, useMyProfileId } from '@/hooks/useProfile';
import { useCurrentTrip } from '@/hooks/useTrips';
import { findAirport } from '@/lib/airport-search';
import { computeExpenseBudget } from '@/lib/expense-budget';
import { todayIn } from '@/lib/time';
import { useIsOffline } from '@/providers/BudgetSync';
import type { LocalExpense, TripOverview } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { BudgetHero } from './BudgetHero';
import { ExpenseSheet } from './ExpenseSheet';
import { ExpenseTimeline } from './ExpenseTimeline';
import { ExpensesHeader } from './ExpensesHeader';
import { SpendByPersonChart } from './SpendByPersonChart';

const { spacing, layout, typography } = tokens;
const { fab, offlineBanner } = tokens.components;

// Expenses tab (expenses D7, D9, D10, D11): the trip bar, then the budget. Loading, no trip, error and empty have their own
// views; offline the local data renders as usual and the banner sits above the floating pill.
// The floating add button, the empty-state action and the rows open the add / edit sheet (step 10, D14).
export function ExpensesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, object | undefined>>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const trips = useCurrentTrip();
  const offline = useIsOffline();
  const side = width < layout.compactBreakpoint ? layout.screenGutterCompact : layout.screenGutter;
  const openMenu = () => navigation.openDrawer();

  useEffect(() => {
    if (trips.isError) AccessibilityInfo.announceForAccessibility(t('trips.loadError'));
  }, [trips.isError, t]);

  let body: ReactNode;
  if (trips.data) {
    body = <TripExpenses overview={trips.data.overview} onOpenMenu={openMenu} offline={offline} />;
  } else if (trips.isPending) {
    body = (
      <View testID="expenses-loading" accessible accessibilityLabel={t('trips.loading')} accessibilityState={{ busy: true }} style={{ gap: spacing[4] }}>
        <ExpensesSkeleton />
      </View>
    );
  } else if (trips.isError) {
    body = <ErrorView message={t('trips.loadError')} onRetry={() => trips.refetch()} />;
  } else {
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] }}>
        <Text style={[typography.styles.headingLG, { color: theme.text.primary, textAlign: 'center' }]}>{t('trips.empty.heading')}</Text>
        <Text style={[typography.styles.bodyMD, { color: theme.text.secondary, textAlign: 'center' }]}>{t('trips.empty.description')}</Text>
        <View style={{ marginTop: spacing[4], alignSelf: 'stretch' }}>
          <PrimaryButton label={t('trips.create')} icon={Plus} onPress={() => router.push('/trips/new')} />
        </View>
      </View>
    );
  }

  return (
    <View
      testID="expenses-screen"
      style={{
        flex: 1,
        backgroundColor: theme.background.canvas,
        paddingTop: insets.top + spacing[4],
        paddingHorizontal: side,
      }}
    >
      <View style={{ flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}>
        {/* Without a trip bar (loading, no trip, error) the panel is still one tap away, like on Home (trips-drawer P5). */}
        {!trips.data && (
          <View style={{ alignSelf: 'flex-start' }}>
            <IconButton icon={Menu} label={t('trips.openList')} onPress={openMenu} />
          </View>
        )}
        {body}
      </View>
    </View>
  );
}

type TripProps = { overview: TripOverview; onOpenMenu: () => void; offline: boolean };

function TripExpenses({ overview, onOpenMenu, offline }: TripProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const clearance = usePillClearance();
  const insets = useSafeAreaInsets();
  // The add / edit sheet: `null` = closed, `{ expense: null }` = adding.
  const [sheet, setSheet] = useState<{ expense: LocalExpense | null } | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  // The sheet's closing animation outlives its unmount; a late second tap on Save would land on the FAB or a row beneath it.
  const closedAt = useRef(0);
  const openSheet = (expense: LocalExpense | null) => {
    if (Date.now() - closedAt.current >= tokens.motion.duration.slow) setSheet({ expense });
  };
  const closeSheet = () => {
    closedAt.current = Date.now();
    setSheet(null);
  };
  const [bannerHeight, setBannerHeight] = useState<number | null>(null);
  const { trip, members } = overview;
  const expenses = useExpenses(trip.id);
  const owner = useIsTripOwner(trip.ownerId);
  const myId = useMyProfileId();
  const canEdit = useCanEditExpense(overview);
  const today = todayIn(findAirport(trip.destination)?.timezone ?? 'UTC');
  const ownMemberId = owner ? null : (members.find((member) => member.userId === myId)?.id ?? undefined);
  const list = expenses.data;
  // Above the pill; offline, above the banner slot (measured, so a wrapped banner is cleared too; its top padding is the gap).
  const fabLift = offline && bannerHeight !== null ? bannerHeight : insets.bottom + fab.bottomClearance + (offline ? offlineBanner.minHeight + spacing[3] : 0);

  const budget = useMemo(
    () =>
      list &&
      computeExpenseBudget({
        expenses: list,
        budgetPerPersonMinor: trip.budgetPerPerson.amountMinor,
        startDate: trip.startDate,
        endDate: trip.endDate,
        today,
        organizerName: t('newTrip.summary.you'),
        members,
      }),
    [list, trip, today, members, t],
  );
  // "Ja" (A2): the organizer is memberId null, a linked friend is their own member row.
  const me = ownMemberId === undefined ? undefined : budget?.people.find((person) => person.memberId === ownMemberId);

  useEffect(() => {
    if (expenses.isError) AccessibilityInfo.announceForAccessibility(t('expenses.loadError'));
  }, [expenses.isError, t]);

  return (
    <>
      <ExpensesHeader tripName={trip.name} onPress={onOpenMenu} />
      <ScrollView
        testID="expenses-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing[4], paddingTop: spacing[3], paddingBottom: (offline ? 0 : fabLift) + fab.size + spacing[4] }}
      >
        {expenses.isError ? (
          <ErrorView message={t('expenses.loadError')} onRetry={() => expenses.refetch()} />
        ) : !budget ? (
          <View testID="expenses-loading" accessible accessibilityLabel={t('trips.loading')} accessibilityState={{ busy: true }}>
            <ExpensesSkeleton hero />
          </View>
        ) : (
          <>
            <BudgetHero testID="budget-hero" group={budget.group} me={me} currency={trip.baseCurrency} />
            {list && list.length > 0 && <SpendByPersonChart people={budget.people} currency={trip.baseCurrency} />}
            {list && list.length === 0 ? (
              <View testID="expenses-empty" style={{ alignItems: 'center', gap: spacing[2], paddingVertical: spacing[6] }}>
                <Text accessibilityRole="header" style={[typography.styles.headingMD, { color: theme.text.primary, textAlign: 'center' }]}>
                  {t('empty.expenses.title')}
                </Text>
                <Text style={[typography.styles.bodyMD, { color: theme.text.secondary, textAlign: 'center' }]}>{t('empty.expenses.body')}</Text>
                <View style={{ marginTop: spacing[3], alignSelf: 'stretch' }}>
                  <PrimaryButton label={t('empty.expenses.action')} icon={Plus} onPress={() => openSheet(null)} />
                </View>
              </View>
            ) : null}
            {list && list.length > 0 && (
              <ExpenseTimeline expenses={list} people={budget.people} currency={trip.baseCurrency} canEdit={canEdit} onEditExpense={openSheet} />
            )}
          </>
        )}
      </ScrollView>
      {/* D24: while the list is empty, the empty state's action is the only add button. */}
      {list && list.length > 0 && (
        <View testID="fab-slot" style={{ position: 'absolute', right: spacing[5], bottom: fabLift }}>
          <Fab testID="fab-add-expense" label={t('a11y.addExpense')} onPress={() => openSheet(null)} />
        </View>
      )}
      {offline && (
        <View testID="offline-banner-slot" onLayout={(event) => setBannerHeight(event.nativeEvent.layout.height)} style={{ paddingTop: spacing[3], paddingBottom: clearance + spacing[3] }}>
          <OfflineBanner />
        </View>
      )}
      {sheet && <ExpenseSheet overview={overview} expense={sheet.expense} today={today} onClose={closeSheet} onSaved={setSnackbar} />}
      <Snackbar message={snackbar} onHide={() => setSnackbar(null)} bottomOffset={fab.bottomClearance + fab.size + spacing[2] - spacing[4]} />
    </>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingVertical: spacing[6] }}>
      <CircleX size={tokens.iconography.size.xl} strokeWidth={tokens.iconography.strokeWidth} color={theme.semantic.error.foreground} aria-hidden />
      <Text style={[typography.styles.bodyMD, { color: theme.text.primary, textAlign: 'center' }]}>{message}</Text>
      <TextButton variant="secondary" label={t('trips.retry')} onPress={onRetry} />
    </View>
  );
}

// Same geometry as the loaded view: the trip bar (unless already drawn) and the budget card with its toggle and amount.
function ExpensesSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <>
      {!hero && <SkeletonBlock width="60%" height={typography.styles.headingLG.lineHeight} />}
      <Card>
        <SkeletonBlock width="100%" height={tokens.components.segmentedControl.height} />
        <SkeletonBlock width="55%" height={typography.styles.moneyXL.lineHeight} />
        <SkeletonBlock width="40%" height={typography.styles.bodyMD.lineHeight} />
      </Card>
    </>
  );
}
