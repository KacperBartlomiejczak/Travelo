import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { Card } from '@/components/Card';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { card } = tokens.components;

// Sunline Editorial §8.9 Base Card.
describe('Card', () => {
  it('renders its children', async () => {
    await render(
      <Card testID="card">
        <Text>inside</Text>
      </Card>,
    );
    expect(screen.getByText('inside')).toBeTruthy();
  });

  it('is the primary surface with 20dp corners, 16dp padding and a 1dp subtle border, without a shadow, in light mode', async () => {
    await render(<Card testID="card">{null}</Card>);
    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style).toMatchObject({
      backgroundColor: lightTheme.surface.primary,
      borderRadius: card.radius,
      padding: card.padding,
      borderWidth: card.borderWidth,
      borderColor: lightTheme.border.subtle,
      gap: tokens.spacing[3],
    });
    expect([card.radius, card.padding, card.borderWidth]).toEqual([20, 16, 1]);
    expect(style.shadowOpacity).toBeUndefined();
    expect(style.elevation).toBeUndefined();
  });

  it('is the dark primary surface with the dark level 1 border (hierarchy by border, not shadow) in dark mode', async () => {
    await render(<Card testID="card">{null}</Card>, { wrapper: DarkThemeScope });
    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style).toMatchObject({
      backgroundColor: darkTheme.surface.primary,
      borderWidth: darkTheme.elevation.level1.borderWidth,
      borderColor: darkTheme.elevation.level1.borderColor,
    });
    expect(style.shadowOpacity ?? 0).toBe(0);
    expect(style.elevation ?? 0).toBe(0);
  });

  it('passes onLayout on to the view', async () => {
    const onLayout = jest.fn();
    await render(
      <Card testID="card" onLayout={onLayout}>
        {null}
      </Card>,
    );
    expect(screen.getByTestId('card').props.onLayout).toBe(onLayout);
  });
});
