import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { TextButton } from '@/components/TextButton';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { busy: boolean; saving: boolean; onChange: () => void; onRemove: () => void; onClose: () => void };

// The options of the profile photo preview (profile-settings D13): "Zmień zdjęcie" and "Usuń zdjęcie", the second one without a
// confirmation (D4). While a change or a removal is on its way (`busy`: the gallery is open or the call is on its way) the sheet stays and cannot be closed or pressed
// twice; the spinner (`saving`) shows only while the photo is being sent. A Modal of the preview screen, so it never opens on top of another Modal. Mounting opens it.
export function AvatarSheet({ busy, saving, onChange, onRemove, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <BottomSheet visible title={t('avatar.sheetTitle')} onClose={onClose} dismissible={!busy}>
      {saving && (
        <View testID="avatar-busy" accessible accessibilityLabel={t('avatar.working')} accessibilityState={{ busy: true }} style={{ alignItems: 'center' }}>
          <ActivityIndicator color={theme.icon.secondary} />
        </View>
      )}
      <View style={{ gap: tokens.spacing[4] }}>
        <TextButton variant="secondary" label={t('avatar.change')} onPress={onChange} disabled={busy} />
        <TextButton variant="destructive" label={t('avatar.remove')} onPress={onRemove} disabled={busy} />
      </View>
    </BottomSheet>
  );
}
