import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { tripName: string; onPress: () => void };

const { spacing, typography } = tokens;
const { focusRing } = tokens.components;

// The trip bar (expenses D11): the current trip's name; a tap opens the side panel where another trip can be chosen.
export function ExpensesHeader({ tripName, onPress }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('trips.openList')}, ${tripName}`}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        {
          minHeight: tokens.layout.touchTarget,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
          alignSelf: 'flex-start',
          maxWidth: '100%',
          borderRadius: tokens.radii.sm,
          backgroundColor: pressed ? theme.background.sunken : undefined,
        },
        focused && {
          outlineStyle: 'solid',
          outlineWidth: focusRing.width,
          outlineOffset: focusRing.offset,
          outlineColor: theme.border.focus,
        },
      ]}
    >
      <Text accessibilityRole="header" numberOfLines={1} style={[typography.styles.headingLG, { color: theme.text.primary, flexShrink: 1 }]}>
        {tripName}
      </Text>
      <ChevronDown aria-hidden size={tokens.iconography.size.sm} strokeWidth={tokens.iconography.strokeWidth} color={theme.icon.primary} />
    </Pressable>
  );
}
