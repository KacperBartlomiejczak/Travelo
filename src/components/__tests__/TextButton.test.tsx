import { fireEvent, render, screen } from '@testing-library/react-native';
import { Plus } from 'lucide-react-native';

import { TextButton } from '@/components/TextButton';
import { darkTheme, lightTheme } from '@/theme/theme';
import { DarkThemeScope } from '@/theme/useTheme';

describe('TextButton', () => {
  it('is a labelled button that calls onPress', async () => {
    const onPress = jest.fn();
    await render(<TextButton variant="ghost" label="Dodaj przesiadkę" icon={Plus} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Dodaj przesiadkę' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('can carry a longer screen-reader label than its visible text', async () => {
    await render(<TextButton variant="ghost" label="Zmień" accessibilityLabel="Zmień: Budżet" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Zmień: Budżet' })).toBeTruthy();
    expect(screen.getByText('Zmień')).toBeTruthy();
  });

  it('secondary: outlined with the input border, primary text (D28)', async () => {
    await render(<TextButton variant="secondary" label="Wyślij bilet" onPress={() => {}} />);
    expect(screen.getByRole('button')).toHaveStyle({ borderWidth: 1, borderColor: lightTheme.colors.input.border, minHeight: 52 });
    expect(screen.getByText('Wyślij bilet')).toHaveStyle({ color: lightTheme.colors.text.primary });
  });

  it('ghost: link-coloured text, no border, 44dp touch target (D28)', async () => {
    await render(<TextButton variant="ghost" label="Usuń" onPress={() => {}} />);
    expect(screen.getByText('Usuń')).toHaveStyle({ color: lightTheme.colors.action.link });
    expect(screen.getByRole('button')).toHaveStyle({ minHeight: 44 });
  });

  it('disabled: not pressable, muted colours (D28)', async () => {
    const onPress = jest.fn();
    await render(<TextButton variant="secondary" label="Wyślij bilet" disabled onPress={onPress} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveStyle({ backgroundColor: lightTheme.colors.surface.secondary });
    expect(screen.getByText('Wyślij bilet')).toHaveStyle({ color: lightTheme.colors.text.tertiary });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  describe('destructive (trip-edit-menu D10)', () => {
    it('looks like secondary, with the error colour on the label', async () => {
      await render(<TextButton variant="destructive" label="Usuń podróż" icon={Plus} onPress={() => {}} />);
      expect(screen.getByRole('button')).toHaveStyle({
        borderWidth: 1,
        borderColor: lightTheme.colors.input.border,
        minHeight: 52,
        paddingHorizontal: 16,
        backgroundColor: 'transparent',
      });
      expect(screen.getByText('Usuń podróż')).toHaveStyle({ color: lightTheme.colors.status.error });
    });

    it('uses the dark error colour in dark mode', async () => {
      await render(<TextButton variant="destructive" label="Usuń podróż" onPress={() => {}} />, { wrapper: DarkThemeScope });
      expect(screen.getByText('Usuń podróż')).toHaveStyle({ color: darkTheme.colors.status.error });
      expect(screen.getByRole('button')).toHaveStyle({ borderColor: darkTheme.colors.input.border });
    });

    it('is pressed on the secondary surface, like secondary', async () => {
      await render(<TextButton variant="destructive" label="Usuń podróż" onPress={() => {}} />);
      await fireEvent(screen.getByRole('button'), 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
      expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: lightTheme.colors.surface.secondary });
    });

    it('disabled: not pressable, secondary surface and tertiary text instead of the error colour', async () => {
      const onPress = jest.fn();
      await render(<TextButton variant="destructive" label="Usuń podróż" disabled onPress={onPress} />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveStyle({ backgroundColor: lightTheme.colors.surface.secondary });
      expect(screen.getByText('Usuń podróż')).toHaveStyle({ color: lightTheme.colors.text.tertiary });
      await fireEvent.press(button);
      expect(onPress).not.toHaveBeenCalled();
    });
  });
});
