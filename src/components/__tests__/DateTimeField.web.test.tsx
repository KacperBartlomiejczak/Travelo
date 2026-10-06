import { fireEvent, render, screen } from '@testing-library/react-native';

import { DateTimeField } from '@/components/DateTimeField.web';
import i18n from '@/i18n';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('DateTimeField (web)', () => {
  it('uses the browser date-time input and reports its value', async () => {
    const onChange = jest.fn();
    await render(<DateTimeField label="Wylot" value="" onChange={onChange} />);
    const input = screen.getByLabelText('Wylot');
    expect(input.props.type).toBe('datetime-local');
    await fireEvent(input, 'change', { target: { value: '2026-11-02T10:15' } });
    expect(onChange).toHaveBeenCalledWith('2026-11-02T10:15');
  });

  it('shows the stored value and an error', async () => {
    await render(<DateTimeField label="Wylot" value="2026-11-02T10:15" error="Wybierz datę" onChange={() => {}} />);
    expect(screen.getByLabelText('Wylot').props.value).toBe('2026-11-02T10:15');
    expect(screen.getByText('Wybierz datę')).toBeTruthy();
  });
});
