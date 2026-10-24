import { Image } from 'expo-image';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AvatarUriSchema } from '@/lib/avatar';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { FormError } from './AuthFormScreen';

// The profile photo is square-cropped in the system picker (P2); the app downsizes and re-encodes it when the profile is saved.
const ASPECT: [number, number] = [1, 1];

const { avatar, focusRing, input } = tokens.components;

type Props = {
  /** The picked photo, a `file://` uri; null while there is none. */
  uri: string | null;
  onPick: (uri: string) => void;
  disabled?: boolean;
  /** A photo is on its way (the account photo of a Google / Discord sign-in): a spinner in the circle, and the button waits. */
  loading?: boolean;
};

/**
 * The optional profile photo of the profile setup (auth-onboarding P2, D20): a round placeholder with a camera icon that opens the
 * gallery, and a round preview of the picked photo in its place. While a suggested photo downloads the circle shows a spinner (not a camera) and the button is busy and
 * disabled (theme-split-and-profile-prefill P7). Once a photo is chosen the label turns from "Dodaj zdjęcie" into "Zmień zdjęcie" (D21). Cancelling keeps what was chosen before; there is no way to
 * remove a photo. A gallery that cannot be opened (or a uri that is not a local file) is a fixed, announced error under the
 * picture, and the earlier choice stays.
 */
export function AvatarPicker({ uri, onPick, disabled = false, loading = false }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [failed, setFailed] = useState(false);
  // A second tap before React renders anything (or while the gallery is still opening) must not open it again (D21).
  const picking = useRef(false);
  const { spacing } = tokens;
  const label = t(uri ? 'auth.profile.avatarChange' : 'auth.profile.avatar');

  function fail() {
    setFailed(true);
    AccessibilityInfo.announceForAccessibility(t('auth.profile.avatarError'));
  }

  async function pick() {
    if (picking.current) return;
    picking.current = true;
    setFailed(false);
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: ASPECT });
      if (result.canceled) return;
      const picked = AvatarUriSchema.safeParse(result.assets[0].uri);
      if (!picked.success) return fail();
      onPick(picked.data);
    } catch {
      fail();
    } finally {
      picking.current = false;
    }
  }

  const circle = {
    width: avatar.xxl,
    height: avatar.xxl,
    borderRadius: tokens.radii.pill,
    borderWidth: input.borderWidth,
  };

  return (
    <View style={{ alignItems: 'center', gap: spacing[2] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        disabled={disabled || loading}
        onPress={pick}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          { alignItems: 'center', gap: spacing[2], minHeight: tokens.layout.touchTarget },
          focused && {
            outlineStyle: 'solid',
            outlineWidth: focusRing.width,
            outlineColor: theme.border.focus,
            outlineOffset: focusRing.offset,
            borderRadius: tokens.radii.md,
          },
        ]}
      >
        {({ pressed }) => (
          <>
            {uri ? (
              <Image
                testID="avatar-preview"
                source={{ uri }}
                contentFit="cover"
                aria-hidden
                style={[circle, { borderColor: pressed ? theme.border.interactive : theme.border.default, backgroundColor: theme.background.sunken }]}
              />
            ) : (
              <View
                testID="avatar-placeholder"
                style={[
                  circle,
                  {
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderColor: pressed ? theme.border.interactive : theme.border.default,
                    backgroundColor: disabled ? theme.disabled.background : pressed ? theme.background.sunken : theme.surface.primary,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator testID="avatar-loading" color={theme.icon.secondary} />
                ) : (
                  <Camera
                    testID="avatar-camera"
                    size={tokens.iconography.size.xl}
                    strokeWidth={tokens.iconography.strokeWidth}
                    color={disabled ? theme.icon.disabled : theme.icon.secondary}
                    aria-hidden
                  />
                )}
              </View>
            )}
            <Text style={[tokens.typography.styles.labelMD, { color: disabled ? theme.disabled.foreground : theme.text.primary }]}>{label}</Text>
          </>
        )}
      </Pressable>
      {failed && <FormError testID="avatar-error" message={t('auth.profile.avatarError')} />}
    </View>
  );
}
