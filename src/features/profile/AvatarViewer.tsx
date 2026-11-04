import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { CircleAlert, EllipsisVertical, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroIconButton } from '@/components/HeroIconButton';
import { usePickAvatar } from '@/hooks/usePickAvatar';
import { useChangeAvatar, useMyProfile, useRemoveAvatar } from '@/hooks/useProfile';
import { useIsOffline } from '@/providers/BudgetSync';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AvatarSheet } from './AvatarSheet';

const { spacing, layout, typography, iconography } = tokens;
const gutter = (width: number) => (width < layout.compactBreakpoint ? layout.screenGutterCompact : layout.screenGutter);
// Above the picture, so the buttons stay drawn over it and are reached first by screen readers (as PhotoViewer).
const ABOVE_CONTENT = 1;

type Props = {
  /** The address the profile screen is showing; used while the profile read has none (profile-screen D23). A signed, temporary address: never log it. */
  fallbackUri?: string;
  /** The photo `fallbackUri` belongs to: the address is used only while the profile has that same photo (or is not known yet). */
  fallbackAvatarId?: string;
  onClose: () => void;
};

type Problem = 'gallery' | 'upload' | 'remove';

/**
 * The profile photo full screen on the dark canvas (profile-settings D13; the route forces the dark theme): the whole photo, a close
 * button on the left and a three-dot button on the right that opens "Zmień zdjęcie" / "Usuń zdjęcie". A change keeps the preview open
 * with the new photo; a removal closes it. Both need internet (offline the dots are off and the reason sits at the bottom); a failure
 * is shown at the bottom and announced, and the old photo stays. The address comes from the profile query, so a new photo shows at once.
 */
export function AvatarViewer({ fallbackUri, fallbackAvatarId, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const side = gutter(width);
  const offline = useIsOffline();
  const myProfile = useMyProfile();
  const changeAvatar = useChangeAvatar();
  const removeAvatar = useRemoveAvatar();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [working, setWorking] = useState(false);
  // Only while a photo is being sent or removed, not while the gallery is open.
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  // The address that failed, not a flag: a new photo has a new address and is tried.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Two presses in the same moment must not start two calls: state would not be updated yet.
  const running = useRef(false);
  const picked = useRef<string | null>(null);

  const shownProfile = myProfile.data?.profile;
  // After a change whose new address could not be signed, the address from the route is the old photo: never show it for the new one.
  const sameAsRoute = !shownProfile || (shownProfile.avatarId ?? '') === (fallbackAvatarId ?? '');
  const url = shownProfile?.avatarUrl ?? (sameAsRoute ? fallbackUri : undefined);
  const showError = url ? failedUrl === url : !myProfile.isPending;
  const problemText = problem && t(`avatar.${problem}Error`);

  function fail(kind: Problem) {
    setProblem(kind);
    AccessibilityInfo.announceForAccessibility(t(`avatar.${kind}Error`));
  }

  const pickPhoto = usePickAvatar({ onPick: (uri) => (picked.current = uri), onError: () => fail('gallery') });

  // Runs the sheet's action: the sheet stays up (busy) until it is done, so the gallery never opens over a closing Modal.
  // The action returns true when it closed the screen, so nothing is set afterwards.
  async function run(action: () => Promise<boolean>) {
    if (running.current) return;
    running.current = true;
    setProblem(null);
    setWorking(true);
    const closed = await action();
    running.current = false;
    if (closed) return;
    setWorking(false);
    setSheetOpen(false);
  }

  const change = () =>
    run(async () => {
      picked.current = null;
      await pickPhoto();
      const uri = picked.current;
      if (!uri) return false;
      setSaving(true);
      try {
        await changeAvatar.mutateAsync(uri);
      } catch {
        fail('upload');
      }
      setSaving(false);
      return false;
    });

  const remove = () =>
    run(async () => {
      setSaving(true);
      try {
        await removeAvatar.mutateAsync();
        onClose();
        return true;
      } catch {
        fail('remove');
        setSaving(false);
        return false;
      }
    });

  return (
    <View testID="avatar-viewer" style={{ flex: 1, backgroundColor: theme.background.canvas }}>
      <StatusBar style="light" />
      {showError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[5] }}>
          <CircleAlert aria-hidden size={iconography.size.xl} strokeWidth={iconography.strokeWidth} color={theme.semantic.error.foreground} />
          <Text style={[typography.styles.bodyMD, { color: theme.text.primary, textAlign: 'center' }]}>{t('photoViewer.loadError')}</Text>
        </View>
      ) : (
        <>
          {!loaded && (
            <View testID="avatar-viewer-loading" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <ActivityIndicator color={theme.hero.text} />
            </View>
          )}
          {url && (
            <Image
              testID="avatar-viewer-image"
              accessible={false}
              source={{ uri: url }}
              contentFit="contain"
              onLoad={() => setLoaded(true)}
              onError={() => setFailedUrl(url)}
              style={StyleSheet.absoluteFill}
            />
          )}
        </>
      )}
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
        }}
      >
        <HeroIconButton icon={X} label={t('avatar.close')} onPress={onClose} />
        <HeroIconButton icon={EllipsisVertical} label={t('avatar.options')} onPress={() => setSheetOpen(true)} disabled={offline || working} />
      </View>
      {(problemText || offline) && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', zIndex: ABOVE_CONTENT, left: side, right: side, bottom: insets.bottom + spacing[4], alignItems: 'center', gap: spacing[2] }}
        >
          {problemText && <Hint>{problemText}</Hint>}
          {offline && <Hint>{t('avatar.offlineHint')}</Hint>}
        </View>
      )}
      {sheetOpen && <AvatarSheet busy={working} offline={offline} saving={saving} onChange={change} onRemove={remove} onClose={() => setSheetOpen(false)} />}
    </View>
  );
}

// A line of text over the photo on the round buttons' backing, so it reads over any photo (as the photo viewer's hints).
function Hint({ children }: { children: string }) {
  const { hero } = useTheme();
  return (
    <View style={{ backgroundColor: hero.controlBackground, borderRadius: tokens.radii.pill, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }}>
      <Text style={[typography.styles.bodySM, { color: hero.text, textAlign: 'center' }]}>{children}</Text>
    </View>
  );
}
