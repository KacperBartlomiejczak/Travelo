import { Image, type ImageSource } from 'expo-image';
import { CircleAlert, ImagePlus } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { PhotoUpload } from '@/hooks/useTripPhotos';
import { photoPaths } from '@/lib/trip-photos';
import type { ShownTripPhoto } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** What one tile of the strip stands for: a photo on the server, or one on its way (trip-photos P3). */
export type StripItem = { kind: 'photo'; photo: ShownTripPhoto } | { kind: 'upload'; upload: PhotoUpload };

const SKELETON_TILES = 3; // trip-photos P3

const { photoStripHeight: TILE_SIZE } = tokens.screenMetrics.tripOverview; // the photo tile is a square of the strip's height (A4)
const { focusRing } = tokens.components;
const { duration: pulseDuration, minOpacity } = tokens.motion.microinteraction.skeletonPulse;

/** 2dp `border.focus` ring, 2dp off the tile, while a tile has the keyboard / switch focus (§8.0, same as TextButton). */
function useFocusRing(): { focusProps: { onFocus: () => void; onBlur: () => void }; focusStyle: ViewStyle | undefined } {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return {
    focusProps: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
    focusStyle: focused
      ? { outlineStyle: 'solid', outlineWidth: focusRing.width, outlineColor: theme.border.focus, outlineOffset: focusRing.offset }
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
// its content to the rounded corners, so the ring is not cut off. A disabled tile is the disabled surface, never dimmed (§8.0, A5).
function Tile({ label, onPress, disabled = false, pressedSurface, testID = 'photo-tile-surface', children }: TileProps) {
  const theme = useTheme();
  const { focusProps, focusStyle } = useFocusRing();
  const box = { width: TILE_SIZE, height: TILE_SIZE, borderRadius: tokens.radii.md };
  const surface = (pressed: boolean) => (
    <View
      testID={testID}
      style={[
        StyleSheet.absoluteFill,
        {
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: tokens.radii.md,
          backgroundColor: disabled ? theme.disabled.background : pressed && pressedSurface ? pressedSurface : theme.background.sunken,
        },
      ]}
    >
      {children}
      {pressed && !pressedSurface && (
        <View testID="photo-tile-pressed" style={[StyleSheet.absoluteFill, { backgroundColor: theme.hero.scrim }]} />
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
      style={[box, focusStyle]}
    >
      {({ pressed }) => surface(pressed)}
    </Pressable>
  );
}

function TileImage({ source }: { source: ImageSource }) {
  return <Image testID="photo-tile-image" source={source} contentFit="cover" style={StyleSheet.absoluteFill} />;
}

// The hero scrim over the preview; the icon and the spinner use `hero.text`, the pair made to stay readable over a
// bright photo (trips-drawer P5; sunline-redesign D6: text that really sits on a photo).
function Scrim({ children }: { children: ReactNode }) {
  const { hero } = useTheme();
  return (
    <View testID="photo-tile-scrim" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: hero.scrim }]}>
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
  const theme = useTheme();
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
    const alert = (color: string) => (
      <CircleAlert testID="photo-tile-failed-icon" aria-hidden size={tokens.iconography.size.sm} strokeWidth={tokens.iconography.strokeWidth} color={color} />
    );
    // A disabled tile has nothing to tap for, so its label leaves out the instruction (trip-photos D29). It drops the preview
    // for the disabled surface with the alert icon in the disabled foreground, instead of a dimmed photo (§8.0, A5).
    return (
      <Tile
        label={t(retryDisabled ? 'tripPhotos.photoFailedOffline' : 'tripPhotos.photoFailed', place)}
        onPress={() => onRetry(upload.id)}
        disabled={retryDisabled}
      >
        {retryDisabled ? (
          alert(theme.disabled.foreground)
        ) : (
          <>
            <TileImage source={{ uri: upload.uri }} />
            <Scrim>{alert(theme.hero.text)}</Scrim>
          </>
        )}
      </Tile>
    );
  }
  return (
    <Tile label={t('tripPhotos.photoSending', place)}>
      <TileImage source={{ uri: upload.uri }} />
      <Scrim>
        <ActivityIndicator testID="photo-tile-spinner" size="small" color={theme.hero.text} />
      </Scrim>
    </Tile>
  );
}

/** The first tile of the strip (trip-photos P2): opens the gallery. Disabled offline (D8). */
export function AddPhotoTile({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Tile label={t('tripPhotos.add')} onPress={onPress} disabled={disabled} pressedSurface={theme.surface.primary} testID="photo-add-tile">
      <ImagePlus
        testID="photo-add-icon"
        aria-hidden
        size={tokens.iconography.size.md}
        strokeWidth={tokens.iconography.strokeWidth}
        color={disabled ? theme.disabled.foreground : theme.icon.secondary}
      />
    </Tile>
  );
}

/**
 * Three placeholders with the tiles' geometry while the photos load (§8.19). They pulse their opacity 1 → minOpacity → 1
 * over `pulseDuration` (sunline-redesign D5, D19), and are static under reduce motion and until the system has answered.
 * One element for a screen reader: the strip's title, marked busy.
 */
export function PhotoSkeleton({ label }: { label: string }) {
  const theme = useTheme();
  const pulses = useReduceMotion() === false;
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!pulses) {
      opacity.setValue(1);
      return;
    }
    // JS driver: the native driver does not update the rendered style under Jest.
    const step = (toValue: number) =>
      Animated.timing(opacity, { toValue, duration: pulseDuration / 2, easing: Easing.bezier(...tokens.motion.easing.linear), useNativeDriver: false });
    const pulse = Animated.loop(Animated.sequence([step(minOpacity), step(1)]));
    pulse.start();
    return () => pulse.stop();
  }, [pulses, opacity]);

  return (
    <Animated.View
      testID="photo-strip-loading"
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={{ flexDirection: 'row', gap: tokens.spacing[2], opacity }}
    >
      {Array.from({ length: SKELETON_TILES }, (_, index) => (
        <View
          key={index}
          testID="photo-skeleton-tile"
          style={{ width: TILE_SIZE, height: TILE_SIZE, borderRadius: tokens.radii.md, backgroundColor: theme.skeleton.base }}
        />
      ))}
    </Animated.View>
  );
}
