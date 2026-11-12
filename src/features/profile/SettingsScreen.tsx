import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight, Crown, FileText, Info, Languages, Palette, Plane, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react-native';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { Snackbar } from '@/components/Snackbar';
import { TextButton } from '@/components/TextButton';
import { DeleteAccountDialog } from '@/features/profile/DeleteAccountDialog';
import { useAccountEmail } from '@/hooks/useAccountEmail';
import { usePreferences } from '@/hooks/usePreferences';
import { useMyProfile } from '@/hooks/useProfile';
import { useSignOut } from '@/hooks/useSignOut';
import { useTripRepository } from '@/providers/AppProviders';
import { useIsOffline } from '@/providers/BudgetSync';
import { useIsPro, useIsProIdentityConfirmed } from '@/providers/Purchases';
import type { ShownProfile } from '@/schemas';
import { tokens } from '@/theme/tokens';
import type { Theme } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';

const { typography, spacing, layout, iconography, components, radii } = tokens;

type RowProps = { icon: LucideIcon; label: string; value?: string; onPress?: () => void; divider?: boolean; disabled?: boolean };

// One row of a settings card (settings-redesign): outline icon, label, optional value; with `onPress` it is a button with a
// decorative arrow circle, without it a plain info row (no arrow). The divider starts at the text.
function SettingsRow({ icon: Icon, label, value, onPress, divider, disabled }: RowProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const body = (pressed: boolean) => (
    <View
      testID="settings-row"
      style={{
        minHeight: components.listRow.minHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingHorizontal: components.listRow.horizontalPadding,
        backgroundColor: pressed ? theme.background.sunken : undefined,
      }}
    >
      <Icon aria-hidden size={iconography.size.sm} strokeWidth={iconography.strokeWidth} color={theme.icon.primary} />
      <Text style={[typography.styles.bodyMD, { color: disabled ? theme.disabled.foreground : theme.text.primary, flex: 1 }]}>{label}</Text>
      {value !== undefined && <Text style={[typography.styles.bodyMD, { color: theme.text.secondary }]}>{value}</Text>}
      {onPress && (
        <View
          aria-hidden
          testID="settings-row-arrow"
          style={{ width: spacing[8], height: spacing[8], borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.sunken }}
        >
          <ArrowRight aria-hidden size={iconography.size.xs} strokeWidth={iconography.strokeWidth} color={theme.icon.primary} />
        </View>
      )}
    </View>
  );
  return (
    <>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={value === undefined ? label : t('settings.rowValue', { label, value })} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}>
          {({ pressed }) => body(pressed)}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${label}, ${value ?? ''}`}>{body(false)}</View>
      )}
      {divider && (
        <View
          style={{
            height: components.card.borderWidth,
            marginLeft: components.listRow.horizontalPadding + iconography.size.sm + spacing[3],
            backgroundColor: theme.border.subtle,
          }}
        />
      )}
    </>
  );
}

// The two gradient colours of the PRO banner (D9: the same tokens as the PRO badge on the profile screen).
function proGradient(theme: Theme) {
  return [theme.brand.primary, theme.accent.sun] as const;
}

function ProBanner({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const gradientId = useId();
  const [from, to] = proGradient(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('settings.pro.title')}. ${t('settings.pro.subtitle')}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: components.input.amountHeight,
        flexDirection: 'row',
        borderRadius: components.card.radius,
        borderWidth: components.card.borderWidth,
        borderColor: theme.border.subtle,
        backgroundColor: theme.surface.primary,
        overflow: 'hidden',
      }}
    >
      <View style={{ flex: 3, justifyContent: 'center', gap: spacing[1], padding: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Crown aria-hidden size={iconography.size.sm} strokeWidth={iconography.strokeWidth} color={theme.icon.primary} />
          <Text style={[typography.styles.labelLG, { color: disabled ? theme.disabled.foreground : theme.text.primary, flexShrink: 1 }]}>{t('settings.pro.title')}</Text>
        </View>
        <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]}>{t('settings.pro.subtitle')}</Text>
      </View>
      <View testID="settings-pro-art" aria-hidden style={{ flex: 2, alignItems: 'center', justifyContent: 'center' }}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset={0} stopColor={from} stopOpacity={0} />
              <Stop offset={0.4} stopColor={from} stopOpacity={1} />
              <Stop offset={1} stopColor={to} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
        <Crown size={spacing[8]} strokeWidth={iconography.strokeWidth} color={theme.brand.onBrand} />
        <Plane size={iconography.size.sm} strokeWidth={iconography.strokeWidth} color={theme.brand.onBrand} style={{ position: 'absolute', right: spacing[3], bottom: spacing[3] }} />
      </View>
    </Pressable>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface.primary,
        borderRadius: components.card.radius,
        borderWidth: components.card.borderWidth,
        borderColor: theme.border.subtle,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function SettingsAvatar({ uri, username }: { uri?: string; username: string }) {
  const theme = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  // Keyed by uri, so a new photo shows the skeleton again without an effect.
  const [loaded, setLoaded] = useState<string | null>(null);
  const size = components.avatar.xl;
  const circle = { width: size, height: size, borderRadius: radii.pill };
  // No url (offline start) or a photo that failed: the initial of the nick on the sunken background (design-context §8.7).
  if (!uri || failed === uri) {
    return (
      <View testID="settings-avatar" aria-hidden>
        <View testID="settings-avatar-initial" style={[circle, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.sunken }]}>
          <Text style={[typography.styles.headingMD, { color: theme.text.primary }]}>{(Array.from(username)[0] ?? '').toUpperCase()}</Text>
        </View>
      </View>
    );
  }
  return (
    <View testID="settings-avatar" aria-hidden>
      <Image testID="settings-avatar-image" source={{ uri }} contentFit="cover" onLoad={() => setLoaded(uri)} onError={() => setFailed(uri)} style={circle} />
      {loaded !== uri && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SkeletonBlock testID="settings-avatar-photo-skeleton" width={size} height={size} radius={radii.pill} />
        </View>
      )}
    </View>
  );
}

// Who is signed in: avatar, nick and e-mail, centred. The e-mail line is absent when it is unknown. A profile that
// could not be read shows nothing (the screen still works).
function IdentityBlock({ loading, profile, email }: { loading: boolean; profile?: ShownProfile; email: string | null }) {
  const theme = useTheme();
  if (loading) {
    return (
      <View style={{ alignItems: 'center', gap: spacing[3] }}>
        <SkeletonBlock testID="settings-avatar-skeleton" width={components.avatar.xl} height={components.avatar.xl} radius={radii.pill} />
        <SkeletonBlock testID="settings-nick-skeleton" width={spacing[16]} height={typography.styles.headingLG.lineHeight} />
      </View>
    );
  }
  if (!profile) return null;
  return (
    <View testID="settings-identity" style={{ alignItems: 'center', gap: spacing[3] }}>
      <SettingsAvatar uri={profile.avatarUrl} username={profile.username} />
      <View style={{ alignItems: 'center', gap: spacing[1], maxWidth: '100%' }}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={[typography.styles.headingLG, { color: theme.text.primary }]}>
          {profile.username}
        </Text>
        {email !== null && (
          <Text testID="settings-email" numberOfLines={1} ellipsizeMode="tail" style={[typography.styles.bodySM, { color: theme.text.secondary }]}>
            {email}
          </Text>
        )}
      </View>
    </View>
  );
}

// Settings (profile-settings D7): one scrolling list (settings-redesign: cards with rows), then, at the bottom where the thumb is,
// "Wyloguj się" (profile-screen A4, D5, D8, D16) and under it "Usuń konto" (profile-settings D2, D6, D7). Sign-out asks first (the
// dialog also warns when budget changes were not sent yet, they are lost on sign-out; a failed check counts as "maybe unsent").
// Offline the button is disabled with the reason next to it. After "Wyloguj" the gate moves to the welcome screen by itself;
// there is no error to show, the phone is signed out even when the request failed (see useSignOut).
export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const offline = useIsOffline();
  const repository = useTripRepository();
  const { signOut, pending } = useSignOut();
  const preferences = usePreferences();
  const [checking, setChecking] = useState(false);
  const [dialog, setDialog] = useState({ visible: false, unsent: false });
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  // The kind stays when the sheet closes, so its content does not change during the slide-out.
  const [sheet, setSheet] = useState({ kind: 'theme' as 'theme' | 'language', open: false });
  // Deleting needs the own nick (to type it) and the server; without a loaded profile there is nothing to confirm against.
  const myProfile = useMyProfile();
  const hasProfile = Boolean(myProfile.data);
  const email = useAccountEmail();
  const isPro = useIsPro();
  const confirmed = useIsProIdentityConfirmed();
  // Ignores taps while a RevenueCat screen is open, so a double tap cannot open two.
  const presenting = useRef(false);

  async function present(open: () => Promise<boolean>, errorKey: string) {
    if (offline || presenting.current) return;
    presenting.current = true;
    let failed = false;
    try {
      failed = await open();
    } catch {
      failed = true;
    }
    presenting.current = false;
    if (failed) setSnackbar(t(errorKey));
  }

  async function ask() {
    if (offline || checking || pending) return;
    setChecking(true);
    let unsent = true;
    try {
      unsent = await repository.hasUnsentChanges();
    } catch {
      // The device store could not be read: there may be unsent changes, so the warning shows.
    }
    setChecking(false);
    setDialog({ visible: true, unsent });
  }

  function confirm() {
    setDialog((current) => ({ ...current, visible: false }));
    void signOut();
  }

  return (
    <View testID="settings-screen" style={{ flex: 1, backgroundColor: theme.background.canvas }}>
      <ScrollView
        testID="settings-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          width: '100%',
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center',
          gap: spacing[6],
          paddingHorizontal: width < layout.compactBreakpoint ? spacing[4] : spacing[5],
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + spacing[4],
        }}
      >
        <IdentityBlock loading={myProfile.isPending && myProfile.fetchStatus !== 'idle'} profile={myProfile.data?.profile} email={email} />
        <View style={{ gap: spacing[4] }}>
          {!isPro && <ProBanner disabled={offline || !confirmed} onPress={() => confirmed && void present(async () => (await RevenueCatUI.presentPaywall()) === PAYWALL_RESULT.ERROR, 'settings.pro.error')} />}
          {!isPro && offline && (
            <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]} accessibilityLiveRegion="polite">
              {t('settings.pro.offline')}
            </Text>
          )}
          <SettingsGroup>
            {isPro && (
              <SettingsRow
                icon={Crown}
                label={t('settings.subscription.title')}
                disabled={offline}
                onPress={() => void present(async () => { await RevenueCatUI.presentCustomerCenter(); return false; }, 'settings.subscription.error')}
                divider
              />
            )}
            <SettingsRow icon={UserRound} label={t('settings.editProfile')} onPress={() => router.push('/edit-profile')} divider />
            <SettingsRow icon={Palette} label={t('settings.theme')} value={t(`settings.${preferences.theme}`)} onPress={() => setSheet({ kind: 'theme', open: true })} divider />
            <SettingsRow
              icon={Languages}
              label={t('settings.language')}
              value={t(`settings.${{ system: 'system', pl: 'polish', en: 'english' }[preferences.language]}`)}
              onPress={() => setSheet({ kind: 'language', open: true })}
            />
          </SettingsGroup>
          {isPro && offline && (
            <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]} accessibilityLiveRegion="polite">
              {t('settings.subscription.offline')}
            </Text>
          )}
          <SettingsGroup>
            <SettingsRow icon={ShieldCheck} label={t('settings.privacyPolicy')} onPress={() => router.push('/legal/privacy')} divider />
            <SettingsRow icon={FileText} label={t('settings.terms')} onPress={() => router.push('/legal/terms')} divider />
            <SettingsRow icon={Info} label={t('settings.version')} value={Constants.expoConfig?.version} />
          </SettingsGroup>
        </View>
        <View testID="settings-bottom" style={{ marginTop: 'auto', gap: spacing[6] }}>
          {offline && <OfflineBanner text={t('settings.offline')} />}
          {offline && (
            <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]} accessibilityLiveRegion="polite">
              {t('settings.signOutOffline')}
            </Text>
          )}
          {offline && (
            <Text style={[typography.styles.bodySM, { color: theme.text.secondary }]} accessibilityLiveRegion="polite">
              {t('settings.deleteAccountOffline')}
            </Text>
          )}
          <TextButton variant="destructive" label={t('settings.signOut')} onPress={() => void ask()} disabled={offline || checking || pending} />
          <TextButton variant="destructive" label={t('settings.deleteAccount')} onPress={() => setDeleting(true)} disabled={offline || !hasProfile} />
        </View>
      </ScrollView>
      <BottomSheet visible={sheet.open} title={t(sheet.kind === 'language' ? 'settings.language' : 'settings.theme')} onClose={() => setSheet((current) => ({ ...current, open: false }))}>
        {sheet.kind === 'language' ? (
          <SegmentedControl
            label={t('settings.language')}
            value={preferences.language}
            onChange={preferences.setLanguage}
            options={[
              { value: 'system', label: t('settings.system') },
              { value: 'pl', label: t('settings.polish') },
              { value: 'en', label: t('settings.english') },
            ]}
          />
        ) : (
          <SegmentedControl
            label={t('settings.theme')}
            value={preferences.theme}
            onChange={preferences.setTheme}
            options={[
              { value: 'system', label: t('settings.system') },
              { value: 'light', label: t('settings.light') },
              { value: 'dark', label: t('settings.dark') },
            ]}
          />
        )}
      </BottomSheet>
      <ConfirmDialog
        visible={dialog.visible}
        destructive
        title={t('settings.confirm.title')}
        message={dialog.unsent ? t('settings.confirm.messageUnsent') : t('settings.confirm.message')}
        confirmLabel={t('settings.confirm.confirm')}
        cancelLabel={t('settings.confirm.cancel')}
        onConfirm={confirm}
        onCancel={() => setDialog((current) => ({ ...current, visible: false }))}
      />
      <DeleteAccountDialog visible={deleting} onClose={() => setDeleting(false)} />
      <Snackbar message={snackbar} onHide={() => setSnackbar(null)} />
    </View>
  );
}
