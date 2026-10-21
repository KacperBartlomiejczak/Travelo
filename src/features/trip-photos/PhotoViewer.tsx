import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { CircleX, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroIconButton } from '@/components/HeroIconButton';
import { TextButton } from '@/components/TextButton';
import { useTripPhotos } from '@/hooks/useTripPhotos';
import { photoPaths } from '@/lib/trip-photos';
import { useIsOffline } from '@/providers/BudgetSync';
import type { ShownTripPhoto } from '@/schemas';
import { useTheme } from '@/theme/legacy/useTheme';

import { DeletePhotoSheet } from './DeletePhotoSheet';

// Above the pages, so the buttons stay drawn over the photo and are reached first by screen readers (as HeroMenuButton).
const ABOVE_CONTENT = 1;
// Pages mounted around the one on screen: one viewport each side. Every page is a picture up to 2048 px, so the default
// window of 21 would download and decode a whole trip at once.
const WINDOW_SIZE = 3;
const INITIAL_PAGES = 3;

type Props = {
  tripId: string;
  /** The photo to open on; the first one when it is missing or no longer in the trip. */
  photoId?: string;
  /**
   * Whether the signed-in user is the trip's organizer; undefined while that is not known yet. Only the organizer deletes
   * (friend-invite A3): delete shows only when this is true, and the offline hint about it is left out only when it is false.
   */
  isOwner: boolean | undefined;
  onClose: () => void;
};

/**
 * One photo of the trip at a time, full screen on ink (trip-photos D6, P4): swipe sideways between photos, "Usuń zdjęcie"
 * with a confirmation (P5). The photos come from the same query as the strip, so a photo seen there is here at once.
 * Loading and a failed read keep the close button; with no photo left there is nothing to show, so it closes.
 */
export function PhotoViewer({ tripId, photoId, isOwner, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, size, spacing, typography } = useTheme();
  const photos = useTripPhotos(tripId);
  const offline = useIsOffline();
  const list = photos.data;
  const empty = list?.length === 0;

  // Closing is a navigation; a second render before the screen is gone must not pop another screen.
  const closing = useRef(false);
  useEffect(() => {
    if (empty && !closing.current) {
      closing.current = true;
      onClose();
    }
  }, [empty, onClose]);

  let body: ReactNode = null;
  if (list && list.length > 0) {
    body = <Pager photos={list} photoId={photoId} canDelete={isOwner === true} onClose={onClose} />;
  } else if (!list && photos.isPending) {
    // Same name as the strip's skeleton (trip-photos D27): the screen reader hears that the photos are coming.
    body = (
      <Chrome onClose={onClose}>
        <View
          testID="photo-viewer-loading"
          accessible
          accessibilityLabel={t('tripPhotos.title')}
          accessibilityState={{ busy: true }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={colors.hero.text} />
        </View>
      </Chrome>
    );
  } else if (!list) {
    body = (
      <Chrome onClose={onClose}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[5] }}>
          <CircleX aria-hidden size={size.iconFeature} strokeWidth={size.iconStroke} color={colors.status.error} />
          <Text style={[typography.bodyM, { color: colors.text.primary, textAlign: 'center' }]}>{t('tripPhotos.loadError')}</Text>
          <TextButton variant="secondary" label={t('tripPhotos.retry')} onPress={() => photos.refetch()} />
        </View>
      </Chrome>
    );
  }

  return (
    <View testID="photo-viewer" style={{ flex: 1, backgroundColor: colors.hero.background }}>
      <StatusBar style="light" />
      {body}
      {offline && isOwner !== false && <OfflineHint />}
    </View>
  );
}

// Offline the photos on the phone still show, but delete is off (trip-photos D8, D33): the reason sits at the bottom,
// above the bottom safe area. The same text as under the strip.
function OfflineHint() {
  const { t } = useTranslation();
  const { colors, spacing, typography, breakpoints } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const side = width < breakpoints.compact ? spacing[4] : spacing[5];
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', zIndex: ABOVE_CONTENT, left: side, right: side, bottom: insets.bottom + spacing[4], alignItems: 'center' }}
    >
      <Pill testID="photo-viewer-offline-hint">
        <Text style={[typography.bodyS, { color: colors.hero.text, textAlign: 'center' }]}>{t('tripPhotos.offlineHint')}</Text>
      </Pill>
    </View>
  );
}

// The backing of the counter and the offline hint (trip-photos D32, D35): the round buttons' colour and rounding, so the
// text reads over any photo. It wraps its text.
function Pill({ testID, children }: { testID: string; children: ReactNode }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      testID={testID}
      style={{ backgroundColor: colors.hero.control, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }}
    >
      {children}
    </View>
  );
}

type ChromeProps = {
  onClose: () => void;
  /** "3 z 12": shown between the buttons. */
  counter?: ReactNode;
  /** The delete button is there only when the viewer has a photo to delete. */
  onDelete?: () => void;
  deleteDisabled?: boolean;
  /** The screen below the buttons. */
  children?: ReactNode;
};

// The top row over the photo (trip-photos P4): "Zamknij" left, the counter in the middle, "Usuń zdjęcie" right, pinned
// under the status bar like the menu button of the trip view. The counter sits between two 44dp slots, so it stays centred.
function Chrome({ onClose, counter, onDelete, deleteDisabled = false, children }: ChromeProps) {
  const { t } = useTranslation();
  const { spacing, size, breakpoints } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const side = width < breakpoints.compact ? spacing[4] : spacing[5];
  return (
    <>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          zIndex: ABOVE_CONTENT,
          top: insets.top + spacing[2],
          left: side,
          right: side,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[2],
        }}
      >
        <HeroIconButton icon={X} label={t('photoViewer.close')} onPress={onClose} />
        {counter}
        {onDelete ? (
          <HeroIconButton icon={Trash2} label={t('photoViewer.delete')} onPress={onDelete} disabled={deleteDisabled} />
        ) : (
          <View style={{ width: size.touchTarget }} />
        )}
      </View>
      {children}
    </>
  );
}

type PagerProps = { photos: ShownTripPhoto[]; photoId?: string; canDelete: boolean; onClose: () => void };

// The photos in a paging list, one window wide. Mounted only when there is a photo, so it opens on the right one
// from the first render (`initialScrollIndex` needs `getItemLayout`, which a fixed page width gives).
function Pager({ photos, photoId, canDelete, onClose }: PagerProps) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const offline = useIsOffline();
  const { width, height } = useWindowDimensions();
  const [initialIndex] = useState(() => Math.max(0, photos.findIndex((photo) => photo.id === photoId)));
  // The photo in view (trip-photos D34) and the page the list is scrolled to. A swipe sets both.
  const [view, setView] = useState(() => ({ id: photos[initialIndex].id, index: initialIndex }));
  const [toDelete, setToDelete] = useState<ShownTripPhoto | null>(null);
  const listRef = useRef<FlatList<ShownTripPhoto>>(null);

  // The viewer stays on the same photo when the list changes: a photo that sorts before it only moves its place. A deleted
  // photo is gone, so the one that took its place shows (the previous one when it was last, trip-photos P5).
  const last = photos.length - 1;
  const found = photos.findIndex((photo) => photo.id === view.id);
  const shown = found >= 0 ? found : Math.min(view.index, last);
  // From now on follow the photo that took the deleted one's place (React's way of adjusting state while rendering).
  if (found < 0) setView({ id: photos[shown].id, index: view.index });
  useEffect(() => {
    // The list is scrolled to another page than the photo's place: a photo was added before it, or the last one was deleted.
    if (shown !== view.index) listRef.current?.scrollToIndex({ index: shown, animated: false });
  }, [shown, view.index]);

  // The counter follows the page nearest to the centre, so it changes halfway through a swipe.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.min(Math.max(Math.round(event.nativeEvent.contentOffset.x / width), 0), last);
    setView({ id: photos[page].id, index: page });
  };

  const place = { index: shown + 1, count: photos.length };
  return (
    <>
      <Chrome
        onClose={onClose}
        onDelete={canDelete ? () => setToDelete(photos[shown]) : undefined}
        deleteDisabled={offline}
        counter={
          // A pill in the backing of the round buttons (trip-photos D32), so the counter reads over any photo.
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Pill testID="photo-viewer-counter">
              {/* Read as a photo of the trip, and announced on every swipe. */}
              <Text
                accessibilityLabel={t('tripPhotos.photo', place)}
                accessibilityLiveRegion="polite"
                style={[typography.caption, { color: colors.hero.textSecondary, textAlign: 'center' }]}
              >
                {t('photoViewer.counter', place)}
              </Text>
            </Pill>
          </View>
        }
      />
      <FlatList
        ref={listRef}
        testID="photo-viewer-pager"
        horizontal
        pagingEnabled
        data={photos}
        keyExtractor={(photo) => photo.id}
        renderItem={({ item }) => <PhotoPage photo={item} width={width} height={height} />}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        initialScrollIndex={initialIndex}
        initialNumToRender={INITIAL_PAGES}
        windowSize={WINDOW_SIZE}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
      />
      {toDelete && <DeletePhotoSheet photo={toDelete} onClose={() => setToDelete(null)} onDeleted={() => setToDelete(null)} />}
    </>
  );
}

type PageProps = { photo: ShownTripPhoto; width: number; height: number };

// One photo, whole (`contain`, trip-photos A6), cached under its storage path so a photo seen once still shows offline (A2).
// The picture is decoration for a screen reader: the counter names the photo.
function PhotoPage({ photo, width, height }: PageProps) {
  const { t } = useTranslation();
  const { colors, size, spacing, typography } = useTheme();
  // The address that failed, not a flag: a signed address that was renewed (R5) is tried again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === photo.url;
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      {failed ? (
        <View style={{ alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[5] }}>
          <CircleX aria-hidden size={size.iconFeature} strokeWidth={size.iconStroke} color={colors.status.error} />
          <Text style={[typography.bodyM, { color: colors.text.primary, textAlign: 'center' }]}>{t('photoViewer.loadError')}</Text>
        </View>
      ) : (
        <Image
          testID="photo-viewer-image"
          accessible={false}
          source={{ uri: photo.url, cacheKey: photoPaths(photo).file }}
          contentFit="contain"
          onError={() => setFailedUrl(photo.url)}
          style={{ position: 'absolute', width, height }}
        />
      )}
    </View>
  );
}
