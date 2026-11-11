import { Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Share, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { IconButton } from '@/components/IconButton';
import { useTheme } from '@/theme/legacy/useTheme';

type Props = { code: string };

// The friend code card (profile-upgrade D15): caption, the code and a share button. Sharing uses the system sheet (D3);
// cancelling or a failure is silent (A6).
export function FriendCode({ code }: Props) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();

  const share = () => {
    Share.share({ message: t('profile.shareMessage', { code }) }).catch(() => {});
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View
          accessible
          accessibilityLabel={t('profile.friendCodeSpoken', { code: code.split('').join(' ') })}
          style={{ flexShrink: 1 }}
        >
          <Text style={[typography.bodyS, { color: colors.text.secondary }]}>{t('profile.friendCode')}</Text>
          <Text style={[typography.numericL, { color: colors.text.primary }]}>{code}</Text>
        </View>
        <IconButton icon={Share2} label={t('profile.shareCode')} onPress={share} />
      </View>
    </Card>
  );
}
