import { Menu } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroIconButton } from '@/components/HeroIconButton';
import { useTheme } from '@/theme/useTheme';

// Opens the side panel from over the hero, pinned under the status bar (trips-drawer P5): on the trip and on its
// loading skeleton alike, so the button does not move when the trip arrives (§10.18). Rendered before the content
// so screen readers reach it first (§15); the layer keeps it drawn above the content that follows.
const ABOVE_CONTENT = 1;

export function HeroMenuButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const side = width < theme.breakpoints.compact ? theme.spacing[4] : theme.spacing[5];
  return (
    <View style={{ position: 'absolute', zIndex: ABOVE_CONTENT, top: insets.top + theme.spacing[2], left: side }}>
      <HeroIconButton icon={Menu} label={t('trips.openList')} onPress={onPress} />
    </View>
  );
}
