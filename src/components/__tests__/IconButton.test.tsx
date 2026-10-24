import { fireEvent, render, screen } from '@testing-library/react-native';
import { Minus } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const label = 'Zmniejsz';
const { iconButton, focusRing } = tokens.components;

// Sunline Editorial §8.2, surface tone.
describe('IconButton', () => {
  it('is a labelled 44dp round button on surface.primary that calls onPress', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon={Minus} label={label} onPress={onPress} />);
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeEnabled();
    expect(button).toHaveStyle({
      width: iconButton.size,
      height: iconButton.size,
      borderRadius: iconButton.radius,
      backgroundColor: lightTheme.surface.primary,
    });
    expect(StyleSheet.flatten(button.props.style).opacity).toBeUndefined();
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws a 20dp icon in icon.primary', async () => {
    await render(<IconButton icon={Minus} label={label} onPress={jest.fn()} />);
    const icon = screen.getByTestId('icon-button-icon', { includeHiddenElements: true });
    expect(icon.props.width).toBe(tokens.iconography.size.sm);
    expect(icon.props.strokeWidth).toBe(tokens.iconography.strokeWidth);
    expect(icon.props.stroke).toBe(lightTheme.icon.primary);
  });

  it('uses the dark colors in dark mode', async () => {
    await render(<IconButton icon={Minus} label={label} onPress={jest.fn()} />, { wrapper: DarkThemeScope });
    const button = screen.getByRole('button', { name: label });
    expect(button).toHaveStyle({ backgroundColor: darkTheme.surface.primary });
    expect(screen.getByTestId('icon-button-icon', { includeHiddenElements: true }).props.stroke).toBe(darkTheme.icon.primary);
  });

  it('turns background.sunken while pressed', async () => {
    await render(<IconButton icon={Minus} label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    await fireEvent(button, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
    expect(button).toHaveStyle({ backgroundColor: lightTheme.background.sunken });
  });

  it('disabled: disabled tokens instead of opacity, marked disabled for screen readers and not pressable', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon={Minus} label={label} disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(button).toHaveStyle({ backgroundColor: lightTheme.disabled.background });
    expect(StyleSheet.flatten(button.props.style).opacity).toBeUndefined();
    expect(screen.getByTestId('icon-button-icon', { includeHiddenElements: true }).props.stroke).toBe(lightTheme.disabled.foreground);
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a 2dp border.focus ring while focused', async () => {
    await render(<IconButton icon={Minus} label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    expect(button).not.toHaveStyle({ outlineWidth: focusRing.width });
    await fireEvent(button, 'focus');
    expect(button).toHaveStyle({
      outlineWidth: focusRing.width,
      outlineOffset: focusRing.offset,
      outlineColor: lightTheme.border.focus,
    });
    await fireEvent(button, 'blur');
    expect(button).not.toHaveStyle({ outlineWidth: focusRing.width });
  });
});
