import { useTranslation } from 'react-i18next';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { INTEREST_GROUPS, InterestGroupSchema, type InterestTag } from '@/schemas';
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

  function toggle(interest: InterestTag) {
    const interests = friend.interests.includes(interest)
      ? friend.interests.filter((current) => current !== interest)
      : [...friend.interests, interest];
    onChange({ ...friend, interests });
  }

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
      {InterestGroupSchema.options.map((group) => (
        <View key={group} style={{ gap: theme.spacing[2] }}>
          <Text style={[theme.typography.bodyS, { color: theme.colors.text.secondary }]}>{t(`interestGroups.${group}`)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
            {INTEREST_GROUPS[group].map((interest) => (
              <Chip
                key={interest}
                label={t(`interests.${interest}`)}
                selected={friend.interests.includes(interest)}
                onToggle={() => toggle(interest)}
              />
            ))}
          </View>
        </View>
      ))}
    </Card>
  );
}
