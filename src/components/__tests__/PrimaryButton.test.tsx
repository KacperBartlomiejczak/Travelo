import { fireEvent, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { Plus } from 'lucide-react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { PrimaryButton } from '../PrimaryButton';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const label = 'Utwórz podróż';
const { button, focusRing } = tokens.components;
const { sm: iconSize } = tokens.iconography.size;

const flat = (element: ReturnType<typeof screen.getByRole>) => StyleSheet.flatten(element.props.style);
const scaleOf = () => {
  const transform = StyleSheet.flatten(screen.getByTestId('primary-button-motion').props.style).transform as
    | { scale: number }[]
    | undefined;
  return transform?.find((entry) => 'scale' in entry)?.scale;
};

afterEach(() => jest.restoreAllMocks());

// Sunline Editorial §8.1 Primary.
describe('PrimaryButton', () => {
  it('renders its label as an accessible button', async () => {
    await render(<PrimaryButton label={label} onPress={jest.fn()} />);
    const primary = screen.getByRole('button', { name: label });
    expect(primary).toBeEnabled();
    expect(primary).toHaveStyle({
      backgroundColor: lightTheme.brand.primary,
      minHeight: button.height,
      borderRadius: button.radius,
      paddingHorizontal: button.horizontalPadding,
    });
    expect(screen.getByText(label)).toHaveStyle({ ...tokens.typography.styles.labelLG, color: lightTheme.brand.onBrand });
  });

  it('uses the dark theme colors in dark mode', async () => {
    await render(<PrimaryButton label={label} onPress={jest.fn()} />, { wrapper: DarkThemeScope });
    expect(screen.getByRole('button', { name: label })).toHaveStyle({ backgroundColor: darkTheme.brand.primary });
    expect(screen.getByText(label)).toHaveStyle({ color: darkTheme.brand.onBrand });
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label={label} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the pressed color while pressed', async () => {
    await render(<PrimaryButton label={label} onPress={jest.fn()} />);
    const primary = screen.getByRole('button', { name: label });
    await fireEvent(primary, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
    expect(primary).toHaveStyle({ backgroundColor: lightTheme.brand.pressed });
  });

  it('renders an optional leading icon, 20dp, hidden from screen readers', async () => {
    await render(<PrimaryButton label={label} icon={Plus} onPress={jest.fn()} />);
    const icon = screen.getByTestId('primary-button-icon', { includeHiddenElements: true });
    expect(isHiddenFromAccessibility(icon)).toBe(true);
    expect(icon.props.width).toBe(iconSize);
    expect(icon.props.strokeWidth).toBe(tokens.iconography.strokeWidth);
    expect(icon.props.stroke).toBe(lightTheme.brand.onBrand);
    expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });

  it('does not call onPress and uses the disabled tokens, not opacity, when disabled', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label={label} onPress={onPress} disabled />);
    const primary = screen.getByRole('button', { name: label });
    await fireEvent.press(primary);
    expect(onPress).not.toHaveBeenCalled();
    expect(primary).toBeDisabled();
    expect(flat(primary).backgroundColor).toBe(lightTheme.disabled.background);
    expect(flat(primary).opacity).toBeUndefined();
    expect(screen.getByText(label)).toHaveStyle({ color: lightTheme.disabled.foreground });
  });

  it('shows a 20dp spinner in the on-brand color, reports busy, keeps its size and ignores presses while loading', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label={label} onPress={onPress} loading />);
    const primary = screen.getByRole('button', { name: label });
    await fireEvent.press(primary);
    expect(onPress).not.toHaveBeenCalled();
    expect(primary).toBeBusy();
    expect(primary).toHaveStyle({ backgroundColor: lightTheme.brand.primary, minHeight: button.height });
    const spinner = screen.getByTestId('primary-button-spinner');
    expect(spinner.props.color).toBe(lightTheme.brand.onBrand);
    expect(StyleSheet.flatten(screen.getByTestId('primary-button-spinner-slot').props.style)).toMatchObject({
      width: iconSize,
      height: iconSize,
    });
  });

  it('shows a focus ring in the brand focus color while focused', async () => {
    await render(<PrimaryButton label={label} onPress={jest.fn()} />);
    const primary = screen.getByRole('button', { name: label });
    expect(primary).not.toHaveStyle({ outlineWidth: focusRing.width });
    await fireEvent(primary, 'focus');
    expect(primary).toHaveStyle({
      outlineWidth: focusRing.width,
      outlineColor: lightTheme.brand.focus,
      outlineOffset: focusRing.offset,
    });
    await fireEvent(primary, 'blur');
    expect(primary).not.toHaveStyle({ outlineWidth: focusRing.width });
  });

  describe('pressed motion', () => {
    it('scales to 0.98 while pressed and back to 1 on release', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      await render(<PrimaryButton label={label} onPress={jest.fn()} />);
      const primary = screen.getByRole('button', { name: label });
      expect(scaleOf()).toBe(1);
      await fireEvent(primary, 'pressIn');
      expect(scaleOf()).toBe(tokens.motion.press.scale);
      await fireEvent(primary, 'pressOut');
      expect(scaleOf()).toBe(1);
    });

    it('does not scale when the system asks to reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await render(<PrimaryButton label={label} onPress={jest.fn()} />);
      await fireEvent(screen.getByRole('button', { name: label }), 'pressIn');
      expect(scaleOf()).toBe(1);
    });
  });
});
