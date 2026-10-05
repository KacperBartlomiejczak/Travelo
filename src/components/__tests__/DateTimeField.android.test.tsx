import { fireEvent, render, screen } from '@testing-library/react-native';

import { DateTimeField } from '@/components/DateTimeField.android';
import i18n from '@/i18n';

// Dialog picker stand-in, behaving like @expo/ui on Android: the date dialog returns UTC midnight of
// the chosen day (2 Nov 2026), the time dialog a device-local time (10:15).
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    DateTimePicker: (props: {
      mode: string;
      presentation?: string;
      is24Hour?: boolean;
      onValueChange: (e: object, d: Date) => void;
    }) => (
      <Pressable
        testID={`picker-${props.mode}`}
        onPress={() =>
          props.onValueChange({}, props.mode === 'date' ? new Date(Date.UTC(2026, 10, 2)) : new Date(2000, 0, 1, 10, 15))
        }
      >
        <Text>{`picker ${props.mode} ${props.presentation ?? ''}${props.is24Hour === undefined ? '' : ` 24h:${props.is24Hour}`}`}</Text>
      </Pressable>
    ),
  };
});

// D30: the clock format comes from the device, not the app language.
let mockUses24hourClock: boolean | null = false;
jest.mock('expo-localization', () => ({
  ...jest.requireActual('expo-localization'),
  getCalendars: () => [{ uses24hourClock: mockUses24hourClock }],
}));

beforeEach(async () => {
  mockUses24hourClock = false;
  await i18n.changeLanguage('pl');
});

describe('DateTimeField (Android)', () => {
  it('asks for the date, then the time, in dialogs and reports both together', async () => {
    const onChange = jest.fn();
    await render(<DateTimeField label="Wylot" value="" suggested="2026-11-01T12:00" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Wylot' }));
    expect(screen.getByText('picker date dialog')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('picker-date'));
    expect(screen.getByText('picker time dialog 24h:false')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('picker-time'));
    expect(onChange).toHaveBeenCalledWith('2026-11-02T10:15');
    expect(screen.queryByTestId('picker-time')).toBeNull();
  });

  it('uses the 24-hour clock when the device does, even in English', async () => {
    mockUses24hourClock = true;
    await i18n.changeLanguage('en');
    await render(<DateTimeField label="Departure" value="" onChange={() => {}} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Departure' }));
    await fireEvent.press(screen.getByTestId('picker-date'));
    expect(screen.getByText('picker time dialog 24h:true')).toBeTruthy();
  });

  it('shows the formatted value', async () => {
    await render(<DateTimeField label="Wylot" value="2026-11-02T10:15" onChange={() => {}} />);
    expect(screen.getByText('2 lis 2026, 10:15')).toBeTruthy();
  });
});
