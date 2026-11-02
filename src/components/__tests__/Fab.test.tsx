import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Fab } from '@/components/Fab';
import { lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

const { fab } = tokens.components;

// Design-context §8.3: 56 dp circle, brand.primary, a 24 dp Plus.
describe('Fab', () => {
  it('is a labelled button that presses', async () => {
    const onPress = jest.fn();
    await render(<Fab label="Dodaj wydatek" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj wydatek' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the FAB tokens', async () => {
    await render(<Fab label="Dodaj wydatek" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Dodaj wydatek' });
    expect(button).toHaveStyle({
      width: fab.size,
      height: fab.size,
      borderRadius: tokens.radii.pill,
      backgroundColor: lightTheme.brand.primary,
    });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject(lightTheme.elevation.level3);
    expect(screen.getByTestId('fab-icon', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
