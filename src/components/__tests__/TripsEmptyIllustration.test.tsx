import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { TripsEmptyIllustration } from '@/components/TripsEmptyIllustration';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

// react-native-svg turns a color into a paint object.
const paint = (color: string) => ({ payload: processColor(color), type: 0 });
const hidden = { includeHiddenElements: true };
const SIZE = tokens.components.emptyState.illustrationSize; // §8.20: illustration target 96 × 96
const VIEWBOX = 160; // the drawing's own coordinates

// Sunline Editorial §6.2 and §8.20: one brand color, one secondary thematic color, neutrals; 1.75 stroke.
describe('TripsEmptyIllustration', () => {
  it('is decorative: hidden from screen readers', async () => {
    await render(<TripsEmptyIllustration />);
    expect(screen.queryByTestId('trips-empty-illustration')).toBeNull();
    expect(screen.getByTestId('trips-empty-illustration', hidden).props['aria-hidden']).toBe(true);
  });

  it('is drawn at 96 × 96 with the drawing scaled to it', async () => {
    await render(<TripsEmptyIllustration />);
    const svg = screen.getByTestId('trips-empty-illustration-svg', hidden);
    expect(SIZE).toBe(96);
    expect(svg.props.width).toBe(SIZE);
    expect(svg.props.height).toBe(SIZE);
    expect([svg.props.minX, svg.props.minY, svg.props.vbWidth, svg.props.vbHeight]).toEqual([0, 0, VIEWBOX, VIEWBOX]);
  });

  it('uses the brand color for the suitcase, accent.sea for the tag and the icon color for the outline, in light mode', async () => {
    await render(<TripsEmptyIllustration />);
    expect(screen.getByTestId('illustration-body', hidden).props.fill).toEqual(paint(lightTheme.brand.primary));
    expect(screen.getByTestId('illustration-tag', hidden).props.fill).toEqual(paint(lightTheme.accent.sea));
    expect(screen.getByTestId('illustration-body', hidden).props.stroke).toEqual(paint(lightTheme.icon.primary));
    expect(screen.getByTestId('illustration-tag', hidden).props.stroke).toEqual(paint(lightTheme.icon.primary));
  });

  it('uses the dark colors in dark mode', async () => {
    await render(<TripsEmptyIllustration />, { wrapper: DarkThemeScope });
    expect(screen.getByTestId('illustration-body', hidden).props.fill).toEqual(paint(darkTheme.brand.primary));
    expect(screen.getByTestId('illustration-tag', hidden).props.fill).toEqual(paint(darkTheme.accent.sea));
    expect(screen.getByTestId('illustration-body', hidden).props.stroke).toEqual(paint(darkTheme.icon.primary));
  });

  it('keeps a 1.75 stroke on the screen after scaling, and 12 radius on the suitcase block', async () => {
    await render(<TripsEmptyIllustration />);
    const body = screen.getByTestId('illustration-body', hidden);
    expect(Number(body.props.strokeWidth) * (SIZE / VIEWBOX)).toBeCloseTo(tokens.iconography.strokeWidth, 5);
    expect(body.props.rx).toBe(tokens.radii.sm);
  });
});
