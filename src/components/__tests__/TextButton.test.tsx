import { fireEvent, render, screen } from '@testing-library/react-native';
import { Plus } from 'lucide-react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { TextButton } from '@/components/TextButton';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { button, focusRing } = tokens.components;
const press = (node: Parameters<typeof fireEvent>[0]) =>
  fireEvent(node, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });
const scaleOf = () => {
  const transform = StyleSheet.flatten(screen.getByTestId('text-button-motion').props.style).transform as
    | { scale: number }[]
    | undefined;
  return transform?.find((entry) => 'scale' in entry)?.scale;
};
const flat = (element: ReturnType<typeof screen.getByRole>) => StyleSheet.flatten(element.props.style);

afterEach(() => jest.restoreAllMocks());

// Sunline Editorial §8.1: secondary, ghost and destructive variants.
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

  it('draws its icon 20dp in the label color', async () => {
    await render(<TextButton variant="ghost" label="Dodaj" icon={Plus} onPress={() => {}} />);
    const icon = screen.getByTestId('text-button-icon', { includeHiddenElements: true });
    expect(icon.props.width).toBe(tokens.iconography.size.sm);
    expect(icon.props.strokeWidth).toBe(tokens.iconography.strokeWidth);
    expect(icon.props.stroke).toBe(lightTheme.text.brand);
  });

  describe('secondary', () => {
    it('is surface.primary with a 1dp border.default, 52dp tall, labelLG in text.primary', async () => {
      await render(<TextButton variant="secondary" label="Wyślij bilet" onPress={() => {}} />);
      expect(screen.getByRole('button')).toHaveStyle({
        backgroundColor: lightTheme.surface.primary,
        borderWidth: button.borderWidth,
        borderColor: lightTheme.border.default,
        minHeight: button.height,
        borderRadius: button.radius,
        paddingHorizontal: button.horizontalPadding,
      });
      expect(screen.getByText('Wyślij bilet')).toHaveStyle({ ...tokens.typography.styles.labelLG, color: lightTheme.text.primary });
    });

    it('turns background.sunken while pressed', async () => {
      await render(<TextButton variant="secondary" label="Wyślij bilet" onPress={() => {}} />);
      await press(screen.getByRole('button'));
      expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: lightTheme.background.sunken });
    });

    it('uses the dark colors in dark mode', async () => {
      await render(<TextButton variant="secondary" label="Wyślij bilet" onPress={() => {}} />, { wrapper: DarkThemeScope });
      expect(screen.getByRole('button')).toHaveStyle({
        backgroundColor: darkTheme.surface.primary,
        borderColor: darkTheme.border.default,
      });
      expect(screen.getByText('Wyślij bilet')).toHaveStyle({ color: darkTheme.text.primary });
    });

    it('disabled: not pressable, disabled tokens, no opacity', async () => {
      const onPress = jest.fn();
      await render(<TextButton variant="secondary" label="Wyślij bilet" disabled onPress={onPress} />);
      const secondary = screen.getByRole('button');
      expect(secondary).toBeDisabled();
      expect(flat(secondary).backgroundColor).toBe(lightTheme.disabled.background);
      expect(flat(secondary).opacity).toBeUndefined();
      expect(screen.getByText('Wyślij bilet')).toHaveStyle({ color: lightTheme.disabled.foreground });
      await fireEvent.press(secondary);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('shows a 2dp border.focus ring while focused', async () => {
      await render(<TextButton variant="secondary" label="Wyślij bilet" onPress={() => {}} />);
      const secondary = screen.getByRole('button');
      await fireEvent(secondary, 'focus');
      expect(secondary).toHaveStyle({ outlineWidth: focusRing.width, outlineOffset: focusRing.offset, outlineColor: lightTheme.border.focus });
      await fireEvent(secondary, 'blur');
      expect(secondary).not.toHaveStyle({ outlineWidth: focusRing.width });
    });
  });

  describe('ghost', () => {
    it('is transparent with text.brand in labelMD and a 44dp touch target', async () => {
      await render(<TextButton variant="ghost" label="Usuń" onPress={() => {}} />);
      expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: 'transparent', minHeight: button.compactHeight });
      expect(screen.getByText('Usuń')).toHaveStyle({ ...tokens.typography.styles.labelMD, color: lightTheme.text.brand });
    });

    it('turns brand.tint while pressed', async () => {
      await render(<TextButton variant="ghost" label="Usuń" onPress={() => {}} />);
      await press(screen.getByRole('button'));
      expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: lightTheme.brand.tint });
    });

    it('uses the dark brand text in dark mode', async () => {
      await render(<TextButton variant="ghost" label="Usuń" onPress={() => {}} />, { wrapper: DarkThemeScope });
      expect(screen.getByText('Usuń')).toHaveStyle({ color: darkTheme.text.brand });
    });

    it('disabled: not pressable, disabled tokens, no opacity', async () => {
      const onPress = jest.fn();
      await render(<TextButton variant="ghost" label="Usuń" disabled onPress={onPress} />);
      const ghost = screen.getByRole('button');
      expect(ghost).toBeDisabled();
      expect(flat(ghost).backgroundColor).toBe(lightTheme.disabled.background);
      expect(flat(ghost).opacity).toBeUndefined();
      expect(screen.getByText('Usuń')).toHaveStyle({ color: lightTheme.disabled.foreground });
      await fireEvent.press(ghost);
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('destructive', () => {
    it('is semantic.error.background with semantic.error.foreground text and icon, 52dp tall', async () => {
      await render(<TextButton variant="destructive" label="Usuń podróż" icon={Plus} onPress={() => {}} />);
      expect(screen.getByRole('button')).toHaveStyle({
        backgroundColor: lightTheme.semantic.error.background,
        minHeight: button.height,
        borderRadius: button.radius,
        paddingHorizontal: button.horizontalPadding,
      });
      expect(screen.getByText('Usuń podróż')).toHaveStyle({
        ...tokens.typography.styles.labelLG,
        color: lightTheme.semantic.error.foreground,
      });
      expect(screen.getByTestId('text-button-icon', { includeHiddenElements: true }).props.stroke).toBe(
        lightTheme.semantic.error.foreground,
      );
    });

    it('uses the dark error colors in dark mode', async () => {
      await render(<TextButton variant="destructive" label="Usuń podróż" onPress={() => {}} />, { wrapper: DarkThemeScope });
      expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: darkTheme.semantic.error.background });
      expect(screen.getByText('Usuń podróż')).toHaveStyle({ color: darkTheme.semantic.error.foreground });
    });

    it('keeps its background and gains a 1dp error.foreground border while pressed, without changing size', async () => {
      await render(<TextButton variant="destructive" label="Usuń podróż" onPress={() => {}} />);
      const destructive = screen.getByRole('button');
      expect(flat(destructive).borderWidth).toBe(button.borderWidth);
      expect(flat(destructive).borderColor).not.toBe(lightTheme.semantic.error.foreground);
      await press(destructive);
      expect(destructive).toHaveStyle({
        backgroundColor: lightTheme.semantic.error.background,
        borderWidth: button.borderWidth,
        borderColor: lightTheme.semantic.error.foreground,
      });
    });

    it('disabled: not pressable, disabled tokens instead of the error colors', async () => {
      const onPress = jest.fn();
      await render(<TextButton variant="destructive" label="Usuń podróż" disabled onPress={onPress} />);
      const destructive = screen.getByRole('button');
      expect(destructive).toBeDisabled();
      expect(flat(destructive).backgroundColor).toBe(lightTheme.disabled.background);
      expect(flat(destructive).opacity).toBeUndefined();
      expect(screen.getByText('Usuń podróż')).toHaveStyle({ color: lightTheme.disabled.foreground });
      await fireEvent.press(destructive);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('shows a 2dp error.foreground ring while focused', async () => {
      await render(<TextButton variant="destructive" label="Usuń podróż" onPress={() => {}} />);
      const destructive = screen.getByRole('button');
      await fireEvent(destructive, 'focus');
      expect(destructive).toHaveStyle({
        outlineWidth: focusRing.width,
        outlineOffset: focusRing.offset,
        outlineColor: lightTheme.semantic.error.foreground,
      });
    });
  });

  describe.each(['secondary', 'ghost', 'destructive'] as const)('pressed motion, %s', (variant) => {
    it('scales to the press scale while pressed and back to 1 on release', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      await render(<TextButton variant={variant} label="Akcja" onPress={() => {}} />);
      const target = screen.getByRole('button');
      expect(scaleOf()).toBe(1);
      await fireEvent(target, 'pressIn');
      expect(scaleOf()).toBe(tokens.motion.press.scale);
      await fireEvent(target, 'pressOut');
      expect(scaleOf()).toBe(1);
    });

    it('does not scale when the system asks to reduce motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await render(<TextButton variant={variant} label="Akcja" onPress={() => {}} />);
      await fireEvent(screen.getByRole('button'), 'pressIn');
      expect(scaleOf()).toBe(1);
    });
  });
});
