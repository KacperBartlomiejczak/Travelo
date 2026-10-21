import { Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePillClearance } from '@/features/nav/usePillClearance';
import { useTheme } from '@/theme/legacy/useTheme';

type Props = { title: string; message: string };

// Placeholder of a main screen that has no content yet (pill-nav-and-dialog D3, A8): a title and one sentence. It has no
// loading, error or offline state because there is nothing to load; those arrive with each screen's feature. The bottom
// padding keeps the text clear of the floating pill.
export function EmptyScreen({ title, message }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const clearance = usePillClearance();
  const { width } = useWindowDimensions();
  const { spacing, colors, typography, size, breakpoints } = theme;
  return (
    <View
      testID="empty-screen"
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + spacing[4],
        paddingBottom: clearance + spacing[4],
        paddingHorizontal: width < breakpoints.compact ? spacing[4] : spacing[5],
      }}
    >
      <View testID="empty-screen-content" style={{ flex: 1, width: '100%', maxWidth: size.maxContentWidth, alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={[typography.heading1, { color: colors.text.primary }]}>
          {title}
        </Text>
        <Text style={[typography.bodyM, { color: colors.text.secondary, marginTop: spacing[2] }]}>{message}</Text>
      </View>
    </View>
  );
}
