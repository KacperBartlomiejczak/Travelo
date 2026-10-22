import { CircleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View, type TextStyle } from 'react-native';

import type { Theme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  /** For a control that is long (a list of chips): the hint and the error sit right under the label instead of under the control. */
  messagesFirst?: boolean;
  children: ReactNode;
};

const { input } = tokens.components;
const { styles } = tokens.typography;

// External label, control, helper or error line (design-context §8.4). A hint sits where the error would; while an error shows, the hint is hidden.
export function Field({ label, optional = false, hint, error, messagesFirst = false, children }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const messages =
    error || hint ? (
      <View testID="field-messages" style={messagesFirst ? { marginBottom: input.helperGap } : { marginTop: input.helperGap }}>
        {error ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[1] }}>
            <CircleAlert
              testID="field-error-icon"
              size={tokens.iconography.size.xs}
              strokeWidth={tokens.iconography.strokeWidth}
              color={theme.semantic.error.foreground}
              aria-hidden
            />
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.caption, { color: theme.semantic.error.foreground, flexShrink: 1 }]}
            >
              {error}
            </Text>
          </View>
        ) : (
          <Text style={[styles.caption, { color: theme.text.secondary }]}>{hint}</Text>
        )}
      </View>
    ) : null;
  return (
    <View>
      <Text style={[styles.labelMD, { color: theme.text.primary, marginBottom: input.labelGap }]}>
        {label}
        {optional && <Text style={{ color: theme.text.secondary }}>{` ${t('common.optional')}`}</Text>}
      </Text>
      {messagesFirst && messages}
      {children}
      {!messagesFirst && messages}
    </View>
  );
}

type InputState = { focused: boolean; error: boolean; disabled?: boolean };

/** 1dp border.default; 2dp border.focus when focused; 2dp error foreground on error (§8.4). Disabled stays 1dp default unless there is an error. */
export function inputBorder(theme: Theme, { focused, error, disabled = false }: InputState): { borderWidth: number; borderColor: string } {
  // D16: an error stays visible on a disabled field.
  if (error) return { borderWidth: input.focusBorderWidth, borderColor: theme.semantic.error.foreground };
  if (disabled) return { borderWidth: input.borderWidth, borderColor: theme.border.default };
  if (focused) return { borderWidth: input.focusBorderWidth, borderColor: theme.border.focus };
  return { borderWidth: input.borderWidth, borderColor: theme.border.default };
}

/** Box of a text-like control: 52dp, padding 16 less what the thicker border takes, radius 16 (§8.4). */
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
  const border = inputBorder(theme, state);
  return {
    minHeight: input.height,
    // Web: no browser focus outline over the 2dp focus border.
    outlineStyle: 'solid',
    outlineWidth: 0,
    // §8.4: the thicker focus/error border is paid for by the padding, so the text does not move.
    paddingHorizontal: input.horizontalPadding - (border.borderWidth - input.borderWidth),
    borderRadius: input.radius,
    backgroundColor: state.disabled ? theme.disabled.background : theme.surface.primary,
    ...border,
  };
}

export function inputTextStyle(theme: Theme, disabled = false): TextStyle {
  return { ...styles.bodyLG, color: disabled ? theme.disabled.foreground : theme.text.primary };
}

/** Cursor in brand.primary (§8.4). iOS has no separate cursor color; Android keeps its own selection highlight. */
export function inputCursorProps(theme: Theme): { cursorColor: string; selectionColor?: string } {
  return { cursorColor: theme.brand.primary, ...(Platform.OS === 'ios' && { selectionColor: theme.brand.primary }) };
}
