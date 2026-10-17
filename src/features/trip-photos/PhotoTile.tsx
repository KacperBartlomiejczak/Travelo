import { Image, type ImageSource } from 'expo-image';
import { CircleX, ImagePlus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import type { PhotoUpload } from '@/hooks/useTripPhotos';
import { photoPaths } from '@/lib/trip-photos';
import type { ShownTripPhoto } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

/** What one tile of the strip stands for: a photo on the server, or one on its way (trip-photos P3). */
export type StripItem = { kind: 'photo'; photo: ShownTripPhoto } | { kind: 'upload'; upload: PhotoUpload };

const SKELETON_TILES = 3; // trip-photos P3

/** 2dp brand ring while a tile has the keyboard / switch focus (§10.1, same as TextButton). */
function useFocusRing(): { focusProps: { onFocus: () => void; onBlur: () => void }; focusStyle: ViewStyle | undefined } {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return {
    focusProps: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
    focusStyle: focused
      ? {
          outlineStyle: 'solid',
          outlineWidth: theme.size.focusRing,
          outlineColor: theme.colors.action.primary,
          outlineOffset: theme.spacing[1],
        }
      : undefined,
  };
}

type TileProps = {
  label: string;
  /** Makes the tile a button; without it the tile is a plain labelled element. */
  onPress?: () => void;
  disabled?: boolean;
  /** Surface while pressed, for a tile that shows no photo; a photo darkens under the scrim instead. */
  pressedSurface?: string;
  testID?: string;
  children: ReactNode;
};

// One 80dp square (trip-photos P2): the outer element is the touch target and carries the focus ring, the inner one clips
// its content to the rounded corners, so the ring is not cut off.
function Tile({ label, onPress, disabled = false, pressedSurface, testID, children }: TileProps) {
  const theme = useTheme();
  const { colors, opacity, radius, size } = theme;
  const { focusProps, focusStyle } = useFocusRing();
  const box = { width: size.photoTile, height: size.photoTile, borderRadius: radius.md };
  const surface = (pressed: boolean) => (
    <View
      testID={testID}
      style={[
        StyleSheet.absoluteFill,
        {
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: radius.md,
          backgroundColor: pressed && pressedSurface ? pressedSurface : colors.surface.secondary,
        },
      ]}
    >
      {children}
      {pressed && !pressedSurface && (
        <View testID="photo-tile-pressed" style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay.scrim }]} />
      )}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={box}>
        {surface(false)}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[box, { opacity: disabled ? opacity.disabled : 1 }, focusStyle]}
    >
      {({ pressed }) => surface(pressed)}
    </Pressable>
  );
}

function TileImage({ source }: { source: ImageSource }) {
  return <Image testID="photo-tile-image" source={source} contentFit="cover" style={StyleSheet.absoluteFill} />;
}

// Ink at 50 % over the preview (the scrim of the bottom sheets); the icon and the spinner use the hero's light text,
// the pair that stays readable over a bright photo (trips-drawer P5).
function Scrim({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      testID="photo-tile-scrim"
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay.scrim }]}
    >
      {children}
    </View>
  );
}

type PhotoTileProps = {
  item: StripItem;
  /** 1-based place in the whole row, for the screen reader label. */
  index: number;
  count: number;
  /** A photo on the server is a button only when this is given (trip-photos D23). */
  onOpen?: (photoId: string) => void;
  onRetry: (uploadId: string) => void;
  /** The tile of a photo that could not be sent is disabled, e.g. while offline (trip-photos D24). */
  retryDisabled?: boolean;
};

/**
 * A photo of the trip, or one being sent (trip-photos P3): the thumbnail, cropped to the square (A6), cached under its
 * own storage path so a photo seen once still shows offline (A2). A photo on its way shows the local preview under the scrim
 * with a spinner; one that could not be sent shows the failed icon and sends again when pressed.
 */
export function PhotoTile({ item, index, count, onOpen, onRetry, retryDisabled = false }: PhotoTileProps) {
  const { t } = useTranslation();
  const { colors, size } = useTheme();
  const place = { index, count };

  if (item.kind === 'photo') {
    const { photo } = item;
    return (
      <Tile label={t('tripPhotos.photo', place)} onPress={onOpen && (() => onOpen(photo.id))}>
        <TileImage source={{ uri: photo.thumbnailUrl, cacheKey: photoPaths(photo).thumbnail }} />
      </Tile>
    );
  }

  const { upload } = item;
  if (upload.status === 'failed') {
    // A disabled tile has nothing to tap for, so its label leaves out the instruction (trip-photos D29).
    return (
      <Tile
        label={t(retryDisabled ? 'tripPhotos.photoFailedOffline' : 'tripPhotos.photoFailed', place)}
        onPress={() => onRetry(upload.id)}
        disabled={retryDisabled}
      >
        <TileImage source={{ uri: upload.uri }} />
        <Scrim>
          <CircleX testID="photo-tile-failed-icon" aria-hidden size={size.iconStandard} strokeWidth={size.iconStroke} color={colors.hero.text} />
        </Scrim>
      </Tile>
    );
  }
  return (
    <Tile label={t('tripPhotos.photoSending', place)}>
      <TileImage source={{ uri: upload.uri }} />
      <Scrim>
        <ActivityIndicator testID="photo-tile-spinner" size="small" color={colors.hero.text} />
      </Scrim>
    </Tile>
  );
}

/** The first tile of the strip (trip-photos P2): opens the gallery. Disabled offline (D8). */
export function AddPhotoTile({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  const { colors, size } = useTheme();
  return (
    <Tile label={t('tripPhotos.add')} onPress={onPress} disabled={disabled} pressedSurface={colors.surface.elevated} testID="photo-add-tile">
      <ImagePlus testID="photo-add-icon" aria-hidden size={size.iconPrimary} strokeWidth={size.iconStroke} color={colors.text.secondary} />
    </Tile>
  );
}

/**
 * Three static placeholders with the tiles' geometry while the photos load (§10.18, no shimmer). One element for a
 * screen reader: the strip's title, marked busy.
 */
export function PhotoSkeleton({ label }: { label: string }) {
  const { colors, radius, size, spacing } = useTheme();
  return (
    <View testID="photo-strip-loading" accessible accessibilityLabel={label} accessibilityState={{ busy: true }} style={{ flexDirection: 'row', gap: spacing[2] }}>
      {Array.from({ length: SKELETON_TILES }, (_, index) => (
        <View
          key={index}
          testID="photo-skeleton-tile"
          style={{ width: size.photoTile, height: size.photoTile, borderRadius: radius.md, backgroundColor: colors.surface.secondary }}
        />
      ))}
    </View>
  );
}
