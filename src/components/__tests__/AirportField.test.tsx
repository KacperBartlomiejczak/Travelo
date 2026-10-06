import { fireEvent, render, screen } from '@testing-library/react-native';

import { AirportField } from '@/components/AirportField';
import i18n from '@/i18n';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('AirportField', () => {
  it('shows the chosen airport as "city · code"', async () => {
    await render(<AirportField label="Skąd" iata="WAW" onSelect={() => {}} />);
    expect(screen.getByLabelText('Skąd').props.value).toBe('Warsaw · WAW');
  });

  it('lists matching airports while typing and selects one', async () => {
    const onSelect = jest.fn();
    await render(<AirportField label="Dokąd" iata="" onSelect={onSelect} />);
    await fireEvent.changeText(screen.getByLabelText('Dokąd'), 'barc');
    await fireEvent.press(screen.getByRole('button', { name: /Barcelona · BCN/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ iata: 'BCN', timezone: 'Europe/Madrid' }));
  });

  it('hides the list after choosing', async () => {
    await render(<AirportField label="Dokąd" iata="" onSelect={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText('Dokąd'), 'barc');
    await fireEvent.press(screen.getByRole('button', { name: /Barcelona · BCN/ }));
    expect(screen.queryByRole('button', { name: /Barcelona · BCN/ })).toBeNull();
  });

  it('clears the choice when the user starts typing again', async () => {
    const onSelect = jest.fn();
    await render(<AirportField label="Skąd" iata="WAW" onSelect={onSelect} />);
    await fireEvent.changeText(screen.getByLabelText('Skąd'), 'kra');
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('says when nothing matches', async () => {
    await render(<AirportField label="Skąd" iata="" onSelect={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText('Skąd'), 'qqqqq');
    expect(screen.getByText('Nie znaleziono lotniska')).toBeTruthy();
  });

  it('shows an error', async () => {
    await render(<AirportField label="Skąd" iata="" error="Wybierz lotnisko" onSelect={() => {}} />);
    expect(screen.getByText('Wybierz lotnisko')).toBeTruthy();
    expect(screen.getByLabelText('Skąd').props.accessibilityHint).toBe('Wybierz lotnisko');
  });
});
