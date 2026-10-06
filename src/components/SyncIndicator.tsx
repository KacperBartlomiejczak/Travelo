import { CircleX, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { SyncStatus } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

import { TextButton } from './TextButton';

type Props = { status: SyncStatus; onRetry: () => void };

// Whether a change made on the phone has reached the server (design-context §17, trips-supabase D10).
// Icon + words, never colour alone (§2.3).
export function SyncIndicator({ status, onRetry }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (status === 'synced') return null;

  const failed = status === 'failed';
  const color = failed ? theme.colors.status.error : theme.colors.status.info;
  const Icon = failed ? CircleX : Clock;
  return (
    <View testID="sync-indicator" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: theme.spacing[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1], flexShrink: 1 }}>
        <Icon size={theme.size.iconInline} strokeWidth={theme.size.iconStroke} color={color} aria-hidden />
        <Text style={[theme.typography.bodyS, { color, flexShrink: 1 }]}>{t(failed ? 'sync.failed' : 'sync.pending')}</Text>
      </View>
      {failed && <TextButton variant="ghost" label={t('sync.retry')} onPress={onRetry} />}
    </View>
  );
}
