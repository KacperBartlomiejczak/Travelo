import { EllipsisVertical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroIconButton } from '@/components/HeroIconButton';
import { useTheme } from '@/theme/legacy/useTheme';

// Opens the trip's actions from over the hero, mirroring HeroMenuButton on the right (trip-edit-menu D4). Only on
// the trip view (A1). Rendered right after the side panel button so screen readers reach ☰ then ⋮ before the content (§15).
const ABOVE_CONTENT = 1;

export function TripMenuButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const side = width < theme.breakpoints.compact ? theme.spacing[4] : theme.spacing[5];
  return (
    <View style={{ position: 'absolute', zIndex: ABOVE_CONTENT, top: insets.top + theme.spacing[2], right: side }}>
      <HeroIconButton icon={EllipsisVertical} label={t('tripMenu.open')} onPress={onPress} />
    </View>
  );
}
