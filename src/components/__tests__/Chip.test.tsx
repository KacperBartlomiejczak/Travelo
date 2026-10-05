import { fireEvent, render, screen } from '@testing-library/react-native';

import { Chip } from '@/components/Chip';
import { lightTheme } from '@/theme/theme';

describe('Chip', () => {
  it('is a checkbox that toggles', async () => {
    const onToggle = jest.fn();
    await render(<Chip label="Plaże" selected={false} onToggle={onToggle} />);
    const chip = screen.getByRole('checkbox', { name: 'Plaże' });
    expect(chip).not.toBeChecked();
    await fireEvent.press(chip);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('unselected: outlined, at least 36dp, fully rounded (§10.6, D32)', async () => {
    await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveStyle({
      minHeight: 36,
      paddingHorizontal: 12,
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
    expect(screen.getByRole('checkbox')).not.toHaveStyle({ height: 36 });
    expect(screen.getByRole('checkbox')).toHaveStyle({ maxWidth: '100%' });
    expect(screen.getByText('Aquaparki i parki rozrywki')).toHaveStyle({ flexShrink: 1 });
  });

  it('has a 44dp touch target although it is 36dp tall', async () => {
    await render(<Chip label="Plaże" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox').props.hitSlop).toEqual({ top: 4, bottom: 4, left: 0, right: 0 });
  });
});
