import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ArrowRight, FileText, Info, Languages, Palette, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
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

const { typography, spacing, layout, iconography, components, radii } = tokens;

type RowProps = { icon: LucideIcon; label: string; value?: string; onPress?: () => void; divider?: boolean; labelWithValue?: boolean };

// One row of a settings card (settings-redesign): outline icon, label, optional value; with `onPress` it is a button with a
// decorative arrow circle, without it a plain info row (no arrow). The divider starts at the text.
function SettingsRow({ icon: Icon, label, value, onPress, divider }: RowProps) {
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
      <Text style={[typography.styles.bodyMD, { color: theme.text.primary, flex: 1 }]}>{label}</Text>
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
        <Pressable accessibilityRole="button" accessibilityLabel={value === undefined ? label : t('settings.rowValue', { label, value })} onPress={onPress}>
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
  // The kind stays when the sheet closes, so its content does not change during the slide-out.
  const [sheet, setSheet] = useState({ kind: 'theme' as 'theme' | 'language', open: false });
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
          width: '100%',
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center',
          gap: spacing[6],
          paddingHorizontal: width < layout.compactBreakpoint ? spacing[4] : spacing[5],
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + spacing[4],
        }}
      >
        <View style={{ gap: spacing[4] }}>
          <SettingsGroup>
            <SettingsRow icon={UserRound} label={t('settings.editProfile')} onPress={() => router.push('/edit-profile')} divider />
            <SettingsRow icon={Palette} label={t('settings.theme')} value={t(`settings.${preferences.theme === 'system' ? 'system' : preferences.theme}`)} onPress={() => setSheet({ kind: 'theme', open: true })} divider />
            <SettingsRow
              icon={Languages}
              label={t('settings.language')}
              value={t(`settings.${{ system: 'system', pl: 'polish', en: 'english' }[preferences.language]}`)}
              onPress={() => setSheet({ kind: 'language', open: true })}
            />
          </SettingsGroup>
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
    </View>
  );
}
