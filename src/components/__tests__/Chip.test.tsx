import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Chip } from '@/components/Chip';
import { lightTheme } from '@/theme/legacy/theme';

describe('Chip', () => {
  it('is a checkbox that toggles', async () => {
    const onToggle = jest.fn();
    await render(<Chip label="Plaże" selected={false} onToggle={onToggle} />);
    const chip = screen.getByRole('checkbox', { name: 'Plaże' });
    expect(chip).not.toBeChecked();
    await fireEvent.press(chip);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('unselected: outlined, at least 32dp, fully rounded (§10.6 exception, D32, theme-split D9)', async () => {
    await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveStyle({
      minHeight: 32,
      borderRadius: lightTheme.radius.full,
      borderWidth: 1,
      borderColor: lightTheme.colors.input.border,
      backgroundColor: lightTheme.colors.surface.default,
    });
    expect(screen.queryByTestId('chip-check', { includeHiddenElements: true })).toBeNull();
  });

  it('selected: filled brand with a check mark, so the state is not shown by colour alone (D32)', async () => {
    await render(<Chip label="Plaże" selected onToggle={() => {}} />);
    const chip = screen.getByRole('checkbox', { name: 'Plaże' });
    expect(chip).toBeChecked();
    expect(chip).toHaveStyle({ backgroundColor: lightTheme.colors.action.primary });
    expect(screen.getByText('Plaże')).toHaveStyle({ color: lightTheme.colors.action.onPrimary });
    // Decorative for screen readers: the checked state is announced instead.
    expect(screen.getByTestId('chip-check', { includeHiddenElements: true })).toBeTruthy();
  });

  it('grows and wraps with large text instead of clipping (§4.4)', async () => {
    await render(<Chip label="Aquaparki i parki rozrywki" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).not.toHaveStyle({ height: 32 });
    expect(screen.getByRole('checkbox')).toHaveStyle({ maxWidth: '100%' });
    expect(screen.getByText('Aquaparki i parki rozrywki')).toHaveStyle({ flexShrink: 1 });
  });

  it('has a 44dp touch target although it is 32dp tall', async () => {
    await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
    const { hitSlop } = screen.getByRole('checkbox').props;
    expect(hitSlop).toEqual({ top: 6, bottom: 6, left: 0, right: 0 });
    expect(32 + hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(lightTheme.size.touchTarget);
  });

  describe('constant width (theme-split D9)', () => {
    const sides = (selected: boolean) => {
      const style = StyleSheet.flatten(screen.getByRole('checkbox').props.style);
      return { left: style.paddingLeft as number, right: style.paddingRight as number, gap: style.gap as number };
    };

    it('reserves the room of the check mark in the padding of an unselected chip, so toggling does not change the width', async () => {
      const { spacing, size } = lightTheme;
      await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
      const unselected = sides(false);
      await screen.rerender(<Chip label="Plaże" selected onToggle={() => {}} />);
      const selected = sides(true);

      expect(selected.left).toBe(spacing[2]);
      expect(selected.right).toBe(spacing[2]);
      expect(unselected.left).toBe(unselected.right);
      // unselected padding = selected padding + (check + gap), content = label only; selected content = check + gap + label
      expect(unselected.left + unselected.right).toBe(selected.left + selected.right + size.iconInline + selected.gap);
      expect(unselected.gap).toBe(selected.gap);
    });

    it('shows the check mark only when selected, left of the label', async () => {
      await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
      expect(screen.queryByTestId('chip-check', { includeHiddenElements: true })).toBeNull();
      await screen.rerender(<Chip label="Plaże" selected onToggle={() => {}} />);
      expect(screen.getByTestId('chip-check', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByRole('checkbox')).toHaveStyle({ borderColor: lightTheme.colors.action.primary });
    });
  });

  it('can be disabled: it does not toggle, is announced as disabled and drawn at the disabled opacity (§10.2)', async () => {
    const onToggle = jest.fn();
    await render(<Chip label="Plaże" selected={false} onToggle={onToggle} disabled />);
    const chip = screen.getByRole('checkbox', { name: 'Plaże' });
    expect(chip).toBeDisabled();
    expect(chip).toHaveStyle({ opacity: lightTheme.opacity.disabled });
    await fireEvent.press(chip);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('is enabled and fully opaque by default', async () => {
    await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeEnabled();
    expect(screen.getByRole('checkbox')).not.toHaveStyle({ opacity: lightTheme.opacity.disabled });
  });
});
