import { Image } from 'expo-image';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { ImagePlus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { Field } from './Field';
import { TextButton } from './TextButton';

type Props = { value: string | undefined; onChange: (uri: string | undefined) => void };

// Crop and preview shape of a cover photo (Android crops to it; iOS always crops square).
const ASPECT: [number, number] = [16, 9];

// Optional cover photo from the phone's gallery (trip-flight-tabs-name-cover D1).
export function CoverPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  async function pick() {
    setFailed(false);
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: ASPECT, quality: 0.8 });
      if (!result.canceled) onChange(result.assets[0].uri);
    } catch {
      setFailed(true);
    }
  }

  return (
    <Field label={t('coverPicker.label')} optional error={failed ? t('coverPicker.error') : undefined}>
      {value ? (
        <View style={{ gap: theme.spacing[2] }}>
          <Image
            source={{ uri: value }}
            contentFit="cover"
            accessible
            accessibilityLabel={t('coverPicker.preview')}
            style={{ width: '100%', aspectRatio: ASPECT[0] / ASPECT[1], borderRadius: theme.radius.md }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
            <TextButton variant="ghost" label={t('coverPicker.change')} onPress={pick} />
            <TextButton variant="ghost" label={t('coverPicker.remove')} onPress={() => onChange(undefined)} />
          </View>
        </View>
      ) : (
        <TextButton variant="secondary" icon={ImagePlus} label={t('coverPicker.choose')} onPress={pick} />
      )}
    </Field>
  );
}
