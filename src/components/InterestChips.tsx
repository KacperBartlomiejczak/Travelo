import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { INTEREST_GROUPS, InterestGroupSchema, type InterestTag } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

import { Chip } from './Chip';

type Props = {
  selected: readonly InterestTag[];
  onChange: (selected: InterestTag[]) => void;
  disabled?: boolean;
};

// The 17 interests as toggle chips in 6 groups (D11, D32), shared by the friends step and the profile setup.
export function InterestChips({ selected, onChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  function toggle(interest: InterestTag) {
    onChange(selected.includes(interest) ? selected.filter((current) => current !== interest) : [...selected, interest]);
  }

  return (
    <View style={{ gap: theme.spacing[3] }}>
      {InterestGroupSchema.options.map((group) => (
        <View key={group} style={{ gap: theme.spacing[2] }}>
          <Text style={[theme.typography.bodyS, { color: theme.colors.text.secondary }]}>{t(`interestGroups.${group}`)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
            {INTEREST_GROUPS[group].map((interest) => (
              <Chip
                key={interest}
                label={t(`interests.${interest}`)}
                selected={selected.includes(interest)}
                disabled={disabled}
                onToggle={() => toggle(interest)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
