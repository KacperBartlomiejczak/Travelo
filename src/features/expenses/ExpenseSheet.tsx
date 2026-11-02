import { CircleAlert } from 'lucide-react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { AmountField } from '@/components/AmountField';
import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field, inputBoxStyle } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { useDeleteExpense, useExpenseWriter, useSaveExpense } from '@/hooks/useExpenses';
import { currencyMinorDigits, formatAmountInput, parseAmountToMinor } from '@/lib/money';
import { useIsOffline } from '@/providers/BudgetSync';
import { EXPENSE_NAME_MAX_LENGTH, ExpenseFormSchema, ExpenseSchema, type ExpenseCategory, type LocalExpense, type TripOverview } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { CATEGORY_META } from './category-meta';

type Props = {
  overview: TripOverview;
  /** The expense being edited; null = a new one. */
  expense: LocalExpense | null;
  /** Default date of a new expense: today at the destination. */
  today: string;
  onClose: () => void;
  /** Called with the confirmation text when the expense is saved on the device. */
  onSaved: (message: string) => void;
};

const { spacing, typography } = tokens;

// Quick-add and edit of an expense (expenses D13, D15, D21; design-context §9.3): amount (focused), category, name, payer, date.
// Saved on the phone first, so it never waits for the network; the sheet closes once the local write is done.
export function ExpenseSheet({ overview, expense, today, onClose, onSaved }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const offline = useIsOffline();
  const { trip, members } = overview;
  const currency = trip.baseCurrency;
  const writer = useExpenseWriter(overview);
  const save = useSaveExpense(overview);
  const remove = useDeleteExpense(overview);
  // A linked friend writes only on their own row ("Ty", fixed); the owner chooses (null = the organizer).
  const [memberId, setMemberId] = useState<string | null>(expense ? expense.memberId : writer.isOwner ? null : writer.ownMemberId);
  const [amountText, setAmountText] = useState(() => (expense ? formatAmountInput(expense.amount.amountMinor, currency, i18n.language) : ''));
  const [category, setCategory] = useState<ExpenseCategory | null>(expense?.category ?? null);
  const [name, setName] = useState(expense?.name ?? '');
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? today);
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState<'save' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // A second tap lands before the mutation's pending state renders, so the guard is a ref.
  const writing = useRef(false);

  const amountMinor = parseAmountToMinor(amountText, currency, i18n.language);
  const amount = ExpenseSchema.shape.amount.safeParse({ amountMinor, currency });
  const form = ExpenseFormSchema.safeParse({ name, amountText, category: category ?? undefined, memberId, spentOn });
  const nameIssue = form.success ? undefined : form.error.issues.find((issue) => issue.path[0] === 'name');

  // Like the budget form: "not a number" shows while typing; empty and 0 only after Save is pressed (§9.3).
  let amountKey: string | undefined;
  if (amountText.trim() !== '' && amountMinor === null) {
    amountKey = currencyMinorDigits(currency) === 0 ? 'validation.amountInvalidWhole' : 'validation.amountInvalid';
  } else if (submitted && amountText.trim() === '') {
    amountKey = 'validation.amountRequired';
  } else if (submitted && amountMinor === 0) {
    amountKey = 'validation.amountPositive';
  }
  const categoryError = submitted && category === null ? t('validation.categoryRequired') : undefined;
  const nameError = submitted && nameIssue ? t(nameIssue.message, { max: EXPENSE_NAME_MAX_LENGTH }) : undefined;

  function submit() {
    if (writing.current) return;
    setSubmitted(true);
    setFailed(null);
    if (!amount.success || !form.success || category === null) {
      AccessibilityInfo.announceForAccessibility(t('newTrip.fixErrors'));
      return;
    }
    writing.current = true;
    save.mutate(
      { id: expense?.id, input: { name: form.data.name, amount: amount.data, category, memberId, spentOn } },
      {
        onSuccess: () => {
          onSaved(t(offline ? 'confirm.expenseSavedPending' : 'confirm.expenseSaved'));
          onClose();
        },
        onError: () => {
          writing.current = false;
          setFailed('save');
          AccessibilityInfo.announceForAccessibility(t('expenses.sheet.saveError'));
        },
      },
    );
  }

  function confirmRemove() {
    setConfirmDelete(false);
    if (!expense || writing.current) return;
    writing.current = true;
    remove.mutate(expense.id, {
      onSuccess: onClose,
      onError: () => {
        writing.current = false;
        setFailed('delete');
        AccessibilityInfo.announceForAccessibility(t('expenses.sheet.deleteError'));
      },
    });
  }

  const busy = save.isPending || remove.isPending;
  return (
    <BottomSheet visible title={t(expense ? 'expenses.sheet.editTitle' : 'expenses.sheet.addTitle')} onClose={onClose} dismissible={!busy}>
      {/* The fields scroll when the keyboard leaves little room; Save stays below them, above the keyboard. */}
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing[4] }}>
        <AmountField
          label={t('expenses.sheet.amount')}
          amountText={amountText}
          currency={currency}
          onChangeText={setAmountText}
          error={amountKey ? t(amountKey) : undefined}
          autoFocus
        />
        <Field label={t('expenses.sheet.category')} error={categoryError}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            {CATEGORY_META.map(({ key }) => (
              <Chip key={key} label={t(`expenses.category.${key}`)} selected={category === key} onToggle={() => setCategory(key)} />
            ))}
          </View>
        </Field>
        <TextField
          label={t('expenses.sheet.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('expenses.sheet.namePlaceholder')}
          maxLength={EXPENSE_NAME_MAX_LENGTH}
          autoCapitalize="sentences"
          error={nameError}
        />
        <Field label={t('expenses.sheet.who')}>
          {writer.isOwner ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
              {[{ id: null, displayName: t('newTrip.summary.you') }, ...members].map((person) => (
                <Chip key={person.id ?? 'organizer'} label={person.displayName} selected={memberId === person.id} onToggle={() => setMemberId(person.id)} />
              ))}
            </View>
          ) : (
            <Text style={[typography.styles.bodyLG, { color: theme.text.primary, minHeight: tokens.layout.touchTarget }]}>{t('newTrip.summary.you')}</Text>
          )}
        </Field>
        <DateField label={t('expenses.sheet.date')} value={spentOn} onChange={setSpentOn} />
        {expense && <TextButton variant="destructive" label={t('expenses.sheet.delete')} onPress={() => setConfirmDelete(true)} disabled={busy} />}
      </ScrollView>
      {failed && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
          <CircleAlert size={tokens.iconography.size.xs} strokeWidth={tokens.iconography.strokeWidth} color={theme.semantic.error.foreground} aria-hidden />
          <Text accessibilityLiveRegion="polite" style={[typography.styles.bodySM, { color: theme.semantic.error.foreground, flexShrink: 1 }]}>
            {t(failed === 'save' ? 'expenses.sheet.saveError' : 'expenses.sheet.deleteError')}
          </Text>
        </View>
      )}
      <PrimaryButton label={t('expenses.sheet.save')} onPress={submit} loading={save.isPending} disabled={remove.isPending} />
      <ConfirmDialog
        visible={confirmDelete}
        title={t('expenses.sheet.deleteTitle')}
        message={t('expenses.sheet.deleteBody')}
        confirmLabel={t('expenses.sheet.deleteConfirm')}
        cancelLabel={t('expenses.sheet.deleteCancel')}
        destructive
        onConfirm={confirmRemove}
        onCancel={() => setConfirmDelete(false)}
      />
    </BottomSheet>
  );
}

// Date only (expenses A5, no time). iOS: a wheel under the field; Android: a dialog that closes when answered. Shown in UTC so the
// calendar day never passes through the device time zone (like DateTimeField).
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (date: string) => void }) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const shown = new Intl.DateTimeFormat(i18n.language, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`));
  return (
    <Field label={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: shown }}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[inputBoxStyle(theme, { focused: focused || open, error: false }), { justifyContent: 'center' }]}
      >
        <Text style={[typography.styles.bodyLG, { color: theme.text.primary }]}>{shown}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          mode="date"
          display="spinner"
          presentation="dialog"
          value={new Date(`${value}T00:00:00Z`)}
          timeZoneName="UTC"
          locale={i18n.language}
          accentColor={theme.brand.primary}
          onDismiss={() => setOpen(false)}
          onValueChange={(_, date) => {
            onChange(date.toISOString().slice(0, 10));
            if (Platform.OS === 'android') setOpen(false);
          }}
        />
      )}
    </Field>
  );
}
