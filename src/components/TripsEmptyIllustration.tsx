import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const VIEWBOX = 160; // the drawing's own coordinates
const SIZE = tokens.components.emptyState.illustrationSize; // §8.20: illustration target 96 × 96

// Empty-state illustration per design-context §6.2 and §8.20: a suitcase with a luggage tag, one brand color
// (suitcase), one secondary thematic color (`accent.sea`, tag) and neutrals (outline).
// Coordinates are drawing data on a 160×160 canvas; colors and stroke come from the theme.
export function TripsEmptyIllustration() {
  const theme = useTheme();
  const outline = theme.icon.primary;
  // The stroke is 1.75 dp on the screen, so it is given in drawing units: the canvas is scaled down to SIZE.
  const stroke = {
    stroke: outline,
    strokeWidth: (tokens.iconography.strokeWidth * VIEWBOX) / SIZE,
    strokeLinejoin: 'round' as const,
  };

  return (
    // Decorative, so hidden from screen readers. The wrapping View turns aria-hidden into the native
    // props on iOS/Android and into the aria-hidden attribute on web; Svg itself would not.
    <View testID="trips-empty-illustration" aria-hidden>
      <Svg testID="trips-empty-illustration-svg" width={SIZE} height={SIZE} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        {/* Handle */}
        <Path d="M64 52 V40 a6 6 0 0 1 6 -6 h20 a6 6 0 0 1 6 6 V52" fill="none" {...stroke} />
        {/* Body */}
        <Rect testID="illustration-body" x={32} y={52} width={96} height={76} rx={tokens.radii.sm} fill={theme.brand.primary} {...stroke} />
        {/* Straps */}
        <Line x1={56} y1={52} x2={56} y2={128} {...stroke} />
        <Line x1={104} y1={52} x2={104} y2={128} {...stroke} />
        {/* Wheels */}
        <Circle cx={48} cy={136} r={6} fill={outline} />
        <Circle cx={112} cy={136} r={6} fill={outline} />
        {/* Luggage tag */}
        <Line x1={104} y1={62} x2={114} y2={76} {...stroke} />
        <Rect testID="illustration-tag" x={110} y={76} width={30} height={18} rx={4} fill={theme.accent.sea} {...stroke} />
        <Circle cx={117} cy={85} r={2} fill={outline} />
      </Svg>
    </View>
  );
}
