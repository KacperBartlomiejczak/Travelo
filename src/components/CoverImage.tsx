import { Image } from 'expo-image';
import { useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { resolveCoverSource, type CoverVariant } from '@/lib/cover-presets';
import type { CoverUrls } from '@/schemas';
import { useTheme } from '@/theme/legacy/useTheme';

type Props = {
  /** What is stored on the trip, or a photo just picked; anything else (e.g. a value from before covers) shows the default. */
  cover: string;
  /** Signed URLs of a gallery cover (`photo:`); without them the default preset shows. */
  urls?: CoverUrls;
  /** `full` for the hero and the large preview, `thumbnail` for small tiles and rows. */
  variant: CoverVariant;
  style?: StyleProp<ImageStyle>;
  testID?: string;
  /** Decorative (hidden from screen readers) unless the parent gives it a label. */
  accessibilityLabel?: string;
};

// One cover picture for the hero, the side panel and the picker (trip-covers C3): the placeholder surface sits behind it,
// it fades in over a short token duration (not at all with reduce motion, §9.4), a gallery cover is cached under a key
// of its own id so it shows offline, and a file that fails to load is replaced by the default preset (never a hole).
export function CoverImage({ cover, urls, variant, style, testID, accessibilityLabel }: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion() === true;
  // What failed, so the default shows once and a changed cover is tried afresh.
  const [failed, setFailed] = useState<string | null>(null);

  const identity = `${cover}|${variant}|${urls?.url ?? ''}`;
  const requested = resolveCoverSource(cover, urls, variant);
  const shown = failed === identity ? resolveCoverSource('', undefined, variant) : requested;

  return (
    <Image
      testID={testID}
      source={shown.source}
      contentFit="cover"
      transition={reduceMotion ? 0 : theme.duration.small}
      // A failing default has nothing left to fall back to, so it is not retried.
      onError={() => {
        if (!requested.isDefault) setFailed(identity);
      }}
      {...(accessibilityLabel ? { accessible: true, accessibilityLabel } : { 'aria-hidden': true })}
      style={[{ backgroundColor: theme.colors.surface.secondary }, style]}
    />
  );
}
