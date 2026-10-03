import { fireEvent, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { Plus } from 'lucide-react-native';

import { PrimaryButton } from '../PrimaryButton';
import { lightTheme } from '@/theme/theme';

const label = 'Utwórz podróż';

describe('PrimaryButton', () => {
  it('renders its label as an accessible button', async () => {
    await render(<PrimaryButton label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeEnabled();
    expect(button).toHaveStyle({
      backgroundColor: lightTheme.colors.action.primary,
      minHeight: lightTheme.size.buttonPrimary,
      borderRadius: lightTheme.radius.md,
      paddingHorizontal: lightTheme.spacing[4],
    });
    expect(screen.getByText(label)).toHaveStyle({
      ...lightTheme.typography.button,
      color: lightTheme.colors.action.onPrimary,
    });
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label={label} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the pressed color while pressed', async () => {
    await render(<PrimaryButton label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    await fireEvent(button, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
    expect(button).toHaveStyle({ backgroundColor: lightTheme.colors.action.primaryPressed });
  });

  it('renders an optional leading icon hidden from screen readers', async () => {
    await render(<PrimaryButton label={label} icon={Plus} onPress={jest.fn()} />);
    const icon = screen.getByTestId('primary-button-icon', { includeHiddenElements: true });
    expect(isHiddenFromAccessibility(icon)).toBe(true);
    expect(icon.props.width).toBe(lightTheme.size.iconStandard);
    expect(icon.props.strokeWidth).toBe(lightTheme.size.iconStroke);
    expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });

  it('does not call onPress and uses disabled colors when disabled', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label={label} onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: label });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(button).toHaveStyle({ backgroundColor: lightTheme.colors.action.disabled });
    expect(screen.getByText(label)).toHaveStyle({ color: lightTheme.colors.action.onDisabled });
  });

  it('shows a spinner, reports busy and ignores presses while loading', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label={label} onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: label });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(button).toHaveStyle({ backgroundColor: lightTheme.colors.action.primary });
    expect(screen.getByTestId('primary-button-spinner')).toBeTruthy();
  });

  it('shows a focus ring while focused', async () => {
    await render(<PrimaryButton label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    expect(button).not.toHaveStyle({ outlineWidth: lightTheme.size.focusRing });
    await fireEvent(button, 'focus');
    expect(button).toHaveStyle({
      outlineWidth: lightTheme.size.focusRing,
      outlineColor: lightTheme.colors.action.primary,
      outlineOffset: lightTheme.spacing[1],
    });
    await fireEvent(button, 'blur');
    expect(button).not.toHaveStyle({ outlineWidth: lightTheme.size.focusRing });
  });
});
