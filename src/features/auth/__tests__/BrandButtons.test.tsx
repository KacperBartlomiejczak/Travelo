import { fireEvent, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { darkTheme, lightTheme } from '@/theme/theme';

import { DiscordButton } from '../DiscordButton';
import { GoogleButton } from '../GoogleButton';

// The two sign-in buttons wear their provider's colours (auth-onboarding D10, D13) but behave like PrimaryButton (§10.1).
const press = (node: Parameters<typeof fireEvent>[0]) =>
  fireEvent(node, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });

describe.each([
  ['Google', GoogleButton, 'Kontynuuj z Google', 'google'],
  ['Discord', DiscordButton, 'Kontynuuj z Discordem', 'discord'],
] as const)('%s button', (_name, Button, label, brand) => {
  const colors = lightTheme.colors.brand[brand];
  const border = brand === 'google' ? lightTheme.colors.brand.google.border : colors.background;

  it('is a 52dp full-width button with the provider colours, 12dp radius and its text as the label', async () => {
    await render(<Button label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeEnabled();
    expect(button).toHaveStyle({
      backgroundColor: colors.background,
      borderColor: border,
      borderWidth: 1,
      minHeight: lightTheme.size.buttonPrimary,
      borderRadius: lightTheme.radius.md,
      paddingHorizontal: lightTheme.spacing[4],
    });
    expect(screen.getByText(label)).toHaveStyle({ ...lightTheme.typography.button, color: colors.text });
  });

  it('draws the logo 20dp wide on the left of the text, hidden from screen readers', async () => {
    await render(<Button label={label} onPress={jest.fn()} />);
    const logo = screen.getByTestId(`${brand}-logo`, { includeHiddenElements: true });
    expect(isHiddenFromAccessibility(logo)).toBe(true);
    expect(logo.props.width).toBe(lightTheme.size.iconStandard);
    expect(screen.getByRole('button', { name: label }).props.accessibilityLabel).toBe(label);
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<Button label={label} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses the provider's pressed colour while pressed", async () => {
    await render(<Button label={label} onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: label });
    await press(button);
    expect(button).toHaveStyle({ backgroundColor: colors.pressed });
  });

  it('keeps its own colours, is drawn whole at the disabled opacity (logo included) and ignores presses when disabled (D16)', async () => {
    const onPress = jest.fn();
    await render(<Button label={label} onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: label });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(button).toHaveStyle({ backgroundColor: colors.background, borderColor: border, opacity: lightTheme.opacity.disabled });
    expect(screen.getByText(label)).toHaveStyle({ color: colors.text });
    // The opacity is on the button only: dimming the logo as well would dim it twice.
    expect(screen.getByTestId(`${brand}-logo`, { includeHiddenElements: true })).not.toHaveStyle({ opacity: lightTheme.opacity.disabled });
  });

  it('shows a spinner in place of the logo, reports busy, keeps its colours and ignores presses while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label={label} onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: label });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(button).toHaveStyle({ backgroundColor: colors.background });
    expect(screen.getByTestId(`${brand}-button-spinner`)).toBeTruthy();
    expect(screen.queryByTestId(`${brand}-logo`, { includeHiddenElements: true })).toBeNull();
  });

  it('shows the focus ring while focused', async () => {
    await render(<Button label={label} onPress={jest.fn()} />);
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

type JsonNode = { type: string; props: Record<string, unknown>; children: (JsonNode | string)[] | null };

function pathFills(node: JsonNode | string | null): unknown[] {
  if (!node || typeof node === 'string') return [];
  const own = node.type === 'RNSVGPath' ? [(node.props.fill as { payload: number }).payload] : [];
  return [...own, ...(node.children ?? []).flatMap(pathFills)];
}

describe('logos', () => {
  it('Google: the four official shapes, each in its colour from the theme tokens', async () => {
    await render(<GoogleButton label="Kontynuuj z Google" onPress={jest.fn()} />);
    const { red, blue, yellow, green } = darkTheme.colors.brand.google.logo;
    expect(pathFills(screen.toJSON() as JsonNode)).toEqual([red, blue, yellow, green].map((colour) => processColor(colour)));
  });

  it('Discord: one white shape', async () => {
    await render(<DiscordButton label="Kontynuuj z Discordem" onPress={jest.fn()} />);
    expect(pathFills(screen.toJSON() as JsonNode)).toEqual([processColor(darkTheme.colors.brand.discord.text)]);
  });
});
