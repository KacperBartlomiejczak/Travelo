import { render, screen } from '@testing-library/react-native';

import { TripCard } from '@/components/TripCard';
import i18n from '@/i18n';
import type { TripSummary } from '@/schemas';
import { lightTheme } from '@/theme/theme';

const trip: TripSummary = {
  id: '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01',
  ownerId: 'local-user',
  name: 'Bangkok',
  destination: 'BKK',
  startDate: '2026-11-03',
  endDate: '2026-11-15',
  baseCurrency: 'THB',
  budgetPerPerson: { amountMinor: 300000, currency: 'THB' },
  createdAt: '2026-10-04T12:00:00.000Z',
  travellerCount: 3,
};

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('TripCard', () => {
  it('shows destination, dates, travellers and budget (D14, D39)', async () => {
    await render(<TripCard trip={trip} />);
    expect(screen.getByRole('header', { name: 'Bangkok' })).toBeTruthy();
    expect(screen.getByText('3 lis – 15 lis 2026')).toBeTruthy();
    expect(screen.getByText('3 osoby')).toBeTruthy();
    expect(screen.getByText('Budżet: 3000\u00a0THB / os.')).toBeTruthy();
    // Screen readers get the words, not "slash os".
    expect(screen.getByText('Budżet: 3000\u00a0THB / os.').props.accessibilityLabel).toBe('Budżet: 3000\u00a0THB na osobę');
  });

  it.each([
    [1, '1 osoba'],
    [5, '5 osób'],
  ])('uses the right plural for %p travellers', async (travellerCount, text) => {
    await render(<TripCard trip={{ ...trip, travellerCount }} />);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('uses the city as a Heading 3 card title on the wizard card style', async () => {
    await render(<TripCard trip={trip} />);
    expect(screen.getByText('Bangkok')).toHaveStyle({ fontSize: lightTheme.typography.heading3.fontSize });
    expect(screen.getByTestId('trip-card-BKK')).toHaveStyle({
      borderRadius: lightTheme.radius.lg,
      backgroundColor: lightTheme.colors.surface.default,
    });
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await render(<TripCard trip={trip} />);
    expect(screen.getByText('Nov 3 – Nov 15, 2026')).toBeTruthy();
    expect(screen.getByText('3 people')).toBeTruthy();
    expect(screen.getByText('Budget: 3,000 THB per person')).toBeTruthy();
  });
});
