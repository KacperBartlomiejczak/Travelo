import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Chip } from '@/components/Chip';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { chip, focusRing } = tokens.components;
const { styles } = tokens.typography;
const checkSize = tokens.iconography.size.xs;

const press = (element: ReturnType<typeof screen.getByRole>) =>
  fireEvent(element, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });

describe('Chip', () => {
  it('is a checkbox that toggles', async () => {
    const onToggle = jest.fn();
    await render(<Chip label="Plaże" selected={false} onToggle={onToggle} />);
    const target = screen.getByRole('checkbox', { name: 'Plaże' });
    expect(target).not.toBeChecked();
    await fireEvent.press(target);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // Sunline Editorial §8.6.
  it('unselected: surface.primary, 1dp border.default, text.secondary labelMD, at least 36dp, fully rounded', async () => {
    await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveStyle({
      minHeight: chip.visualHeight,
      borderRadius: chip.radius,
      borderWidth: chip.borderWidth,
      borderColor: lightTheme.border.default,
      backgroundColor: lightTheme.surface.primary,
    });
    expect(screen.getByText('Plaże')).toHaveStyle({ ...styles.labelMD, color: lightTheme.text.secondary });
    expect(screen.queryByTestId('chip-check', { includeHiddenElements: true })).toBeNull();
  });

  it('selected: brand.tint with a 1dp brand.focus border, text.brand and a check mark, so the state is not shown by colour alone', async () => {
    await render(<Chip label="Plaże" selected onToggle={() => {}} />);
    const target = screen.getByRole('checkbox', { name: 'Plaże' });
    expect(target).toBeChecked();
    expect(target).toHaveStyle({
      backgroundColor: lightTheme.brand.tint,
      borderWidth: chip.borderWidth,
      borderColor: lightTheme.brand.focus,
    });
    expect(screen.getByText('Plaże')).toHaveStyle({ color: lightTheme.text.brand });
    // Decorative for screen readers: the checked state is announced instead.
    const check = screen.getByTestId('chip-check', { includeHiddenElements: true });
    expect(check.props.width).toBe(checkSize);
    expect(check.props.strokeWidth).toBe(tokens.iconography.strokeWidth);
    expect(check.props.stroke).toBe(lightTheme.text.brand);
  });

  it('uses the dark colors in dark mode', async () => {
    const { rerender } = await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />, { wrapper: DarkThemeScope });
    expect(screen.getByRole('checkbox')).toHaveStyle({
      backgroundColor: darkTheme.surface.primary,
      borderColor: darkTheme.border.default,
    });
    expect(screen.getByText('Plaże')).toHaveStyle({ color: darkTheme.text.secondary });
    await rerender(<Chip label="Plaże" selected onToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveStyle({ backgroundColor: darkTheme.brand.tint, borderColor: darkTheme.brand.focus });
    expect(screen.getByText('Plaże')).toHaveStyle({ color: darkTheme.text.brand });
  });

  it('is background.sunken while pressed, selected or not', async () => {
    const { rerender } = await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
    await press(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toHaveStyle({ backgroundColor: lightTheme.background.sunken });
    await rerender(<Chip label="Plaże" selected onToggle={() => {}} />);
    await press(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toHaveStyle({ backgroundColor: lightTheme.background.sunken });
  });

  it('shows a 2dp border.focus border while focused, without changing the size', async () => {
    await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
    const target = screen.getByRole('checkbox');
    const before = StyleSheet.flatten(target.props.style);
    await fireEvent(target, 'focus');
    const focused = StyleSheet.flatten(screen.getByRole('checkbox').props.style);
    expect(focused.borderWidth).toBe(focusRing.width);
    expect(focused.borderColor).toBe(lightTheme.border.focus);
    // The thicker border takes its extra width from the padding, so the chip keeps its size.
    expect((focused.paddingLeft as number) + (focused.borderWidth as number)).toBe(
      (before.paddingLeft as number) + (before.borderWidth as number),
    );
    await fireEvent(target, 'blur');
    expect(screen.getByRole('checkbox')).toHaveStyle({ borderColor: lightTheme.border.default });
  });

  it('grows and wraps with large text instead of clipping (§3.4)', async () => {
    await render(<Chip label="Aquaparki i parki rozrywki" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).not.toHaveStyle({ height: chip.visualHeight });
    expect(screen.getByRole('checkbox')).toHaveStyle({ maxWidth: '100%' });
    expect(screen.getByText('Aquaparki i parki rozrywki')).toHaveStyle({ flexShrink: 1 });
  });

  it('has a 44dp touch target although it is 36dp tall', async () => {
    await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
    const { hitSlop } = screen.getByRole('checkbox').props;
    expect(hitSlop).toEqual({ top: 4, bottom: 4, left: 0, right: 0 });
    expect(chip.visualHeight + hitSlop.top + hitSlop.bottom).toBe(chip.touchHeight);
  });

  describe('constant width (theme-split D9)', () => {
    const sides = () => {
      const style = StyleSheet.flatten(screen.getByRole('checkbox').props.style);
      return { left: style.paddingLeft as number, right: style.paddingRight as number, gap: style.gap as number };
    };

    it('reserves the room of the check mark in the padding of an unselected chip, so toggling does not change the width', async () => {
      await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
      const unselected = sides();
      await screen.rerender(<Chip label="Plaże" selected onToggle={() => {}} />);
      const selected = sides();

      expect(selected.left).toBe(chip.horizontalPadding);
      expect(selected.right).toBe(chip.horizontalPadding);
      expect(selected.gap).toBe(chip.iconGap);
      expect(unselected.left).toBe(unselected.right);
      // unselected padding = selected padding + (check + gap), content = label only; selected content = check + gap + label
      expect(unselected.left + unselected.right).toBe(selected.left + selected.right + checkSize + selected.gap);
      expect(unselected.gap).toBe(selected.gap);
    });

    it('shows the check mark only when selected, left of the label', async () => {
      await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
      expect(screen.queryByTestId('chip-check', { includeHiddenElements: true })).toBeNull();
      await screen.rerender(<Chip label="Plaże" selected onToggle={() => {}} />);
      expect(screen.getByTestId('chip-check', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByRole('checkbox')).toHaveStyle({ borderColor: lightTheme.brand.focus });
    });
  });

  it('can be disabled: it does not toggle, is announced as disabled and uses the disabled tokens, not opacity (§8.0)', async () => {
    const onToggle = jest.fn();
    await render(<Chip label="Plaże" selected={false} onToggle={onToggle} disabled />);
    const target = screen.getByRole('checkbox', { name: 'Plaże' });
    expect(target).toBeDisabled();
    expect(target).toHaveStyle({ backgroundColor: lightTheme.disabled.background });
    expect(StyleSheet.flatten(target.props.style).opacity).toBeUndefined();
    expect(screen.getByText('Plaże')).toHaveStyle({ color: lightTheme.disabled.foreground });
    await fireEvent.press(target);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('keeps the check mark of a disabled selected chip, in the disabled foreground', async () => {
    await render(<Chip label="Plaże" selected onToggle={() => {}} disabled />);
    expect(screen.getByRole('checkbox')).toHaveStyle({ backgroundColor: lightTheme.disabled.background });
    expect(screen.getByTestId('chip-check', { includeHiddenElements: true }).props.stroke).toBe(lightTheme.disabled.foreground);
  });

  it('is enabled by default', async () => {
    await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeEnabled();
    expect(StyleSheet.flatten(screen.getByRole('checkbox').props.style).opacity).toBeUndefined();
  });
});
