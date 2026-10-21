import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OfflineBanner } from '@/components/OfflineBanner';
import { TextButton } from '@/components/TextButton';
import { useSignOut } from '@/hooks/useSignOut';
import { useTripRepository } from '@/providers/AppProviders';
import { useIsOffline } from '@/providers/BudgetSync';
import { useTheme } from '@/theme/useTheme';

// Settings (profile-screen A4, D5, D8, D16): one button, "Wyloguj się", at the bottom where the thumb is. It asks first (the
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
  const [checking, setChecking] = useState(false);
  const [dialog, setDialog] = useState({ visible: false, unsent: false });
  const { spacing, colors, typography } = theme;

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
    <View testID="settings-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        testID="settings-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'flex-end',
          width: '100%',
          maxWidth: theme.size.maxContentWidth,
          alignSelf: 'center',
          gap: spacing[3],
          paddingHorizontal: width < theme.breakpoints.compact ? spacing[4] : spacing[5],
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + spacing[4],
        }}
      >
        {offline && <OfflineBanner />}
        {offline && (
          <Text style={[typography.bodyS, { color: colors.text.secondary }]} accessibilityLiveRegion="polite">
            {t('settings.signOutOffline')}
          </Text>
        )}
        <TextButton variant="destructive" label={t('settings.signOut')} onPress={() => void ask()} disabled={offline || checking || pending} />
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
    </View>
  );
}
