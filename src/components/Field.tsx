import { CircleX } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, type TextStyle } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';

type Props = { label: string; optional?: boolean; error?: string; children: ReactNode };

// Label above, control, error below (§10.4, D27).
export function Field({ label, optional = false, error, children }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[1] }}>
      <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary }]}>
        {label}
        {optional && <Text style={{ color: theme.colors.text.secondary }}>{` ${t('common.optional')}`}</Text>}
      </Text>
      {children}
      {error && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] }}>
          <CircleX
            size={theme.size.iconInline}
            strokeWidth={theme.size.iconStroke}
            color={theme.colors.status.error}
            aria-hidden
          />
          <Text accessibilityLiveRegion="polite" style={[theme.typography.bodyS, { color: theme.colors.status.error, flexShrink: 1 }]}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

type InputState = { focused: boolean; error: boolean };

/** 1dp input border, 2dp brand when focused, 2dp error (§10.4, D26). */
export function inputBorder(theme: Theme, { focused, error }: InputState): { borderWidth: number; borderColor: string } {
  return {
    borderWidth: focused || error ? 2 : 1,
    borderColor: error ? theme.colors.status.error : focused ? theme.colors.action.primary : theme.colors.input.border,
  };
}

/** Box of a text-like control: 52dp, padding 16, radius sm, surface background (§10.4, D27). */
// Plain numbers/strings so the style fits both View (Pressable) and Text (TextInput) props.
export function inputBoxStyle(
  theme: Theme,
  state: InputState,
): {
  minHeight: number;
  paddingHorizontal: number;
  borderRadius: number;
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  outlineStyle: 'solid';
  outlineWidth: number;
} {
  return {
    minHeight: theme.size.buttonPrimary,
    // Web: no browser focus outline over the 2dp focus border.
    outlineStyle: 'solid',
    outlineWidth: 0,
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface.default,
    ...inputBorder(theme, state),
  };
}

export function inputTextStyle(theme: Theme): TextStyle {
  return { ...theme.typography.bodyM, color: theme.colors.text.primary };
}
