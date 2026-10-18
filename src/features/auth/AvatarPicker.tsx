import { Image } from 'expo-image';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';

import { ProfileSetupInputSchema } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

import { FormError } from './AuthFormScreen';

// The profile photo is square-cropped in the system picker (P2); the app downsizes and re-encodes it when the profile is saved.
const ASPECT: [number, number] = [1, 1];

// Only a file on the phone can be uploaded later: the picker's uri is checked with the setup form's own rule.
const AvatarUriSchema = ProfileSetupInputSchema.shape.avatarUri.unwrap();

type Props = {
  /** The picked photo, a `file://` uri; null while there is none. */
  uri: string | null;
  onPick: (uri: string) => void;
  disabled?: boolean;
};

/**
 * The optional profile photo of the profile setup (auth-onboarding P2, D20): a round placeholder with a camera icon that opens the
 * gallery, and a round preview of the picked photo in its place. Once a photo is chosen the label turns from "Dodaj zdjęcie" into "Zmień zdjęcie" (D21). Cancelling keeps what was chosen before; there is no way to
 * remove a photo. A gallery that cannot be opened (or a uri that is not a local file) is a fixed, announced error under the
 * picture, and the earlier choice stays.
 */
export function AvatarPicker({ uri, onPick, disabled = false }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [failed, setFailed] = useState(false);
  // A second tap before React renders anything (or while the gallery is still opening) must not open it again (D21).
  const picking = useRef(false);
  const { colors, spacing } = theme;
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
    width: theme.size.avatarSetup,
    height: theme.size.avatarSetup,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  };

  return (
    <View style={{ alignItems: 'center', gap: spacing[2] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={pick}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          { alignItems: 'center', gap: spacing[2], minHeight: theme.size.touchTarget, opacity: disabled ? theme.opacity.disabled : 1 },
          focused && {
            outlineStyle: 'solid',
            outlineWidth: theme.size.focusRing,
            outlineColor: colors.action.primary,
            outlineOffset: spacing[1],
            borderRadius: theme.radius.md,
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
                style={[circle, { borderColor: pressed ? colors.action.primary : colors.input.border, backgroundColor: colors.surface.secondary }]}
              />
            ) : (
              <View
                testID="avatar-placeholder"
                style={[
                  circle,
                  {
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderColor: pressed ? colors.action.primary : colors.input.border,
                    backgroundColor: pressed ? colors.surface.secondary : colors.surface.default,
                  },
                ]}
              >
                <Camera
                  testID="avatar-camera"
                  size={theme.size.iconFeature}
                  strokeWidth={theme.size.iconStroke}
                  color={colors.text.secondary}
                  aria-hidden
                />
              </View>
            )}
            <Text style={[theme.typography.bodyMMedium, { color: colors.text.primary }]}>{label}</Text>
          </>
        )}
      </Pressable>
      {failed && <FormError testID="avatar-error" message={t('auth.profile.avatarError')} />}
    </View>
  );
}
