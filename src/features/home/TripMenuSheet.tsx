import { Pencil, Trash2, Wallet, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  offline: boolean;
  onEditDetails: () => void;
  onChangeBudget: () => void;
  onDelete: () => void;
  onClose: () => void;
};

const { listRow, focusRing, card } = tokens.components;

// The ⋮ menu (trip-edit-menu D3, D15): three list rows (§8.8). Name and delete are server-first (D5, D8), so offline
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
        {/* Full width: it groups the destructive row apart from the other two (§8.8 "unless grouping semantics require full width"). */}
        <View testID="trip-menu-divider" style={{ height: card.borderWidth, backgroundColor: theme.border.subtle }} />
        <MenuRow icon={Trash2} label={t('tripMenu.delete')} destructive disabled={offline} onPress={onDelete} />
      </View>
      {offline && <Text style={[tokens.typography.styles.bodySM, { color: theme.text.secondary }]}>{t('tripMenu.offlineHint')}</Text>}
    </BottomSheet>
  );
}

type RowProps = { icon: LucideIcon; label: string; destructive?: boolean; disabled?: boolean; onPress: () => void };

// List row (§8.8): at least 56dp high, 16dp / 12dp padding; pressed is `background.sunken`; focused a 2dp inset `border.focus`
// paid for by the padding so the content stays put.
function MenuRow({ icon: Icon, label, destructive = false, disabled = false, onPress }: RowProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  // Disabled wins over the destructive colour: a greyed-out delete must not look tappable (D15).
  const textColor = disabled ? theme.disabled.foreground : destructive ? theme.semantic.error.foreground : theme.text.primary;
  const iconColor = disabled ? theme.disabled.foreground : destructive ? theme.semantic.error.foreground : theme.icon.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: listRow.minHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing[3],
        paddingHorizontal: listRow.horizontalPadding - (focused ? focusRing.width : 0),
        paddingVertical: listRow.verticalPadding - (focused ? focusRing.width : 0),
        backgroundColor: pressed ? theme.background.sunken : undefined,
        ...(focused ? { borderWidth: focusRing.width, borderColor: theme.border.focus } : {}),
      })}
    >
      <Icon testID="trip-menu-icon" aria-hidden size={tokens.iconography.size.sm} strokeWidth={tokens.iconography.strokeWidth} color={iconColor} />
      <Text style={[tokens.typography.styles.bodyMD, { color: textColor, flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
}
