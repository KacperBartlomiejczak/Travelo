import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TextField } from '@/components/TextField';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { useMyProfile } from '@/hooks/useProfile';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { visible: boolean; onClose: () => void };

// Account deletion (profile-settings D1, D2, D15-D18, A5, A10): a destructive dialog that says what disappears and enables
// "Usuń konto" only once the own nick is typed. The nick is compared like the server does (trimmed, case-insensitive,
// `delete-account/handler.ts`). While the server works the button is busy and the dialog cannot be closed. A failure keeps
// the dialog and the nick for a retry; a stale nick (changed on another phone, nothing deleted) clears the field and shows the new one.
export function DeleteAccountDialog({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const username = useMyProfile().data?.profile.username;
  const { run, pending, error, reset } = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const matches = username !== undefined && typed.trim().toLowerCase() === username.toLowerCase();

  async function confirm() {
    if (!matches || pending) return;
    if ((await run(typed)) === 'mismatch') setTyped('');
  }

  function cancel() {
    if (pending) return;
    setTyped('');
    reset();
    onClose();
  }

  return (
    <ConfirmDialog
      visible={visible}
      destructive
      title={t('settings.delete.title')}
      message={t('settings.delete.message')}
      confirmLabel={t('settings.delete.confirm')}
      cancelLabel={t('settings.delete.cancel')}
      confirmDisabled={!matches}
      busy={pending}
      onConfirm={() => void confirm()}
      onCancel={cancel}
    >
      <View style={{ gap: tokens.spacing[2] }}>
        <TextField
          label={t('settings.delete.field', { username: username ?? '' })}
          value={typed}
          onChangeText={setTyped}
          editable={!pending}
          autoCapitalize="none"
          autoCorrect={false}
          error={error === 'mismatch' ? t('settings.delete.mismatch') : undefined}
        />
        {error === 'failed' && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[tokens.typography.styles.bodySM, { color: theme.semantic.error.foreground }]}>
            {t('settings.delete.failed')}
          </Text>
        )}
      </View>
    </ConfirmDialog>
  );
}
