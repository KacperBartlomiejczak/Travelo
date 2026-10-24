import { fireEvent, render, screen } from '@testing-library/react-native';

import { Stepper } from '@/components/Stepper';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('Stepper', () => {
  it('shows the value and changes it by one', async () => {
    const onChange = jest.fn();
    await render(<Stepper label="Ile osób leci z Tobą?" value={2} min={0} max={19} onChange={onChange} />);
    expect(screen.getByText('Ile osób leci z Tobą?')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Zwiększ' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await fireEvent.press(screen.getByRole('button', { name: 'Zmniejsz' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('cannot go below min or above max', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<Stepper label="Osoby" value={0} min={0} max={19} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Zmniejsz' })).toBeDisabled();
    await rerender(<Stepper label="Osoby" value={19} min={0} max={19} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Zwiększ' })).toBeDisabled();
  });

  it('is adjustable for screen readers', async () => {
    const onChange = jest.fn();
    await render(<Stepper label="Osoby" value={2} min={0} max={19} onChange={onChange} />);
    const adjustable = screen.getByRole('adjustable', { name: 'Osoby' });
    expect(adjustable.props.accessibilityValue).toEqual({ min: 0, max: 19, now: 2 });
    await fireEvent(adjustable, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(3);
    await fireEvent(adjustable, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('has 44dp buttons (§8.2)', async () => {
    await render(<Stepper label="Osoby" value={2} min={0} max={19} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Zwiększ' })).toHaveStyle({ width: 44, height: 44 });
  });

  // Sunline Editorial: no own section; label like a field label (labelMD), the count as `numeric` (§3.3 rule 4).
  it('draws the label in labelMD and the value in numeric, both text.primary', async () => {
    await render(<Stepper label="Osoby" value={2} min={0} max={19} onChange={() => {}} />);
    expect(screen.getByText('Osoby')).toHaveStyle({ ...tokens.typography.styles.labelMD, color: lightTheme.text.primary });
    expect(screen.getByText('2')).toHaveStyle({ ...tokens.typography.styles.numeric, color: lightTheme.text.primary, textAlign: 'center' });
  });

  it('uses the dark colors in dark mode', async () => {
    await render(<Stepper label="Osoby" value={2} min={0} max={19} onChange={() => {}} />, { wrapper: DarkThemeScope });
    expect(screen.getByText('Osoby')).toHaveStyle({ color: darkTheme.text.primary });
    expect(screen.getByText('2')).toHaveStyle({ color: darkTheme.text.primary });
  });
});
