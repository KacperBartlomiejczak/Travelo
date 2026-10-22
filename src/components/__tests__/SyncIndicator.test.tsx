import { fireEvent, render, screen } from '@testing-library/react-native';

import { SyncIndicator } from '@/components/SyncIndicator';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const hidden = { includeHiddenElements: true };

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('SyncIndicator (D10, design-context §13.9, §2.5)', () => {
  it('shows nothing once the change is synced', async () => {
    await render(<SyncIndicator status="synced" onRetry={jest.fn()} />);
    expect(screen.queryByTestId('sync-indicator')).toBeNull();
  });

  it('pending: a sync.pending clock and "Czeka na wysłanie" in text.secondary (AA contrast), with no action', async () => {
    await render(
      <DarkThemeScope>
        <SyncIndicator status="pending" onRetry={jest.fn()} />
      </DarkThemeScope>,
    );
    const label = screen.getByText('Czeka na wysłanie');
    expect(label).toHaveStyle({ ...tokens.typography.styles.bodySM, color: darkTheme.text.secondary });
    const icon = screen.getByTestId('sync-indicator-icon', hidden);
    expect(icon.props.stroke).toBe(darkTheme.sync.pending);
    expect(icon.props.width).toBe(tokens.iconography.size.xs);
    expect(icon.props.strokeWidth).toBe(tokens.iconography.strokeWidth);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('pending in light mode: icon in the light sync.pending color, text in text.secondary', async () => {
    await render(<SyncIndicator status="pending" onRetry={jest.fn()} />);
    expect(screen.getByText('Czeka na wysłanie')).toHaveStyle({ color: lightTheme.text.secondary });
    expect(screen.getByTestId('sync-indicator-icon', hidden).props.stroke).toBe(lightTheme.sync.pending);
  });

  it('failed: a CircleAlert and "Nie udało się wysłać" in the sync.failed color and a retry button', async () => {
    const onRetry = jest.fn();
    await render(
      <DarkThemeScope>
        <SyncIndicator status="failed" onRetry={onRetry} />
      </DarkThemeScope>,
    );
    expect(screen.getByText('Nie udało się wysłać')).toHaveStyle({ color: darkTheme.sync.failed });
    expect(screen.getByTestId('sync-indicator-icon', hidden).props.stroke).toBe(darkTheme.sync.failed);
    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('speaks in English too', async () => {
    await i18n.changeLanguage('en');
    await render(<SyncIndicator status="pending" onRetry={jest.fn()} />);
    expect(screen.getByText('Waiting to sync')).toBeTruthy();
  });
});
