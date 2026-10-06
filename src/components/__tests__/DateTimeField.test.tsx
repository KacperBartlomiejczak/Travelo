import { fireEvent, render, screen } from '@testing-library/react-native';

import { DateTimeField } from '@/components/DateTimeField';
import i18n from '@/i18n';

// The native picker is replaced by a button that "picks" 2 Nov 2026, 10:15 shown in UTC.
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    DateTimePicker: (props: { mode: string; display?: string; timeZoneName?: string; value: Date; onValueChange: (e: object, d: Date) => void }) => (
      <Pressable testID="picker" onPress={() => props.onValueChange({}, new Date(Date.UTC(2026, 10, 2, 10, 15)))}>
        <Text>{`picker ${props.mode} ${props.display ?? ''} ${props.timeZoneName ?? ''} ${props.value.toISOString()}`}</Text>
      </Pressable>
    ),
  };
});

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('DateTimeField (iOS)', () => {
  it('shows a placeholder when empty and the formatted wall clock when set', async () => {
    const { rerender } = await render(<DateTimeField label="Wylot" value="" onChange={() => {}} />);
    expect(screen.getByText('Wybierz datę i godzinę')).toBeTruthy();
    await rerender(<DateTimeField label="Wylot" value="2026-11-02T10:15" onChange={() => {}} />);
    expect(screen.getByText('2 lis 2026, 10:15')).toBeTruthy();
  });

  it('opens a wheel picker under the field, starting from the suggested time', async () => {
    const onChange = jest.fn();
    await render(<DateTimeField label="Wylot" value="" suggested="2026-11-01T12:00" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Wylot' }));
    // Shown in UTC so the wall clock never passes through the device time zone.
    expect(screen.getByText('picker datetime spinner UTC 2026-11-01T12:00:00.000Z')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith('2026-11-01T12:00');
  });

  it('reports the picked wall clock and closes on a second tap', async () => {
    const onChange = jest.fn();
    await render(<DateTimeField label="Wylot" value="2026-11-01T12:00" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Wylot' }));
    await fireEvent.press(screen.getByTestId('picker'));
    expect(onChange).toHaveBeenLastCalledWith('2026-11-02T10:15');
    await fireEvent.press(screen.getByRole('button', { name: 'Wylot' }));
    expect(screen.queryByTestId('picker')).toBeNull();
  });

  it('shows an error', async () => {
    await render(<DateTimeField label="Wylot" value="" error="Wybierz datę i godzinę wylotu" onChange={() => {}} />);
    expect(screen.getByText('Wybierz datę i godzinę wylotu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wylot' }).props.accessibilityHint).toBe('Wybierz datę i godzinę wylotu');
  });
});
