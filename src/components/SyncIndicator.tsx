import { CircleAlert, Clock3 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { SyncStatus } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { TextButton } from './TextButton';

type Props = { status: SyncStatus; onRetry: () => void };

// Whether a change made on the phone has reached the server (design-context §13.9, trips-supabase D10): `sync.pending`
// with Clock3, `sync.failed` with CircleAlert. Icon + words, never colour alone.
export function SyncIndicator({ status, onRetry }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (status === 'synced') return null;

  const failed = status === 'failed';
  const color = failed ? theme.sync.failed : theme.sync.pending;
  // sync.pending is below AA on the light canvas, so its text is text.secondary; the failed color passes (4.7:1) and keeps both.
  const textColor = failed ? theme.sync.failed : theme.text.secondary;
  const Icon = failed ? CircleAlert : Clock3;
  return (
    <View
      testID="sync-indicator"
      style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: tokens.spacing[2] }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[1], flexShrink: 1 }}>
        <Icon
          testID="sync-indicator-icon"
          size={tokens.iconography.size.xs}
          strokeWidth={tokens.iconography.strokeWidth}
          color={color}
          aria-hidden
        />
        <Text style={[tokens.typography.styles.bodySM, { color: textColor, flexShrink: 1 }]}>{t(failed ? 'sync.failed' : 'sync.pending')}</Text>
      </View>
      {failed && <TextButton variant="ghost" label={t('sync.retry')} onPress={onRetry} />}
    </View>
  );
}
