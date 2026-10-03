import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/useTheme';

// Empty-state illustration per design-context §8 and D12: a suitcase with a luggage tag.
// Coordinates are drawing data on a 160×160 canvas; colors and stroke come from the theme.
export function TripsEmptyIllustration() {
  const theme = useTheme();
  const outline = theme.colors.text.primary;
  const stroke = { stroke: outline, strokeWidth: theme.size.iconStroke, strokeLinejoin: 'round' as const };

  return (
    // Decorative, so hidden from screen readers. The wrapping View turns aria-hidden into the native
    // props on iOS/Android and into the aria-hidden attribute on web; Svg itself would not.
    <View testID="trips-empty-illustration" aria-hidden>
      <Svg
        testID="trips-empty-illustration-svg"
        width={theme.size.illustration}
        height={theme.size.illustration}
        viewBox="0 0 160 160"
      >
        {/* Handle */}
        <Path d="M64 52 V40 a6 6 0 0 1 6 -6 h20 a6 6 0 0 1 6 6 V52" fill="none" {...stroke} />
        {/* Body */}
        <Rect x={32} y={52} width={96} height={76} rx={12} fill={theme.colors.action.primary} {...stroke} />
        {/* Straps */}
        <Line x1={56} y1={52} x2={56} y2={128} {...stroke} />
        <Line x1={104} y1={52} x2={104} y2={128} {...stroke} />
        {/* Wheels */}
        <Circle cx={48} cy={136} r={6} fill={outline} />
        <Circle cx={112} cy={136} r={6} fill={outline} />
        {/* Luggage tag */}
        <Line x1={104} y1={62} x2={114} y2={76} {...stroke} />
        <Rect x={110} y={76} width={30} height={18} rx={4} fill={theme.colors.category.transport} {...stroke} />
        <Circle cx={117} cy={85} r={2} fill={outline} />
      </Svg>
    </View>
  );
}
