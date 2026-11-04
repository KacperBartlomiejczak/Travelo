import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextButton } from '@/components/TextButton';
import { DeleteAccountDialog } from '@/features/profile/DeleteAccountDialog';
import { usePreferences } from '@/hooks/usePreferences';
import { useMyProfile } from '@/hooks/useProfile';
import { useSignOut } from '@/hooks/useSignOut';
import { useTripRepository } from '@/providers/AppProviders';
import { useIsOffline } from '@/providers/BudgetSync';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const { typography, spacing, layout, iconography } = tokens;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      <Text accessibilityRole="header" style={[typography.styles.labelMD, { color: theme.text.secondary }]}>
        {title}
      </Text>
      <Card>{children}</Card>
    </View>
  );
}

// Settings (profile-settings D7): one scrolling list (Account, Appearance, About), then, at the bottom where the thumb is,
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
  // Deleting needs the own nick (to type it) and the server; without a loaded profile there is nothing to confirm against.
  const hasProfile = Boolean(useMyProfile().data);

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
          justifyContent: 'flex-end',
          width: '100%',
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center',
          gap: spacing[6],
          paddingHorizontal: width < layout.compactBreakpoint ? spacing[4] : spacing[5],
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + spacing[4],
        }}
      >
        <Section title={t('settings.account')}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.editProfile')}
            onPress={() => router.push('/edit-profile')}
            style={({ pressed }) => ({
              minHeight: layout.touchTarget,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing[2],
              borderRadius: tokens.radii.xs,
              backgroundColor: pressed ? theme.background.sunken : undefined,
            })}
          >
            <Text style={[typography.styles.bodyMD, { color: theme.text.primary, flexShrink: 1 }]}>{t('settings.editProfile')}</Text>
            <ChevronRight aria-hidden size={iconography.size.sm} strokeWidth={iconography.strokeWidth} color={theme.icon.secondary} />
          </Pressable>
        </Section>
        <Section title={t('settings.appearance')}>
          <Text style={[typography.styles.bodyMD, { color: theme.text.primary }]}>{t('settings.theme')}</Text>
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
          <Text style={[typography.styles.bodyMD, { color: theme.text.primary }]}>{t('settings.language')}</Text>
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
        </Section>
        <Section title={t('settings.about')}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] }}>
            <Text style={[typography.styles.bodyMD, { color: theme.text.primary }]}>{t('settings.version')}</Text>
            <Text style={[typography.styles.bodyMD, { color: theme.text.secondary }]}>{Constants.expoConfig?.version}</Text>
          </View>
        </Section>
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
      </ScrollView>
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
    </View>
  );
}
