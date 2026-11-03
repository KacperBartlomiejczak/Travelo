import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { formatMoney } from '@/lib/money';
import type { PersonBudget } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { CATEGORY_META } from './category-meta';

type Props = { person: PersonBudget | null; currency: string; onClose: () => void };

const { spacing, typography } = tokens;

// One person's spending by category (expenses D8): all five categories in the fixed order, zeros included.
export function PersonCategoriesSheet({ person, currency, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency }, i18n.language);
  return (
    <BottomSheet visible={person !== null} title={person?.displayName ?? ''} onClose={onClose}>
      {person && (
        <View style={{ gap: spacing[3], paddingBottom: spacing[2] }}>
          <Text style={[typography.styles.bodyMD, { color: theme.text.secondary }]}>{t('expenses.spent', { amount: money(person.spentMinor) })}</Text>
          {CATEGORY_META.map(({ key, icon: Icon }) => (
            <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: tokens.layout.touchTarget }}>
              <Icon aria-hidden size={tokens.iconography.size.md} strokeWidth={tokens.iconography.strokeWidth} color={theme.expenseCategory[key]} />
              <Text style={[typography.styles.bodyLG, { color: theme.text.primary, flex: 1 }]}>{t(`expenses.category.${key}`)}</Text>
              <Text style={[typography.styles.labelLG, { color: theme.text.primary }]}>{money(person.byCategory[key])}</Text>
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}
