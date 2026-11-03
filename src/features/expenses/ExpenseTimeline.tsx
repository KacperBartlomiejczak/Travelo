import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { SyncIndicator } from '@/components/SyncIndicator';
import { groupExpensesByDay } from '@/lib/expense-budget';
import { formatMoney } from '@/lib/money';
import { useRequestBudgetSync } from '@/providers/BudgetSync';
import type { LocalExpense, PersonBudget } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { CATEGORY_META } from './category-meta';

type Props = {
  expenses: LocalExpense[];
  /** Same list the chart uses: it names the organizer ("Ty") and the friends. */
  people: PersonBudget[];
  currency: string;
  canEdit: (expense: { memberId: string | null }) => boolean;
  /** Without it the rows are plain (the sheet is wired in step 10). */
  onEditExpense?: (expense: LocalExpense) => void;
};

const { spacing, typography } = tokens;

// Expenses by day, newest first (expenses D12): a card per day with the date and the day total, then one row per expense.
// A row opens its edit only when the user may edit it (D15); a failed one can be retried from the row without opening it.
export function ExpenseTimeline({ expenses, people, currency, canEdit, onEditExpense }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const requestSync = useRequestBudgetSync();
  const days = useMemo(() => groupExpensesByDay(expenses), [expenses]);
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency }, i18n.language);
  const dayLabel = (spentOn: string) =>
    new Intl.DateTimeFormat(i18n.language, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${spentOn}T00:00:00Z`));

  return (
    <>
      {days.map((day) => (
        <Card key={day.spentOn} testID={`expense-day-${day.spentOn}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing[2] }}>
            <Text accessibilityRole="header" style={[typography.styles.headingSM, { color: theme.text.primary, flexShrink: 1 }]}>
              {dayLabel(day.spentOn)}
            </Text>
            <Text testID="expense-day-total" style={[typography.styles.moneyMD, { color: theme.text.secondary }]}>
              {money(day.totalMinor)}
            </Text>
          </View>
          {day.expenses.map((expense) => {
            const meta = CATEGORY_META.find(({ key }) => key === expense.category) ?? CATEGORY_META[CATEGORY_META.length - 1];
            const Icon = meta.icon;
            const category = t(`expenses.category.${meta.key}`);
            const person = people.find((p) => p.memberId === expense.memberId)?.displayName;
            const amount = money(expense.amount.amountMinor);
            const content = (
              <>
                <Icon aria-hidden size={tokens.iconography.size.md} strokeWidth={tokens.iconography.strokeWidth} color={theme.expenseCategory[meta.key]} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.styles.labelLG, { color: theme.text.primary }]}>{expense.name}</Text>
                  {person !== undefined && <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>{person}</Text>}
                </View>
                <Text style={[typography.styles.moneyMD, { color: theme.text.primary }]}>{amount}</Text>
              </>
            );
            const rowStyle = { minHeight: tokens.layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing[3] } as const;
            const a11y = {
              testID: `expense-row-${expense.id}`,
              accessibilityLabel: expense.name,
              accessibilityValue: { text: [category, person, amount].filter(Boolean).join(', ') },
            };
            return (
              <View key={expense.id} testID={`expense-item-${expense.id}`}>
                {onEditExpense && canEdit(expense) ? (
                  <Pressable
                    {...a11y}
                    accessibilityRole="button"
                    onPress={() => onEditExpense(expense)}
                    style={({ pressed }) => [rowStyle, { backgroundColor: pressed ? theme.background.sunken : undefined }]}
                  >
                    {content}
                  </Pressable>
                ) : (
                  <View {...a11y} accessible style={rowStyle}>
                    {content}
                  </View>
                )}
                <SyncIndicator status={expense.syncStatus} onRetry={requestSync} />
              </View>
            );
          })}
        </Card>
      ))}
    </>
  );
}
