import { isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';

import { StepIndicator } from '@/components/StepIndicator';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('StepIndicator', () => {
  it('shows "Krok 2 z 4" and exposes the progress to screen readers', async () => {
    await render(<StepIndicator current={2} total={4} />);
    expect(screen.getByText('Krok 2 z 4', { includeHiddenElements: true })).toBeTruthy();
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 1, max: 4, now: 2 });
    expect(bar.props.accessibilityLabel).toBe('Krok 2 z 4');
  });

  it('is read once: the visible text is hidden, the progress bar carries the label', async () => {
    await render(<StepIndicator current={2} total={4} />);
    expect(isHiddenFromAccessibility(screen.getByText('Krok 2 z 4', { includeHiddenElements: true }))).toBe(true);
  });

  it('fills the bar in proportion to the step: 4dp, pill, brand.primary on a border.subtle track (D13)', async () => {
    await render(<StepIndicator current={1} total={3} />);
    const bar = screen.getByRole('progressbar');
    const fill = screen.getByTestId('step-indicator-fill');
    expect(bar).toHaveStyle({ height: tokens.spacing[1], borderRadius: tokens.radii.pill, backgroundColor: lightTheme.border.subtle });
    expect(fill).toHaveStyle({
      width: '33.33333333333333%',
      height: tokens.spacing[1],
      borderRadius: tokens.radii.pill,
      backgroundColor: lightTheme.brand.primary,
    });
  });

  it('draws the label in bodySM text.secondary', async () => {
    await render(<StepIndicator current={2} total={4} />);
    expect(screen.getByText('Krok 2 z 4', { includeHiddenElements: true })).toHaveStyle({
      ...tokens.typography.styles.bodySM,
      color: lightTheme.text.secondary,
    });
  });

  it('uses the dark colors in dark mode', async () => {
    await render(<StepIndicator current={1} total={3} />, { wrapper: DarkThemeScope });
    expect(screen.getByRole('progressbar')).toHaveStyle({ backgroundColor: darkTheme.border.subtle });
    expect(screen.getByTestId('step-indicator-fill')).toHaveStyle({ backgroundColor: darkTheme.brand.primary });
    expect(screen.getByText('Krok 1 z 3', { includeHiddenElements: true })).toHaveStyle({ color: darkTheme.text.secondary });
  });

  it('translates to English', async () => {
    await i18n.changeLanguage('en');
    await render(<StepIndicator current={3} total={3} />);
    expect(screen.getByText('Step 3 of 3', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Step 3 of 3' })).toBeTruthy();
  });
});
