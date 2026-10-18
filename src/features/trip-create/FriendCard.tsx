import { useTranslation } from 'react-i18next';
import { Text, type LayoutChangeEvent } from 'react-native';

import { Card } from '@/components/Card';
import { InterestChips } from '@/components/InterestChips';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/theme/useTheme';

import type { FriendDraft } from './draft';

type Props = {
  title: string;
  friend: FriendDraft;
  onChange: (friend: FriendDraft) => void;
  /** Translated name error. */
  nameError?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
};

// One friend: name + interests grouped as in D11 (D32).
export function FriendCard({ title, friend, onChange, nameError, onLayout, testID }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Card testID={testID} onLayout={onLayout}>
      <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary }]}>{title}</Text>
      <TextField
        label={t('newTrip.friends.name')}
        value={friend.displayName}
        error={nameError}
        autoCapitalize="words"
        onChangeText={(displayName) => onChange({ ...friend, displayName })}
      />
      <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary }]}>{t('newTrip.friends.interests')}</Text>
      <InterestChips selected={friend.interests} onChange={(interests) => onChange({ ...friend, interests })} />
    </Card>
  );
}
