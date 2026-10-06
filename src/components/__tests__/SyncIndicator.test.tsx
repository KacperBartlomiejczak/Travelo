import { fireEvent, render, screen } from '@testing-library/react-native';

import { SyncIndicator } from '@/components/SyncIndicator';
import i18n from '@/i18n';
import { darkTheme } from '@/theme/theme';
import { DarkThemeScope } from '@/theme/useTheme';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('SyncIndicator (D10, design-context §17)', () => {
  it('shows nothing once the change is synced', async () => {
    await render(<SyncIndicator status="synced" onRetry={jest.fn()} />);
    expect(screen.queryByTestId('sync-indicator')).toBeNull();
  });

  it('pending: a clock and "Czeka na wysłanie" in the info colour, with no action', async () => {
    await render(
      <DarkThemeScope>
        <SyncIndicator status="pending" onRetry={jest.fn()} />
      </DarkThemeScope>,
    );
    const label = screen.getByText('Czeka na wysłanie');
    expect(label).toHaveStyle({ color: darkTheme.colors.status.info });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('failed: "Nie udało się wysłać" in the error colour and a retry button', async () => {
    const onRetry = jest.fn();
    await render(
      <DarkThemeScope>
        <SyncIndicator status="failed" onRetry={onRetry} />
      </DarkThemeScope>,
    );
    expect(screen.getByText('Nie udało się wysłać')).toHaveStyle({ color: darkTheme.colors.status.error });
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('speaks in English too', async () => {
    await i18n.changeLanguage('en');
    await render(<SyncIndicator status="pending" onRetry={jest.fn()} />);
    expect(screen.getByText('Waiting to sync')).toBeTruthy();
  });
});
