import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Settings, User } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { AIRPORTS } from '@/data/airports';
import { usePillClearance } from '@/features/nav/usePillClearance';
import { usePickAvatar } from '@/hooks/usePickAvatar';
import { useChangeAvatar, useMyProfile } from '@/hooks/useProfile';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTripList } from '@/hooks/useTrips';
import { travelStats } from '@/lib/travel-stats';
import { deviceToday } from '@/lib/trip-sections';
import { useIsOffline } from '@/providers/BudgetSync';
import { useTheme } from '@/theme/legacy/useTheme';
import { useTheme as useSunlineTheme } from '@/theme/useTheme';

import { TravelStatsCard } from './TravelStatsCard';

// The "Profil" screen (profile-screen D10): the title with the settings gear, the round photo and the nick, and the
// stats card with the numbers of the past trips (D2, D7). The numbers come from the trip list, which the phone keeps a
// copy of, so they show offline too. While the list loads the values are skeletons; when it failed and there is no copy
// they are dashes (A2). The offline banner sits above the pill like on the home screen.
export function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clearance = usePillClearance();
  const { width } = useWindowDimensions();
  const offline = useIsOffline();
  const { spacing, colors, typography } = theme;
  const myProfile = useMyProfile();
  const profile = myProfile.data?.profile;
  const { refetch: refetchProfile } = myProfile;
  const trips = useTripList();
  const openSettings = () => router.push('/settings');

  // Without a photo a tap opens the gallery and uploads the pick; with one it opens the preview (profile-settings D13).
  const changeAvatar = useChangeAvatar();
  const [addError, setAddError] = useState<'galleryError' | 'uploadError' | null>(null);
  const failAdd = (kind: 'galleryError' | 'uploadError') => {
    setAddError(kind);
    AccessibilityInfo.announceForAccessibility(t(`avatar.${kind}`));
  };
  const pickPhoto = usePickAvatar({
    onPick: (uri) => changeAvatar.mutateAsync(uri).catch(() => failAdd('uploadError')),
    onError: () => failAdd('galleryError'),
  });
  const addPhoto = () => {
    setAddError(null);
    return pickPhoto();
  };
  // The address is temporary and signed: it goes to the preview as a param and is never logged.
  const openPhoto = (uri: string) => profile && router.push({ pathname: '/avatar', params: { uri, avatarId: profile.avatarId ?? '' } });

  // After an offline start the profile is the copy on the phone, which has no signed photo url. When the phone comes back
  // online the profile is read again to get one (D18). A failed read keeps the data that is there: the gate looks at the
  // data first, so it never turns into the error screen. TanStack's online manager is not wired to the network state, so
  // `refetchOnReconnect` does not fire here.
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline) void refetchProfile();
    wasOffline.current = offline;
  }, [offline, refetchProfile]);
  const stats = useMemo(() => (trips.data ? travelStats(trips.data, deviceToday(new Date()), AIRPORTS) : undefined), [trips.data]);

  return (
    <View
      testID="profile-screen"
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + spacing[4],
        paddingHorizontal: width < theme.breakpoints.compact ? spacing[4] : spacing[5],
      }}
    >
      <View style={{ flex: 1, width: '100%', maxWidth: theme.size.maxContentWidth, alignSelf: 'center' }}>
        <View testID="profile-header" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] }}>
          <Text accessibilityRole="header" style={[typography.heading1, { color: colors.text.primary, flexShrink: 1 }]}>
            {t('nav.profile')}
          </Text>
          <IconButton icon={Settings} label={t('profile.settings')} onPress={openSettings} />
        </View>

        <ScrollView
          testID="profile-scroll"
          contentContainerStyle={{ gap: spacing[6], paddingTop: spacing[4], paddingBottom: offline ? spacing[6] : clearance + spacing[4] }}
        >
          {profile && (
            <View testID="profile-row" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
              <ProfilePhoto
                uri={profile.avatarUrl}
                avatarId={profile.avatarId}
                offline={offline}
                adding={changeAvatar.isPending}
                onAdd={addPhoto}
                onOpen={openPhoto}
              />
              <Text style={[typography.heading2, { color: colors.text.primary, flexShrink: 1 }]}>{profile.username}</Text>
            </View>
          )}
          {addError && (
            <Text accessibilityRole="alert" style={[typography.bodyS, { color: colors.status.error }]}>
              {t(`avatar.${addError}`)}
            </Text>
          )}
          <TravelStatsCard stats={stats} loading={trips.isPending} />
        </ScrollView>

        {offline && (
          <View style={{ paddingTop: spacing[3], paddingBottom: clearance + spacing[3] }}>
            <OfflineBanner />
          </View>
        )}
      </View>
    </View>
  );
}

// The profile photo (A3, D20, D21, D22): round, 96dp. A user without a photo gets the placeholder circle
// from profile setup, with a person icon, and tapping it opens the gallery (profile-settings D13). A user with a photo
// sees a pulsing skeleton in the same circle whenever the photo is not shown yet: no signed url (an offline start),
// loading until the Image's `load`, or failed. It keeps pulsing until the photo arrives, offline too, and then fades out
// over the photo (D22). A photo that failed is tried again once, when the phone goes from offline to online (D18); one
// that fails again while online stays the skeleton until the next reconnect or a new photo, so there is no retry loop.
// Every profile read signs a new url for the same file, so "has loaded" belongs to the photo (`avatarId`), not to the
// url: a photo that is shown stays shown while the new url loads, when that url fails (D21), and when a later read has no
// url at all (D23): then the last url that loaded is kept as the source.
type PhotoProps = {
  uri: string | undefined;
  avatarId: string | null;
  offline: boolean;
  /** A photo is being uploaded. */
  adding: boolean;
  onAdd: () => void;
  /** Gets the address that is shown. */
  onOpen: (uri: string) => void;
};

function ProfilePhoto({ uri, avatarId, offline, adding, onAdd, onOpen }: PhotoProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors, size, radius } = theme;
  const sunline = useSunlineTheme();
  // What failed (a url), whether this photo has loaded and with which url, and whether its skeleton has faded away. A
  // different photo, or none and then one again, starts over: nothing is shown yet.
  const [failed, setFailed] = useState<string | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [faded, setFaded] = useState(false);
  const [photoId, setPhotoId] = useState(avatarId);
  if (photoId !== avatarId) {
    setPhotoId(avatarId);
    setLoadedUri(null);
    setFaded(false);
  }
  const loaded = loadedUri !== null;
  // The url to show: the newest one, or (D23) the last one that loaded while a read has none.
  const source = uri ?? loadedUri ?? undefined;
  const markFaded = useCallback(() => setFaded(true), []);
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline) setFailed(null);
    wasOffline.current = offline;
  }, [offline]);
  const circle = { width: size.avatarSetup, height: size.avatarSetup, borderRadius: radius.full };
  const skeleton = <SkeletonBlock testID="profile-photo-skeleton" width={size.avatarSetup} height={size.avatarSetup} radius={radius.full} />;

  // D13: without a photo the circle opens the gallery (online only, the reason is in the label); with one it opens the preview,
  // which is on the phone's cache and so also works offline, but not while the skeleton is shown. Pressed shows the sunken
  // background in a ring round the circle (§8.7).
  const adds = avatarId === null;
  const disabled = adds ? offline || adding : !(loaded && source);
  const tap = (child: ReactNode) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(adds ? (offline ? 'avatar.addOffline' : 'avatar.add') : 'avatar.open')}
      accessibilityState={{ disabled, busy: adding }}
      disabled={disabled}
      onPress={() => (adds ? onAdd() : source && onOpen(source))}
      style={({ pressed }) => ({
        minWidth: size.touchTarget,
        minHeight: size.touchTarget,
        padding: theme.spacing[1],
        borderRadius: radius.full,
        backgroundColor: pressed ? sunline.background.sunken : undefined,
      })}
    >
      {child}
    </Pressable>
  );

  if (avatarId === null) {
    return tap(
      <View
        testID="profile-photo-placeholder"
        aria-hidden
        style={[
          circle,
          { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.input.border, backgroundColor: colors.surface.default },
        ]}
      >
        <User size={size.iconFeature} strokeWidth={size.iconStroke} color={colors.text.secondary} aria-hidden />
      </View>,
    );
  }
  if (!source || failed === source) return tap(skeleton);
  // The Image loads under the skeleton in the same box, so the circle does not change size when the photo arrives. It has
  // no `recyclingKey`, so when the url changes expo-image keeps showing the image it has until the new one has loaded
  // (`recyclingKey` is what would blank it: "Changing this prop resets the image view content to blank or a placeholder"),
  // and when the new one fails it keeps it still: on Android Glide's `onLoadFailed` does nothing to the view, on iOS the
  // failure only fires `onError`. So an error after the photo has loaded is ignored (D21).
  return tap(
    <View style={{ width: size.avatarSetup, height: size.avatarSetup }}>
      <Image
        testID="profile-photo"
        source={{ uri: source }}
        contentFit="cover"
        aria-hidden
        onLoad={() => {
          setLoadedUri(source);
          setFailed(null);
        }}
        onError={() => {
          if (!loaded) setFailed(source);
        }}
        style={circle}
      />
      {!(loaded && faded) && (
        <SkeletonCover photoLoaded={loaded} onFaded={markFaded}>
          {skeleton}
        </SkeletonCover>
      )}
    </View>,
  );
}

// The skeleton over the photo (D22). Once the photo has loaded it fades out over `duration.small` (§9.1), opacity only
// (§9.4), then asks to be removed. With reduced motion on, or not known yet, it is removed at once. The removal is a timer
// of the same length rather than the animation's own finish callback, which runs on the UI thread and which the Reanimated
// test mock does not call; the fade itself is on the UI thread, so it does not wait for the JS thread.
function SkeletonCover({ photoLoaded, onFaded, children }: { photoLoaded: boolean; onFaded: () => void; children: ReactNode }) {
  const { duration } = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!photoLoaded) {
      opacity.value = 1;
      return;
    }
    if (reduceMotion !== false) {
      onFaded();
      return;
    }
    opacity.value = withTiming(0, { duration: duration.small });
    const timer = setTimeout(onFaded, duration.small);
    return () => clearTimeout(timer);
  }, [photoLoaded, reduceMotion, opacity, duration.small, onFaded]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View testID="profile-photo-fade" style={[{ position: 'absolute', top: 0, left: 0 }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
