import { render, screen } from '@testing-library/react-native';

import { OfflineBanner } from '@/components/OfflineBanner';
import i18n from '@/i18n';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('OfflineBanner (D11, design-context §12)', () => {
  it('says the app is offline and that changes will be sent later', async () => {
    await render(<OfflineBanner />);
    const banner = screen.getByTestId('offline-banner');
    expect(screen.getByText('Jesteś offline. Zmiany zapiszą się po połączeniu.')).toBeTruthy();
    // Announced politely when it appears; not a button.
    expect(banner.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uses the English copy from the design context', async () => {
    await i18n.changeLanguage('en');
    await render(<OfflineBanner />);
    expect(screen.getByText("You're offline. Changes will sync when you're connected.")).toBeTruthy();
  });
});
