import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View } from 'react-native';

import { AmountField } from '@/components/AmountField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { budgetCurrency, budgetCurrencyOptions } from '@/features/trip-create/draft';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import { useGoToNextStep, WizardScreen } from '@/features/trip-create/WizardScreen';
import { currencyMinorDigits, formatMoney, parseAmountToMinor } from '@/lib/money';
import { tripDayCount, perPersonPerDay } from '@/lib/trip-days';
import { deriveTripDates } from '@/lib/trip-dates';
import { BudgetStepInputSchema } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

// Step 3 — budget per person for the whole trip, without flights (D5, D8, D33–D37).
export default function BudgetStep() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { draft, setDraft } = useTripDraft();
  const goNext = useGoToNextStep('budget');
  const [submitted, setSubmitted] = useState(false);

  const currencies = budgetCurrencyOptions(draft);
  const currency = budgetCurrency(draft);
  const solo = draft.companionCount === 0;
  const { amountText } = draft.budget;
  const amountMinor = parseAmountToMinor(amountText, currency, i18n.language);
  const result = BudgetStepInputSchema.safeParse({ budgetPerPerson: { amountMinor, currency } });

  // §10.5: an amount that is not a number is flagged while typing; empty or zero only after "Next".
  let errorKey: string | undefined;
  if (amountText.trim() !== '' && amountMinor === null) {
    errorKey = currencyMinorDigits(currency) === 0 ? 'validation.amountInvalidWhole' : 'validation.amountInvalid';
  } else if (submitted && amountText.trim() === '') {
    errorKey = 'validation.amountRequired';
  } else if (amountMinor === 0) {
    errorKey = 'validation.amountPositive';
  }

  const travellers = draft.companionCount + 1;
  const { startDate, endDate } = deriveTripDates(draft);
  const budgetPerPerson = result.success ? result.data.budgetPerPerson : null;

  function next() {
    setSubmitted(true);
    if (result.success) goNext();
    else AccessibilityInfo.announceForAccessibility(t('newTrip.fixErrors'));
  }

  const setBudget = (patch: Partial<typeof draft.budget>) =>
    setDraft((current) => ({ ...current, budget: { ...current.budget, ...patch } }));

  return (
    <WizardScreen step="budget" action={{ label: t('newTrip.next'), onPress: next }}>
      <View style={{ gap: theme.spacing[2] }}>
        <Text accessibilityRole="header" style={[theme.typography.heading2, { color: theme.colors.text.primary }]}>
          {t(solo ? 'newTrip.budget.headingSolo' : 'newTrip.budget.heading')}
        </Text>
        <Text style={[theme.typography.bodyM, { color: theme.colors.text.secondary }]}>{t('newTrip.budget.hint')}</Text>
      </View>
      <AmountField
        label={t(solo ? 'newTrip.budget.amountSolo' : 'newTrip.budget.amount')}
        amountText={amountText}
        currency={currency}
        error={errorKey ? t(errorKey) : undefined}
        onChangeText={(text) => setBudget({ amountText: text })}
      />
      <View style={{ gap: theme.spacing[1] }}>
        <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary }]}>{t('newTrip.budget.currency')}</Text>
        <SegmentedControl
          label={t('newTrip.budget.currency')}
          options={currencies.map((code) => ({ value: code, label: code }))}
          value={currency}
          onChange={(code) => setBudget({ currency: code })}
        />
      </View>
      {budgetPerPerson && (
        <View style={{ gap: theme.spacing[1] }}>
          {travellers > 1 && (
            <Text style={[theme.typography.bodyM, { color: theme.colors.text.primary }]}>
              {t('newTrip.budget.groupTotal', {
                count: travellers,
                total: formatMoney({ ...budgetPerPerson, amountMinor: budgetPerPerson.amountMinor * travellers }, i18n.language),
              })}
            </Text>
          )}
          <Text style={[theme.typography.bodyM, { color: theme.colors.text.secondary }]}>
            {t('newTrip.budget.perDay', {
              amount: formatMoney(perPersonPerDay(budgetPerPerson, tripDayCount(startDate, endDate)), i18n.language),
            })}
          </Text>
        </View>
      )}
    </WizardScreen>
  );
}
