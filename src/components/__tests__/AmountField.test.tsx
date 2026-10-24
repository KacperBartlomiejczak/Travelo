import { fireEvent, render, screen } from '@testing-library/react-native';

import { AmountField } from '@/components/AmountField';
import '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { input } = tokens.components;
const { styles } = tokens.typography;

describe('AmountField', () => {
  it('shows the amount with its currency beside it (§10.5)', async () => {
    const onChangeText = jest.fn();
    await render(<AmountField label="Kwota na osobę" amountText="3000" currency="EUR" onChangeText={onChangeText} />);
    const input = screen.getByLabelText('Kwota na osobę');
    expect(input.props.value).toBe('3000');
    expect(input.props.keyboardType).toBe('decimal-pad');
    expect(screen.getByText('EUR')).toBeTruthy();
    await fireEvent.changeText(input, '3500');
    expect(onChangeText).toHaveBeenCalledWith('3500');
  });

  // Sunline Editorial §8.5.
  it('is 72dp with the moneyXL amount font, and the currency code in moneyMD (§8.5)', async () => {
    await render(<AmountField label="Kwota" amountText="" currency="EUR" onChangeText={() => {}} />);
    const amount = screen.getByLabelText('Kwota');
    expect(amount).toHaveStyle({ ...styles.moneyXL, color: lightTheme.text.primary });
    expect(amount.props.placeholderTextColor).toBe(lightTheme.text.tertiary);
    expect(amount.props.cursorColor).toBe(lightTheme.brand.primary);
    expect(screen.getByText('EUR')).toHaveStyle({ ...styles.moneyMD, color: lightTheme.text.secondary });
    expect(screen.getByTestId('amount-field-box')).toHaveStyle({
      minHeight: input.amountHeight,
      borderRadius: input.radius,
      backgroundColor: lightTheme.surface.primary,
      borderWidth: input.borderWidth,
      borderColor: lightTheme.border.default,
      paddingHorizontal: input.horizontalPadding,
    });
  });

  it('follows the text input border rules: 2dp border.focus when focused, 2dp error color on error', async () => {
    const { rerender } = await render(<AmountField label="Kwota" amountText="" currency="EUR" onChangeText={() => {}} />);
    await fireEvent(screen.getByLabelText('Kwota'), 'focus');
    expect(screen.getByTestId('amount-field-box')).toHaveStyle({
      borderWidth: input.focusBorderWidth,
      borderColor: lightTheme.border.focus,
    });
    await rerender(<AmountField label="Kwota" amountText="abc" currency="EUR" error="Wpisz kwotę" onChangeText={() => {}} />);
    expect(screen.getByTestId('amount-field-box')).toHaveStyle({
      borderWidth: input.focusBorderWidth,
      borderColor: lightTheme.semantic.error.foreground,
    });
    expect(screen.getByTestId('field-error-icon', { includeHiddenElements: true })).toBeTruthy();
  });

  it('uses the dark colors in dark mode', async () => {
    await render(<AmountField label="Kwota" amountText="1" currency="EUR" onChangeText={() => {}} />, { wrapper: DarkThemeScope });
    expect(screen.getByTestId('amount-field-box')).toHaveStyle({
      backgroundColor: darkTheme.surface.primary,
      borderColor: darkTheme.border.default,
    });
    expect(screen.getByLabelText('Kwota')).toHaveStyle({ color: darkTheme.text.primary });
  });

  it('lets the amount shrink so the currency code always stays inside the field (web inputs have an intrinsic width)', async () => {
    await render(<AmountField label="Kwota" amountText="3000" currency="THB" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Kwota')).toHaveStyle({ flex: 1, minWidth: 0 });
    expect(screen.getByText('THB')).toHaveStyle({ flexShrink: 0 });
  });

  it('shows an error', async () => {
    await render(<AmountField label="Kwota" amountText="abc" currency="EUR" error="Wpisz kwotę liczbą" onChangeText={() => {}} />);
    expect(screen.getByText('Wpisz kwotę liczbą')).toBeTruthy();
    expect(screen.getByLabelText('Kwota').props.accessibilityHint).toBe('Wpisz kwotę liczbą');
  });
});
