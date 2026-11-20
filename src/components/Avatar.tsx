import { Image } from "expo-image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { tokens } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

type Props = {
  name: string;
  /** One letter, computed by the caller. */
  initial: string;
  /** Picks the fallback colour; wraps around the palette. */
  colorIndex: number;
  /** Only the signed-in user's own photo is ever passed; everyone else shows the letter. */
  photoUri?: string;
  size?: AvatarSize;
  testID?: string;
};

// design-context §8.7 (letter fallback on a palette colour, decision D3 of plan-timeline): a photo when there is one,
// otherwise (or when it fails to load) one letter on a muted colour from `avatarFallback`.
export function Avatar({
  name,
  initial,
  colorIndex,
  photoUri,
  size = "xs",
  testID,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const dimension = tokens.components.avatar[size];
  const palette = theme.avatarFallback;
  const colors =
    palette[((colorIndex % palette.length) + palette.length) % palette.length]!;
  const showPhoto = photoUri !== undefined && failedUri !== photoUri;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("a11y.avatar", { name })}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {showPhoto ? (
        <Image
          testID="avatar-photo"
          source={{ uri: photoUri }}
          contentFit="cover"
          onError={() => setFailedUri(photoUri)}
          style={{ width: dimension, height: dimension }}
        />
      ) : (
        <Text
          style={[
            size === "xs" || size === "sm"
              ? tokens.typography.styles.labelSM
              : size === "md"
                ? tokens.typography.styles.labelMD
                : tokens.typography.styles.labelLG,
            { color: colors.foreground },
          ]}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}
