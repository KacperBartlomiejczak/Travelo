import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { formatMoney } from '@/lib/money';
import type { PersonBudget } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { CATEGORY_META } from './category-meta';
import { PersonCategoriesSheet } from './PersonCategoriesSheet';

type Props = { people: PersonBudget[]; currency: string };

const { spacing, typography } = tokens;

// Who spent what (expenses D8): one horizontal bar per traveler, organizer first (the order of `people`), split into the
// category colors. The track is the person's budget (spent + left), so the fill is the share of it used; over budget fills
// all of it (shortcut: the overshoot has no extra length, the "over budget" text says by how much). Pressing a row opens
// that person's categories.
export function SpendByPersonChart({ people, currency }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [selected, setSelected] = useState<PersonBudget | null>(null);
  const money = (amountMinor: number) => formatMoney({ amountMinor: Math.abs(amountMinor), currency }, i18n.language);

  return (
    <Card testID="spend-by-person">
      <Text accessibilityRole="header" style={[typography.styles.headingSM, { color: theme.text.primary }]}>
        {t('expenses.who')}
      </Text>
      {people.map((person) => {
        const id = person.memberId ?? 'organizer';
        const budget = person.spentMinor + person.leftMinor;
        const fill = person.spentMinor <= 0 ? 0 : budget <= 0 ? 1 : Math.min(1, person.spentMinor / budget);
        const spentText = t('expenses.spent', { amount: money(person.spentMinor) });
        const leftText = person.leftMinor < 0 ? t('budget.over', { amount: money(person.leftMinor) }) : t('budget.left', { amount: money(person.leftMinor) });
        return (
          <Pressable
            key={id}
            testID={`spend-row-${id}`}
            accessibilityRole="button"
            accessibilityLabel={person.displayName}
            accessibilityValue={{ text: `${spentText}, ${leftText}` }}
            onPress={() => setSelected(person)}
            style={({ pressed }) => ({
              minHeight: tokens.layout.touchTarget,
              justifyContent: 'center',
              gap: spacing[2],
              backgroundColor: pressed ? theme.background.sunken : undefined,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] }}>
              <Text style={[typography.styles.labelLG, { color: theme.text.primary, flexShrink: 1 }]}>{person.displayName}</Text>
              <Text style={[typography.styles.bodyMD, { color: theme.text.secondary, flexShrink: 1, textAlign: 'right' }]}>{spentText}</Text>
            </View>
            {/* The bar is decoration for the numbers around it: the row's label and value already carry them. */}
            <View
              aria-hidden
              importantForAccessibility="no-hide-descendants"
              style={{
                height: tokens.components.progress.trackHeight,
                borderRadius: tokens.components.progress.radius,
                backgroundColor: theme.background.sunken,
                overflow: 'hidden',
              }}
            >
              <View testID={`spend-fill-${id}`} style={{ width: `${Math.round(fill * 100)}%`, height: '100%', flexDirection: 'row' }}>
                {CATEGORY_META.map(({ key }) =>
                  person.byCategory[key] > 0 ? (
                    <View
                      key={key}
                      testID={`spend-segment-${id}-${key}`}
                      style={{ flex: person.byCategory[key], backgroundColor: theme.expenseCategory[key] }}
                    />
                  ) : null,
                )}
              </View>
            </View>
            <Text style={[typography.styles.bodySM, { color: person.leftMinor < 0 ? theme.budget.over.foreground : theme.text.secondary }]}>{leftText}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing[3], rowGap: spacing[1] }}>
              {CATEGORY_META.map(({ key, icon: Icon }) =>
                person.byCategory[key] > 0 ? (
                  <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
                    <Icon
                      testID={`spend-legend-icon-${id}-${key}`}
                      aria-hidden
                      size={tokens.iconography.size.sm}
                      strokeWidth={tokens.iconography.strokeWidth}
                      color={theme.expenseCategory[key]}
                    />
                    <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>{t(`expenses.category.${key}`)}</Text>
                    <Text style={[typography.styles.bodySM, { color: theme.text.primary }]}>{money(person.byCategory[key])}</Text>
                  </View>
                ) : null,
              )}
            </View>
          </Pressable>
        );
      })}
      <PersonCategoriesSheet person={selected} currency={currency} onClose={() => setSelected(null)} />
    </Card>
  );
}
