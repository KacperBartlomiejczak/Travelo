import { Pencil, Trash2, Wallet, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { useTheme } from '@/theme/legacy/useTheme';

type Props = {
  offline: boolean;
  onEditDetails: () => void;
  onChangeBudget: () => void;
  onDelete: () => void;
  onClose: () => void;
};

// The ⋮ menu (trip-edit-menu D3, D15): three list rows (§10.8). Name and delete are server-first (D5, D8), so offline
// they are disabled with a hint under the list; the budget works offline and stays enabled. No photos row until
// trip-photos ships (D6). Mounting opens the sheet, like BudgetSheet.
export function TripMenuSheet({ offline, onEditDetails, onChangeBudget, onDelete, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <BottomSheet visible title={t('tripMenu.title')} onClose={onClose}>
      <View>
        <MenuRow icon={Pencil} label={t('tripMenu.editDetails')} disabled={offline} onPress={onEditDetails} />
        <MenuRow icon={Wallet} label={t('tripMenu.changeBudget')} onPress={onChangeBudget} />
        <View testID="trip-menu-divider" style={{ height: 1, backgroundColor: theme.colors.divider }} />
        <MenuRow icon={Trash2} label={t('tripMenu.delete')} destructive disabled={offline} onPress={onDelete} />
      </View>
      {offline && <Text style={[theme.typography.bodyS, { color: theme.colors.text.secondary }]}>{t('tripMenu.offlineHint')}</Text>}
    </BottomSheet>
  );
}

type RowProps = { icon: LucideIcon; label: string; destructive?: boolean; disabled?: boolean; onPress: () => void };

function MenuRow({ icon: Icon, label, destructive = false, disabled = false, onPress }: RowProps) {
  const theme = useTheme();
  const { spacing, colors, size } = theme;
  // Disabled wins over the destructive colour: a greyed-out delete must not look tappable (D15).
  const color = disabled ? colors.text.tertiary : destructive ? colors.status.error : colors.text.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        // §10.8: rows are at least 64dp high.
        minHeight: spacing[16],
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingHorizontal: spacing[4],
        backgroundColor: pressed ? colors.surface.secondary : undefined,
      })}
    >
      <Icon testID="trip-menu-icon" aria-hidden size={size.iconStandard} strokeWidth={size.iconStroke} color={color} />
      <Text style={[theme.typography.bodyM, { color, flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
}
