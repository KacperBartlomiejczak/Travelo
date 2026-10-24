import { fireEvent, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { Menu } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { HeroIconButton } from '@/components/HeroIconButton';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const label = 'Otwórz listę podróży';
const { iconButton, focusRing } = tokens.components;
const { borderWidth } = tokens.components.button;
const grant = { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() };

// Sunline Editorial §8.2, hero tone (trips-drawer P5): a dark control with a light hairline over the trip photo.
describe('HeroIconButton', () => {
  it('is a labelled button that calls onPress', async () => {
    const onPress = jest.fn();
    await render(<HeroIconButton icon={Menu} label={label} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a 44dp circle in hero.controlBackground with a 1dp hero.controlBorder', async () => {
    await render(<HeroIconButton icon={Menu} label={label} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: label })).toHaveStyle({
      width: iconButton.size,
      height: iconButton.size,
      borderRadius: iconButton.radius,
      backgroundColor: lightTheme.hero.controlBackground,
      borderWidth,
      borderColor: lightTheme.hero.controlBorder,
    });
  });

  it('wears the same hero colors in dark mode', async () => {
    await render(<HeroIconButton icon={Menu} label={label} onPress={jest.fn()} />, { wrapper: DarkThemeScope });
    expect(screen.getByRole('button', { name: label })).toHaveStyle({
      backgroundColor: darkTheme.hero.controlBackground,
      borderColor: darkTheme.hero.controlBorder,
    });
  });

  it('keeps its background and gains a 1dp hero.text border while pressed', async () => {
    await render(<HeroIconButton icon={Menu} label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    await fireEvent(button, 'responderGrant', grant);
    expect(button).toHaveStyle({
      backgroundColor: lightTheme.hero.controlBackground,
      borderWidth,
      borderColor: lightTheme.hero.text,
    });
  });

  it('draws a 24dp icon in hero.text, hidden from screen readers', async () => {
    await render(<HeroIconButton icon={Menu} label={label} onPress={jest.fn()} />);
    const icon = screen.getByTestId('hero-icon-button-icon', { includeHiddenElements: true });
    expect(isHiddenFromAccessibility(icon)).toBe(true);
    expect(icon.props.width).toBe(tokens.iconography.size.md);
    expect(icon.props.strokeWidth).toBe(tokens.iconography.strokeWidth);
    expect(icon.props.stroke).toBe(lightTheme.hero.text);
  });

  // trip-photos D30: the viewer's "Usuń zdjęcie" is disabled offline.
  it('is enabled without any opacity by default', async () => {
    await render(<HeroIconButton icon={Menu} label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeEnabled();
    expect(StyleSheet.flatten(button.props.style).opacity).toBeUndefined();
  });

  it('disabled: disabled tokens instead of opacity, marked disabled for screen readers and not pressable (D30)', async () => {
    const onPress = jest.fn();
    await render(<HeroIconButton icon={Menu} label={label} disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(button).toHaveStyle({ backgroundColor: lightTheme.disabled.background });
    expect(StyleSheet.flatten(button.props.style).opacity).toBeUndefined();
    expect(screen.getByTestId('hero-icon-button-icon', { includeHiddenElements: true }).props.stroke).toBe(
      lightTheme.disabled.foreground,
    );
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps its size and shape while disabled', async () => {
    await render(<HeroIconButton icon={Menu} label={label} disabled onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: label })).toHaveStyle({
      width: iconButton.size,
      height: iconButton.size,
      borderRadius: iconButton.radius,
    });
  });

  it('shows a 2dp border.focus ring while focused', async () => {
    await render(<HeroIconButton icon={Menu} label={label} onPress={jest.fn()} />);
    const control = screen.getByRole('button', { name: label });
    expect(control).not.toHaveStyle({ outlineWidth: focusRing.width });
    await fireEvent(control, 'focus');
    expect(control).toHaveStyle({
      outlineWidth: focusRing.width,
      outlineOffset: focusRing.offset,
      outlineColor: lightTheme.border.focus,
    });
    await fireEvent(control, 'blur');
    expect(control).not.toHaveStyle({ outlineWidth: focusRing.width });
  });
});
