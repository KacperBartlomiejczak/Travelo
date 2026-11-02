import { CircleAlert, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { SegmentedControl } from '@/components/SegmentedControl';
import { formatMoney } from '@/lib/money';
import type { GroupBudget, PersonBudget } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { group: GroupBudget; me?: PersonBudget; currency: string; testID?: string };
type Scope = 'group' | 'me';
type BudgetState = 'under' | 'near' | 'over';

// Design-context §2.7 thresholds on today's allowance: up to 80% spent is under, up to 100% near, more is over.
// An allowance of zero or less with nothing left counts as near.
function todayState({ allowedMinor, leftMinor }: { allowedMinor: number; leftMinor: number }): BudgetState {
  if (leftMinor < 0) return 'over';
  return allowedMinor <= 0 || (allowedMinor - leftMinor) * 5 > allowedMinor * 4 ? 'near' : 'under';
}

const { spacing, typography } = tokens;

// What is left of the budget (expenses D7, D9, D10): the group by default, switchable to the own share. The "today" line
// exists only while the trip runs (the budget has no `today` outside it); the carryover only when it is above zero.
// Without an own row (`me` missing) there is nothing to switch to, so the toggle is left out.
export function BudgetHero({ group, me, currency, testID }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [scope, setScope] = useState<Scope>('group');
  const shown = scope === 'me' && me ? me : group;
  const money = (amountMinor: number) => formatMoney({ amountMinor: Math.abs(amountMinor), currency }, i18n.language);
  const today = shown.today;

  const todayText = today
    ? today.leftMinor > 0
      ? t('budget.today.left', { amount: money(today.leftMinor) })
      : today.leftMinor === 0
        ? t('budget.today.atLimit')
        : t('budget.today.over', { amount: money(today.leftMinor) })
    : null;
  const state = today ? todayState(today) : null;
  const overBudget = shown.leftMinor < 0;
  const iconProps = { 'aria-hidden': true, size: tokens.iconography.size.sm, strokeWidth: tokens.iconography.strokeWidth } as const;

  return (
    <Card testID={testID}>
      {me && (
        <SegmentedControl
          label={`${t('budget.group')} / ${t('budget.me')}`}
          options={[
            { value: 'group', label: t('budget.group') },
            { value: 'me', label: t('budget.me') },
          ]}
          value={scope}
          onChange={setScope}
        />
      )}
      <View style={{ gap: spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          {overBudget && <CircleAlert testID="budget-icon-over" color={theme.budget.over.foreground} {...iconProps} />}
          <Text style={[typography.styles.moneyXL, { color: overBudget ? theme.budget.over.foreground : theme.text.primary, flexShrink: 1 }]}>
            {overBudget ? t('budget.over', { amount: money(shown.leftMinor) }) : t('budget.left', { amount: money(shown.leftMinor) })}
          </Text>
        </View>
        {todayText && state && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: spacing[2],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderRadius: tokens.radii.sm,
              backgroundColor: theme.budget[state].background,
            }}
          >
            {state === 'near' && <TriangleAlert testID="budget-icon-near" color={theme.budget.near.foreground} {...iconProps} />}
            {state === 'over' && <CircleAlert testID="budget-icon-over" color={theme.budget.over.foreground} {...iconProps} />}
            <Text style={[typography.styles.bodyMD, { color: theme.budget[state].foreground, flexShrink: 1 }]}>{todayText}</Text>
          </View>
        )}
        {today && today.carryoverMinor > 0 && (
          <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>
            {t('budget.carryover', { amount: money(today.carryoverMinor) })}
          </Text>
        )}
      </View>
    </Card>
  );
}
