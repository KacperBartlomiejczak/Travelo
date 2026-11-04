import { CircleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';

import { AmountField } from '@/components/AmountField';
import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useSetTripBudget } from '@/hooks/useTrips';
import { currencyMinorDigits, formatAmountInput, formatMoney, parseAmountToMinor } from '@/lib/money';
import { tripDayCount } from '@/lib/trip-days';
import { TripBudgetFormSchema, type TripBudgetForm, type TripMember, type TripSummary } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type BudgetMode = TripBudgetForm['mode'];
type Props = { trip: TripSummary; members: TripMember[]; onClose: () => void };

// Changing the daily budget of an existing trip (trips-supabase D5, daily-budget B4): "Razem / Osobno" like the wizard, in the trip's
// base currency. Opens in Razem when everyone has the same amount (A1). Saved on the phone first, so it works offline (D1); the sheet
// closes after saving (D13).
export function BudgetSheet({ trip, members, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const setBudget = useSetTripBudget();
  const currency = trip.baseCurrency;
  const solo = members.length === 0;
  const initial = [trip.dailyBudget.amountMinor, ...members.map((member) => member.dailyBudgetMinor)];
  const [mode, setMode] = useState<BudgetMode>(initial.every((amount) => amount === initial[0]) ? 'shared' : 'individual');
  // The organizer first, then the friends in order.
  const [texts, setTexts] = useState(() => initial.map((amount) => formatAmountInput(amount, currency, i18n.language)));
  const [submitted, setSubmitted] = useState(false);
  const individual = !solo && mode === 'individual';

  const names = [t('newTrip.budget.you'), ...members.map((member) => member.displayName)];
  const amounts = texts.map((text) => parseAmountToMinor(text, currency, i18n.language));
  // Razem: everyone gets the organizer's amount.
  const dailyMinor = individual ? amounts : amounts.map(() => amounts[0]);
  const result = TripBudgetFormSchema.safeParse({
    mode,
    organizerDailyMinor: dailyMinor[0],
    members: members.map((member, i) => ({ memberId: member.id, dailyMinor: dailyMinor[i + 1] })),
  });
  const days = tripDayCount(trip.startDate, trip.endDate);
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency }, i18n.language);

  // Same rules as the wizard's budget step (§10.5): not a number while typing; empty or zero on save.
  function errorFor(i: number): string | undefined {
    const text = texts[i];
    if (text.trim() !== '' && amounts[i] === null) {
      return t(currencyMinorDigits(currency) === 0 ? 'validation.amountInvalidWhole' : 'validation.amountInvalid');
    }
    if (submitted && text.trim() === '') return t('validation.amountRequired');
    if (amounts[i] === 0) return t('validation.amountPositive');
    return undefined;
  }

  const setText = (i: number, text: string) => setTexts((current) => current.map((old, j) => (j === i ? text : old)));
  // Razem → Osobno: everyone starts at the shared amount. Osobno → Razem: the organizer's amount is the shared one.
  function changeMode(next: BudgetMode) {
    setMode(next);
    if (next === 'individual') setTexts((current) => current.map(() => current[0]));
  }

  function save() {
    setSubmitted(true);
    if (!result.success) {
      AccessibilityInfo.announceForAccessibility(t('newTrip.fixErrors'));
      return;
    }
    setBudget.mutate(
      { trip, budget: { organizerDailyMinor: result.data.organizerDailyMinor, members: result.data.members } },
      { onSuccess: onClose, onError: () => AccessibilityInfo.announceForAccessibility(t('home.saveBudgetError')) },
    );
  }

  return (
    <BottomSheet visible title={t(solo ? 'newTrip.budget.headingSolo' : 'newTrip.budget.heading')} onClose={onClose}>
      {/* Scrolls when many people are listed; the save button below stays in reach. */}
      <ScrollView testID="budget-scroll" keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ gap: tokens.spacing[4] }}>
        <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.secondary }]}>{t('newTrip.budget.hint')}</Text>
        {!solo && (
          <SegmentedControl
            label={t('newTrip.budget.mode')}
            options={[
              { value: 'shared', label: t('newTrip.budget.modeShared') },
              { value: 'individual', label: t('newTrip.budget.modeIndividual') },
            ]}
            value={mode}
            onChange={changeMode}
          />
        )}
        {(individual ? names : [t(solo ? 'newTrip.budget.amountSolo' : 'newTrip.budget.amountShared')]).map((label, i) => (
          <AmountField key={i} label={label} amountText={texts[i]} currency={currency} onChangeText={(text) => setText(i, text)} error={errorFor(i)} />
        ))}
        {result.success && !solo && (
          <View style={{ gap: tokens.spacing[1] }}>
            <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.primary }]}>
              {t('newTrip.budget.groupTotal', { count: names.length, total: money(dailyMinor.reduce<number>((sum, amount) => sum + (amount ?? 0), 0) * days) })}
            </Text>
            {individual &&
              names.map((name, i) => (
                <Text key={i} style={[tokens.typography.styles.bodyMD, { color: theme.text.secondary }]}>
                  {t('newTrip.budget.personTotal', { name, total: money((dailyMinor[i] ?? 0) * days) })}
                </Text>
              ))}
          </View>
        )}
      </ScrollView>
      {setBudget.isError && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[1] }}>
          <CircleAlert
            testID="budget-error-icon"
            size={tokens.iconography.size.xs}
            strokeWidth={tokens.iconography.strokeWidth}
            color={theme.semantic.error.foreground}
            aria-hidden
          />
          <Text accessibilityLiveRegion="polite" style={[tokens.typography.styles.bodySM, { color: theme.semantic.error.foreground, flexShrink: 1 }]}>
            {t('home.saveBudgetError')}
          </Text>
        </View>
      )}
      <PrimaryButton label={t('home.saveBudget')} onPress={save} loading={setBudget.isPending} />
    </BottomSheet>
  );
}
