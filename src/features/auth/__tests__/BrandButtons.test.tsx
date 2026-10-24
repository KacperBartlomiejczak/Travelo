import { fireEvent, isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, processColor, StyleSheet } from 'react-native';

import { lightTheme } from '@/theme/theme';
import { partnerBrand, tokens } from '@/theme/tokens';

import { DiscordButton } from '../DiscordButton';
import { GoogleButton } from '../GoogleButton';

const { button, focusRing } = tokens.components;

afterEach(() => jest.restoreAllMocks());

// The two sign-in buttons wear their provider's colours (auth-onboarding D10, D13, plan A3) but follow the §8.1 Button geometry.
const press = (node: Parameters<typeof fireEvent>[0]) =>
  fireEvent(node, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });

describe.each([
  ['Google', GoogleButton, 'Kontynuuj z Google', 'google'],
  ['Discord', DiscordButton, 'Kontynuuj z Discordem', 'discord'],
] as const)('%s button', (_name, Button, label, brand) => {
  const colors = partnerBrand[brand];
  const border = brand === 'google' ? partnerBrand.google.border : colors.background;

  it('is a 52dp full-width button with the provider colours, 16dp radius, 20dp padding and labelLG', async () => {
    await render(<Button label={label} onPress={jest.fn()} />);
    const brandButton = screen.getByRole('button', { name: label });
    expect(brandButton).toBeEnabled();
    expect(brandButton).toHaveStyle({
      backgroundColor: colors.background,
      borderColor: border,
      borderWidth: button.borderWidth,
      minHeight: button.height,
      borderRadius: button.radius,
      paddingHorizontal: button.horizontalPadding,
      gap: button.iconGap,
    });
    expect(screen.getByText(label)).toHaveStyle({ ...tokens.typography.styles.labelLG, color: colors.text });
  });

  it('draws the logo 20dp wide on the left of the text, hidden from screen readers', async () => {
    await render(<Button label={label} onPress={jest.fn()} />);
    const logo = screen.getByTestId(`${brand}-logo`, { includeHiddenElements: true });
    expect(isHiddenFromAccessibility(logo)).toBe(true);
    expect(logo.props.width).toBe(tokens.iconography.size.sm);
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
    const brandButton = screen.getByRole('button', { name: label });
    await press(brandButton);
    expect(brandButton).toHaveStyle({ backgroundColor: colors.pressed });
  });

  it('disabled: ignores presses, says so to screen readers and keeps the provider colours, no disabled tokens and no opacity (D11)', async () => {
    const onPress = jest.fn();
    await render(<Button label={label} onPress={onPress} disabled />);
    const brandButton = screen.getByRole('button', { name: label });
    await fireEvent.press(brandButton);
    expect(onPress).not.toHaveBeenCalled();
    expect(brandButton).toBeDisabled();
    expect(brandButton.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(brandButton).toHaveStyle({ backgroundColor: colors.background, borderColor: border });
    expect(StyleSheet.flatten(brandButton.props.style).opacity).toBeUndefined();
    expect(screen.getByText(label)).toHaveStyle({ color: colors.text });
    expect(StyleSheet.flatten(screen.getByTestId(`${brand}-logo`, { includeHiddenElements: true }).props.style)?.opacity).toBeUndefined();
  });

  it('shows a spinner in place of the logo, reports busy, keeps its colours and ignores presses while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label={label} onPress={onPress} loading />);
    const brandButton = screen.getByRole('button', { name: label });
    await fireEvent.press(brandButton);
    expect(onPress).not.toHaveBeenCalled();
    expect(brandButton).toBeBusy();
    expect(brandButton).toHaveStyle({ backgroundColor: colors.background, minHeight: button.height });
    expect(screen.getByTestId(`${brand}-button-spinner`).props.color).toBe(colors.text);
    expect(screen.queryByTestId(`${brand}-logo`, { includeHiddenElements: true })).toBeNull();
  });

  it('shows the focus ring in brand.focus while focused', async () => {
    await render(<Button label={label} onPress={jest.fn()} />);
    const brandButton = screen.getByRole('button', { name: label });
    expect(brandButton).not.toHaveStyle({ outlineWidth: focusRing.width });
    await fireEvent(brandButton, 'focus');
    expect(brandButton).toHaveStyle({
      outlineWidth: focusRing.width,
      outlineColor: lightTheme.brand.focus,
      outlineOffset: focusRing.offset,
    });
    await fireEvent(brandButton, 'blur');
    expect(brandButton).not.toHaveStyle({ outlineWidth: focusRing.width });
  });

  describe('pressed motion', () => {
    const scaleOf = () => {
      const transform = StyleSheet.flatten(screen.getByTestId('brand-button-motion').props.style).transform as
        | { scale: number }[]
        | undefined;
      return transform?.find((entry) => 'scale' in entry)?.scale;
    };

    it('scales to the press scale while pressed and back to 1 on release', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      await render(<Button label={label} onPress={jest.fn()} />);
      const brandButton = screen.getByRole('button', { name: label });
      expect(scaleOf()).toBe(1);
      await fireEvent(brandButton, 'pressIn');
      expect(scaleOf()).toBe(tokens.motion.press.scale);
      await fireEvent(brandButton, 'pressOut');
      expect(scaleOf()).toBe(1);
    });

    it('does not scale when the system asks to reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await render(<Button label={label} onPress={jest.fn()} />);
      await fireEvent(screen.getByRole('button', { name: label }), 'pressIn');
      expect(scaleOf()).toBe(1);
    });
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
    const { red, blue, yellow, green } = partnerBrand.google.logo;
    expect(pathFills(screen.toJSON() as JsonNode)).toEqual([red, blue, yellow, green].map((colour) => processColor(colour)));
  });

  it('Discord: one white shape', async () => {
    await render(<DiscordButton label="Kontynuuj z Discordem" onPress={jest.fn()} />);
    expect(pathFills(screen.toJSON() as JsonNode)).toEqual([processColor(partnerBrand.discord.text)]);
  });

  it('Discord: the shape stays white when the button is disabled (D11)', async () => {
    await render(<DiscordButton label="Kontynuuj z Discordem" onPress={jest.fn()} disabled />);
    expect(pathFills(screen.toJSON() as JsonNode)).toEqual([processColor(partnerBrand.discord.text)]);
  });
});
