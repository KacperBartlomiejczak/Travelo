import { Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePillClearance } from '@/features/nav/usePillClearance';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { title: string; message: string };

const { layout, spacing, typography } = tokens;

// Placeholder of a main screen that has no content yet (pill-nav-and-dialog D3, A8): a title and one sentence. It has no
// loading, error or offline state because there is nothing to load; those arrive with each screen's feature. The bottom
// padding keeps the text clear of the floating pill.
export function EmptyScreen({ title, message }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const clearance = usePillClearance();
  const { width } = useWindowDimensions();
  return (
    <View
      testID="empty-screen"
      style={{
        flex: 1,
        backgroundColor: theme.background.canvas,
        paddingTop: insets.top + spacing[4],
        paddingBottom: clearance + spacing[4],
        paddingHorizontal: width < layout.compactBreakpoint ? layout.screenGutterCompact : layout.screenGutter,
      }}
    >
      <View testID="empty-screen-content" style={{ flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={[typography.styles.headingLG, { color: theme.text.primary }]}>
          {title}
        </Text>
        <Text style={[typography.styles.bodyMD, { color: theme.text.secondary, marginTop: spacing[2] }]}>{message}</Text>
      </View>
    </View>
  );
}
