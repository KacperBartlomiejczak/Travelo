import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View, type ScrollView } from 'react-native';

import { AmountField } from '@/components/AmountField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { budgetCurrency, budgetCurrencyOptions, toCreateTripInput } from '@/features/trip-create/draft';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import { useGoToNextStep, WizardScreen } from '@/features/trip-create/WizardScreen';
import { currencyMinorDigits, formatMoney, parseAmountToMinor } from '@/lib/money';
import { tripDayCount } from '@/lib/trip-days';
import { deriveTripDates } from '@/lib/trip-dates';
import { BudgetStepInputSchema } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// Step 3 — daily budget per person, without flights: one amount for everyone or one per person (daily-budget B1, B2, B4).
export default function BudgetStep() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { draft, setDraft } = useTripDraft();
  const goNext = useGoToNextStep('budget');
  const [submitted, setSubmitted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Record<number, number>>({});

  const currencies = budgetCurrencyOptions(draft);
  const currency = budgetCurrency(draft);
  const solo = draft.companionCount === 0;
  const { mode, amountText, friendAmountTexts } = draft.budget;
  const individual = !solo && mode === 'individual';
  const input = toCreateTripInput(draft, i18n.language).budget;
  const result = BudgetStepInputSchema.safeParse(input);

  // §10.5: an amount that is not a number is flagged while typing; empty or zero only after "Next".
  function errorFor(text: string): string | undefined {
    const amountMinor = parseAmountToMinor(text, currency, i18n.language);
    if (text.trim() !== '' && amountMinor === null) {
      return t(currencyMinorDigits(currency) === 0 ? 'validation.amountInvalidWhole' : 'validation.amountInvalid');
    }
    if (submitted && text.trim() === '') return t('validation.amountRequired');
    if (submitted && amountMinor === 0) return t('validation.amountPositive');
    return undefined;
  }

  const travellers = draft.companionCount + 1;
  const { startDate, endDate } = deriveTripDates(draft);
  const days = tripDayCount(startDate, endDate);
  const friendNames = draft.friends.map((friend, i) => friend.displayName.trim() || t('newTrip.friends.card', { number: i + 1 }));
  // Everyone's daily amount, the organizer first; shared mode already makes them equal.
  const dailyMinor = [input.organizerDailyMinor, ...input.friendDailyMinor];
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency }, i18n.language);

  const isValidAmount = (text: string) => (parseAmountToMinor(text, currency, i18n.language) ?? 0) > 0;

  function next() {
    setSubmitted(true);
    if (result.success) goNext();
    else {
      AccessibilityInfo.announceForAccessibility(t('newTrip.fixErrors'));
      // Like the friends step: scroll to the first amount with an error (Razem has a single field at the top).
      const first = individual ? [amountText, ...draft.friends.map((_, i) => friendAmountTexts[i] ?? '')].findIndex((text) => !isValidAmount(text)) : 0;
      if (first >= 0) scrollRef.current?.scrollTo({ y: Math.max(0, (fieldY.current[first] ?? 0) - tokens.spacing[4]), animated: true });
    }
  }

  const setBudget = (patch: Partial<typeof draft.budget>) =>
    setDraft((current) => ({ ...current, budget: { ...current.budget, ...patch } }));
  const setFriendAmount = (index: number, text: string) =>
    setBudget({ friendAmountTexts: draft.friends.map((_, i) => (i === index ? text : (friendAmountTexts[i] ?? ''))) });
  // Razem → Osobno: everyone starts at the shared amount. Osobno → Razem: the organizer's amount is already the shared one.
  const setMode = (next: typeof mode) =>
    setBudget({ mode: next, ...(next === 'individual' && { friendAmountTexts: draft.friends.map(() => amountText) }) });

  return (
    <WizardScreen step="budget" scrollRef={scrollRef} action={{ label: t('newTrip.next'), onPress: next }}>
      <View style={{ gap: tokens.spacing[2] }}>
        <Text accessibilityRole="header" style={[tokens.typography.styles.headingLG, { color: theme.text.primary }]}>
          {t(solo ? 'newTrip.budget.headingSolo' : 'newTrip.budget.heading')}
        </Text>
        <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.secondary }]}>{t('newTrip.budget.hint')}</Text>
      </View>
      {!solo && (
        <SegmentedControl
          label={t('newTrip.budget.mode')}
          options={[
            { value: 'shared', label: t('newTrip.budget.modeShared') },
            { value: 'individual', label: t('newTrip.budget.modeIndividual') },
          ]}
          value={mode}
          onChange={setMode}
        />
      )}
      {individual ? (
        [t('newTrip.budget.you'), ...friendNames].map((name, i) => {
          const text = i === 0 ? amountText : (friendAmountTexts[i - 1] ?? '');
          return (
            <View key={i} testID={`budget-field-${i}`} onLayout={(event) => (fieldY.current[i] = event.nativeEvent.layout.y)}>
              <AmountField
                label={name}
                amountText={text}
                currency={currency}
                error={errorFor(text)}
                onChangeText={(value) => (i === 0 ? setBudget({ amountText: value }) : setFriendAmount(i - 1, value))}
              />
            </View>
          );
        })
      ) : (
        <AmountField
          label={t(solo ? 'newTrip.budget.amountSolo' : 'newTrip.budget.amountShared')}
          amountText={amountText}
          currency={currency}
          error={errorFor(amountText)}
          onChangeText={(text) => setBudget({ amountText: text })}
        />
      )}
      <View style={{ gap: tokens.spacing[1] }}>
        <Text style={[tokens.typography.styles.labelMD, { color: theme.text.primary }]}>{t('newTrip.budget.currency')}</Text>
        <SegmentedControl
          label={t('newTrip.budget.currency')}
          options={currencies.map((code) => ({ value: code, label: code }))}
          value={currency}
          onChange={(code) => setBudget({ currency: code })}
        />
      </View>
      {result.success && (
        <View style={{ gap: tokens.spacing[1] }}>
          {travellers > 1 && (
            <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.primary }]}>
              {t('newTrip.budget.groupTotal', { count: travellers, total: money(dailyMinor.reduce((sum, amount) => sum + amount, 0) * days) })}
            </Text>
          )}
          {individual ? (
            [t('newTrip.budget.you'), ...friendNames].map((name, i) => (
              <Text key={i} style={[tokens.typography.styles.bodyMD, { color: theme.text.secondary }]}>
                {t('newTrip.budget.personTotal', { name, total: money(dailyMinor[i] * days) })}
              </Text>
            ))
          ) : (
            <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.secondary }]}>
              {t(solo ? 'newTrip.summary.soloTotal' : 'newTrip.budget.tripTotal', { total: money(input.organizerDailyMinor * days) })}
            </Text>
          )}
        </View>
      )}
    </WizardScreen>
  );
}
