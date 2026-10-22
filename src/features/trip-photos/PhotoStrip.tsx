import { CircleAlert } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Text, View } from 'react-native';

import { TextButton } from '@/components/TextButton';
import { usePhotoUploads, useTripPhotos, type PhotoUpload } from '@/hooks/useTripPhotos';
import { compareTakenAt } from '@/lib/trip-photos';
import { useIsOffline } from '@/providers/BudgetSync';
import type { ShownTripPhoto } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { pickTripPhotos } from './pick-trip-photos';
import { AddPhotoTile, PhotoSkeleton, PhotoTile, type StripItem } from './PhotoTile';

const takenAtOf = (item: StripItem) => (item.kind === 'photo' ? item.photo.takenAt : item.upload.takenAt);

/**
 * The strip's tiles in display order: the photos on the server and the photos being sent in one list, by date taken,
 * oldest first, so a photo being sent already sits where it will stay (trip-photos D10, D13, P6).
 * At the same place (the same date taken, or both without one) photos come before uploads, and each keeps its own
 * order: the list's for photos (already sorted), the queue's for uploads. An upload whose photo is in the list already
 * is left out: between the list being read again and the queue letting go of it, the same photo is in both.
 */
export function mergeStripItems(photos: readonly ShownTripPhoto[], uploads: readonly PhotoUpload[]): StripItem[] {
  const sent = new Set(photos.map((photo) => photo.id));
  const items: StripItem[] = [
    ...photos.map((photo): StripItem => ({ kind: 'photo', photo })),
    ...uploads.filter((upload) => !sent.has(upload.id)).map((upload): StripItem => ({ kind: 'upload', upload })),
  ];
  // The position in `items` (photos, then uploads) breaks ties, so the result never depends on the sort being stable.
  return items
    .map((item, position) => ({ item, position }))
    .sort((a, b) => compareTakenAt(takenAtOf(a.item), takenAtOf(b.item)) || a.position - b.position)
    .map(({ item }) => item);
}

const keyOf = (item: StripItem) => (item.kind === 'photo' ? item.photo.id : item.upload.id);

type Props = {
  tripId: string;
  /** The row's padding at both ends, so its first tile lines up with the cards (trip-photos P1). */
  sidePadding: number;
  /** Opens a photo full screen. A photo's tile is a button only when this is given (trip-photos D23). */
  onOpenPhoto?: (photoId: string) => void;
  /** A friend linked by code only looks (friend-invite A3): no add tile, and no hint about adding or deleting. The home screen does not mount it for a trip without photos (D17). */
  readOnly?: boolean;
};

/**
 * The trip's photos under the hero (trip-photos P1–P3): the add tile first, then the photos and the ones being sent,
 * in a row that scrolls sideways. A FlatList, not a ScrollView: a trip has no limit on photos, and only the tiles
 * near the screen are mounted. Loading, empty, error, sending, failed and offline states are shown next to or under it.
 */
export function PhotoStrip({ tripId, sidePadding, onOpenPhoto, readOnly = false }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { spacing, typography } = tokens;
  const offline = useIsOffline();
  const photos = useTripPhotos(tripId);
  const uploads = usePhotoUploads(tripId);
  // The trip the gallery failed to open for, so the message does not follow the user to another trip.
  const [pickFailedFor, setPickFailedFor] = useState<string | null>(null);
  const picking = useRef(false);

  const items = mergeStripItems(photos.data ?? [], uploads.items);
  const title = t('tripPhotos.title');
  const loading = photos.isPending;
  // A list already shown stays when a later read fails (§12); the error shows only when there is nothing to show.
  const loadFailed = photos.isError && photos.data === undefined;
  const pickFailed = pickFailedFor === tripId;

  async function pick() {
    // A second tap while the gallery is opening would make the OS refuse the second request.
    if (picking.current) return;
    picking.current = true;
    setPickFailedFor(null);
    try {
      uploads.add(await pickTripPhotos());
    } catch {
      setPickFailedFor(tripId);
    } finally {
      picking.current = false;
    }
  }

  const addTile = readOnly ? null : <AddPhotoTile onPress={() => void pick()} disabled={offline} />;
  const loadError = (
    <View style={{ flexShrink: 1, alignItems: 'flex-start', gap: spacing[1] }}>
      <StatusLine tone="error">{t('tripPhotos.loadError')}</StatusLine>
      <TextButton variant="ghost" label={t('tripPhotos.retry')} onPress={() => photos.refetch()} />
    </View>
  );

  // With nothing to show, the add tile sits in a plain row so its hint, error or skeletons wrap next to it.
  // Photos or uploads in the list: the list takes over, and a failed read goes under it (see `lines`).
  const row =
    items.length > 0 ? (
      <FlatList
        horizontal
        accessibilityLabel={title}
        data={items}
        keyExtractor={keyOf}
        renderItem={({ item, index }) => (
          <PhotoTile
            item={item}
            index={index + 1}
            count={items.length}
            onOpen={onOpenPhoto}
            onRetry={uploads.retry}
            retryDisabled={offline}
          />
        )}
        ListHeaderComponent={addTile ?? undefined}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: sidePadding, gap: spacing[2] }}
      />
    ) : (
      <View
        accessibilityLabel={loading ? undefined : title}
        style={{ flexDirection: 'row', alignItems: 'center', gap: loading ? spacing[2] : spacing[3], paddingHorizontal: sidePadding }}
      >
        {addTile}
        {loading ? (
          <PhotoSkeleton label={title} />
        ) : loadFailed ? (
          loadError
        ) : (
          <Text style={[typography.styles.bodySM, { color: theme.text.secondary, flex: 1 }]}>{t('tripPhotos.emptyHint')}</Text>
        )}
      </View>
    );

  const failedLine = uploads.failedCount > 0;
  const loadErrorUnder = loadFailed && items.length > 0;
  const offlineHint = offline && !readOnly;
  const hasLines = uploads.progress !== null || failedLine || loadErrorUnder || pickFailed || offlineHint;

  return (
    <View testID="photo-strip">
      {row}
      {hasLines && (
        <View style={{ paddingHorizontal: sidePadding, paddingTop: spacing[2], gap: spacing[2] }}>
          {uploads.progress && <StatusLine live>{t('tripPhotos.sending', uploads.progress)}</StatusLine>}
          {failedLine && (
            <View style={{ alignItems: 'flex-start', gap: spacing[1] }}>
              <StatusLine tone="error" live>
                {t('tripPhotos.failed', { count: uploads.failedCount })}
              </StatusLine>
              <TextButton variant="ghost" label={t('tripPhotos.retry')} onPress={uploads.retryFailed} disabled={offline} />
            </View>
          )}
          {loadErrorUnder && loadError}
          {pickFailed && (
            <StatusLine tone="error" live>
              {t('tripPhotos.pickError')}
            </StatusLine>
          )}
          {offlineHint && <StatusLine>{t('tripPhotos.offlineHint')}</StatusLine>}
        </View>
      )}
    </View>
  );
}

type StatusLineProps = { tone?: 'neutral' | 'error'; live?: boolean; children: string };

// A line of status text under the strip (Body SM, wraps). An error also carries an icon, never colour alone (§15).
function StatusLine({ tone = 'neutral', live = false, children }: StatusLineProps) {
  const theme = useTheme();
  const error = tone === 'error';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[1] }}>
      {error && (
        <CircleAlert
          testID="photo-strip-error-icon"
          aria-hidden
          size={tokens.iconography.size.xs}
          strokeWidth={tokens.iconography.strokeWidth}
          color={theme.semantic.error.foreground}
        />
      )}
      <Text
        accessibilityLiveRegion={live ? 'polite' : undefined}
        style={[tokens.typography.styles.bodySM, { color: error ? theme.semantic.error.foreground : theme.text.secondary, flexShrink: 1 }]}
      >
        {children}
      </Text>
    </View>
  );
}
