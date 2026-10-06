import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text } from 'react-native';

import { AmountField } from '@/components/AmountField';
import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSetTripBudget } from '@/hooks/useTrips';
import { currencyMinorDigits, formatAmountInput, parseAmountToMinor } from '@/lib/money';
import { TripBudgetFormSchema, type TripSummary } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

type Props = { trip: TripSummary; onClose: () => void };

// Changing the budget per person of an existing trip (trips-supabase D5): amount only, in the trip's
// base currency. Saved on the phone first, so it works offline (D1); the sheet closes after saving (D13).
export function BudgetSheet({ trip, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const setBudget = useSetTripBudget();
  const currency = trip.baseCurrency;
  const solo = trip.travellerCount === 1;
  const [amountText, setAmountText] = useState(() => formatAmountInput(trip.budgetPerPerson.amountMinor, currency, i18n.language));
  const [submitted, setSubmitted] = useState(false);

  const amountMinor = parseAmountToMinor(amountText, currency, i18n.language);
  const result = TripBudgetFormSchema.safeParse({ budgetPerPerson: { amountMinor, currency } });

  // Same rules as the wizard's budget step (§10.5): not a number while typing; empty or zero on save.
  let errorKey: string | undefined;
  if (amountText.trim() !== '' && amountMinor === null) {
    errorKey = currencyMinorDigits(currency) === 0 ? 'validation.amountInvalidWhole' : 'validation.amountInvalid';
  } else if (submitted && amountText.trim() === '') {
    errorKey = 'validation.amountRequired';
  } else if (amountMinor === 0) {
    errorKey = 'validation.amountPositive';
  }

  function save() {
    setSubmitted(true);
    if (!result.success) {
      AccessibilityInfo.announceForAccessibility(t('newTrip.fixErrors'));
      return;
    }
    setBudget.mutate(
      { trip, amountMinor: result.data.budgetPerPerson.amountMinor },
      { onSuccess: onClose, onError: () => AccessibilityInfo.announceForAccessibility(t('home.saveBudgetError')) },
    );
  }

  return (
    <BottomSheet visible title={t(solo ? 'newTrip.budget.headingSolo' : 'newTrip.budget.heading')} onClose={onClose}>
      <Text style={[theme.typography.bodyM, { color: theme.colors.text.secondary }]}>{t('newTrip.budget.hint')}</Text>
      <AmountField
        label={t(solo ? 'newTrip.budget.amountSolo' : 'newTrip.budget.amount')}
        amountText={amountText}
        currency={currency}
        onChangeText={setAmountText}
        error={errorKey ? t(errorKey) : undefined}
      />
      {setBudget.isError && (
        <Text accessibilityLiveRegion="polite" style={[theme.typography.bodyS, { color: theme.colors.status.error }]}>
          {t('home.saveBudgetError')}
        </Text>
      )}
      <PrimaryButton label={t('home.saveBudget')} onPress={save} loading={setBudget.isPending} />
    </BottomSheet>
  );
}
