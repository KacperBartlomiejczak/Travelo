import { useTranslation } from 'react-i18next';
import { Keyboard, Text, View } from 'react-native';

import { INTEREST_GROUPS, InterestGroupSchema, type InterestTag } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Chip } from './Chip';

type Props = {
  selected: readonly InterestTag[];
  onChange: (selected: InterestTag[]) => void;
  disabled?: boolean;
};

const { chip } = tokens.components;

// The 17 interests as toggle chips in 6 groups (D11, D32), shared by the friends step and the profile setup.
export function InterestChips({ selected, onChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  function toggle(interest: InterestTag) {
    // theme-split D11: the scroll view lets the first tap through, so the keyboard is closed here, along the way.
    Keyboard.dismiss();
    onChange(selected.includes(interest) ? selected.filter((current) => current !== interest) : [...selected, interest]);
  }

  return (
    <View style={{ gap: tokens.spacing[3] }}>
      {InterestGroupSchema.options.map((group) => (
        <View key={group} style={{ gap: tokens.spacing[2] }}>
          <Text style={[tokens.typography.styles.bodySM, { color: theme.text.secondary }]}>{t(`interestGroups.${group}`)}</Text>
          {/* rowGap = touch target (44) - chip height (36): the 44dp touch areas of two wrapped rows touch, never overlap. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: chip.touchHeight - chip.visualHeight, columnGap: tokens.spacing[2] }}>
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
