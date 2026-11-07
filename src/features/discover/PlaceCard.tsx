import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Linking,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Card } from '@/components/Card';
import { TextButton } from '@/components/TextButton';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { PlacePhoto, PlaceRecommendation } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const { spacing, typography, layout } = tokens;
const { card } = tokens.components;
// Inside the border, the photo's top corners follow the card's rounding.
const PHOTO_RADIUS = card.radius - card.borderWidth;
// Above the photo, so the counter and the credit are drawn over it.
const ABOVE_PHOTO = 1;

/**
 * One recommended place (places-photo-carousel D3, D4): a swipeable 4:3 carousel flush with the top of the card when Google
 * sent photos, then the name, reason and the Maps link. No photos means no photo area.
 */
export function PlaceCard({ place }: { place: PlaceRecommendation }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card testID="place-card">
      {place.photos.length > 0 && <Carousel photos={place.photos} placeName={place.name} />}
      <View style={{ gap: spacing[1] }}>
        <Text style={[typography.styles.labelLG, { color: theme.text.primary }]}>{place.name}</Text>
        {place.typeLabel && <Text style={[typography.styles.caption, { color: theme.text.secondary }]}>{place.typeLabel}</Text>}
        {place.address && <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>{place.address}</Text>}
      </View>
      {place.reason && <Text style={[typography.styles.bodyMD, { color: theme.text.primary }]}>{place.reason}</Text>}
      <TextButton
        variant="secondary"
        label={t('discover.openMaps')}
        accessibilityLabel={`${t('discover.openMaps')}, ${place.name}`}
        onPress={() => void Linking.openURL(place.googleMapsUri).catch(() => {})}
      />
    </Card>
  );
}

type CarouselProps = { photos: PlacePhoto[]; placeName: string };

function Carousel({ photos, placeName }: CarouselProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  // The pages are as wide as the frame, known after layout.
  const [width, setWidth] = useState(0);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.min(Math.max(Math.round(event.nativeEvent.contentOffset.x / width), 0), photos.length - 1));
  // Reserves the 4:3 height at once (the frame is out of the flow): the spacer is as high as the content width needs, and the
  // padding adds the two card paddings the frame is wider by. Negative side margins with a stretch and an aspect ratio
  // overflowed the card's right border on Android, so the frame is placed by insets over the card padding instead.
  return (
    <View testID="place-card-photos" style={{ marginTop: -card.padding, paddingBottom: (2 * card.padding) / card.photoAspectRatio }}>
      <View testID="place-card-photo-spacer" style={{ aspectRatio: card.photoAspectRatio }} />
      <View
        testID="place-card-photo-frame"
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -card.padding,
          right: -card.padding,
          borderTopLeftRadius: PHOTO_RADIUS,
          borderTopRightRadius: PHOTO_RADIUS,
          overflow: 'hidden',
          backgroundColor: theme.skeleton.base,
        }}
      >
        {width > 0 && (
          <FlatList
            testID="place-card-pager"
            horizontal
            pagingEnabled
            data={photos}
            keyExtractor={(photo) => photo.uri}
            renderItem={({ item, index: i }) => (
              <Page photo={item} width={width} label={t('discover.photoLabel', { index: i + 1, count: photos.length, name: placeName })} />
            )}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
          />
        )}
        {photos.length > 1 && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              zIndex: ABOVE_PHOTO,
              top: spacing[2],
              right: spacing[2],
              backgroundColor: theme.hero.controlBackground,
              borderRadius: tokens.radii.pill,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
            }}
          >
            <Text style={[typography.styles.caption, { color: theme.hero.text }]}>
              {t('discover.photoCounter', { index: index + 1, count: photos.length })}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

type PageProps = { photo: PlacePhoto; width: number; label: string };

// One photo, kept in memory only (D5: Google content is not stored on the phone). A photo that fails to load (its short-lived
// address may have expired) leaves the placeholder surface, never a hole.
function Page({ photo, width, label }: PageProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion() === true;
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ width, height: '100%' }}>
      {failed ? (
        <View testID="place-card-placeholder" style={{ flex: 1, backgroundColor: theme.skeleton.base }} />
      ) : (
        <Image
          testID="place-card-image"
          accessible
          accessibilityLabel={label}
          source={{ uri: photo.uri }}
          cachePolicy="memory"
          contentFit="cover"
          transition={reduceMotion ? 0 : tokens.motion.duration.standard}
          onError={() => setFailed(true)}
          style={{ flex: 1, backgroundColor: theme.skeleton.base }}
        />
      )}
      {photo.authors.length > 0 && <Credit authors={photo.authors} />}
    </View>
  );
}

// "Fot. <names>" on the scrim at the bottom of the photo (D6); a link to the first author's page when Google gave one.
function Credit({ authors }: { authors: PlacePhoto['authors'] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const names = authors.map((author) => author.name).join(', ');
  const uri = authors[0].uri;
  const text = (
    <Text style={[typography.styles.caption, { color: theme.hero.text }]} numberOfLines={1}>
      {t('discover.photoCredit', { names })}
    </Text>
  );
  const box = { position: 'absolute', zIndex: ABOVE_PHOTO, left: 0, right: 0, bottom: 0, backgroundColor: theme.hero.scrim } as const;
  return uri ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('discover.photoCreditLabel', { names })}
      onPress={() => void Linking.openURL(uri).catch(() => {})}
      style={[box, { minHeight: layout.touchTarget, justifyContent: 'center', paddingHorizontal: spacing[3] }]}
    >
      {text}
    </Pressable>
  ) : (
    <View style={[box, { paddingHorizontal: spacing[3], paddingVertical: spacing[1] }]}>{text}</View>
  );
}
