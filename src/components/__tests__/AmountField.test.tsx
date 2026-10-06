import { fireEvent, render, screen } from '@testing-library/react-native';

import { AmountField } from '@/components/AmountField';
import '@/i18n';
import { lightTheme } from '@/theme/theme';

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

  it('is 64dp with the Numeric XL amount font (§10.5)', async () => {
    await render(<AmountField label="Kwota" amountText="" currency="EUR" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Kwota')).toHaveStyle({ fontFamily: lightTheme.typography.numericXL.fontFamily, fontSize: 32 });
    expect(screen.getByTestId('amount-field-box')).toHaveStyle({ minHeight: 64 });
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
