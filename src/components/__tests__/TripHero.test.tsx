import { render, screen } from '@testing-library/react-native';

import { TripHero } from '@/components/TripHero';
import { TripHeroSkeleton } from '@/components/TripHeroSkeleton';
import i18n from '@/i18n';
import type { TripSummary } from '@/schemas';
import { lightTheme } from '@/theme/theme';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
}));

const trip: TripSummary = {
  id: '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01',
  ownerId: 'local-user',
  name: 'Warsaw → Bangkok',
  destination: 'BKK',
  startDate: '2026-11-03',
  endDate: '2026-11-15',
  baseCurrency: 'THB',
  budgetPerPerson: { amountMinor: 3000000, currency: 'THB' },
  createdAt: '2026-10-04T12:00:00.000Z',
  travellerCount: 3,
};

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('TripHero (D4)', () => {
  it('takes half of the screen height on an ink background', async () => {
    await render(<TripHero trip={trip} />);
    expect(screen.getByTestId('trip-hero')).toHaveStyle({ height: 406, backgroundColor: lightTheme.colors.hero.background });
  });

  it('shows the cover photo, hidden from screen readers, fading into ink', async () => {
    await render(<TripHero trip={{ ...trip, coverImageUri: 'file:///cache/cover.jpg' }} />);
    const hidden = { includeHiddenElements: true };
    expect(screen.queryByTestId('trip-hero-photo')).toBeNull(); // not reachable for screen readers
    expect(screen.getByTestId('trip-hero-photo', hidden).props['aria-hidden']).toBe(true);
    expect(screen.getByTestId('trip-hero-image', hidden).props.source).toEqual([{ uri: 'file:///cache/cover.jpg' }]); // expo-image normalises to a list
    expect(screen.getByTestId('trip-hero-gradient', hidden)).toBeTruthy();
  });

  it('is plain ink without a cover photo (D6)', async () => {
    await render(<TripHero trip={trip} />);
    expect(screen.queryByTestId('trip-hero-photo', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('trip-hero')).toHaveStyle({ backgroundColor: lightTheme.colors.hero.background });
  });

  it('names the trip in the display face and light text, with dates and days below', async () => {
    await render(<TripHero trip={trip} />);
    const name = screen.getByRole('header', { name: 'Warsaw → Bangkok' });
    expect(name).toHaveStyle({ fontFamily: lightTheme.typography.displayL.fontFamily, color: lightTheme.colors.hero.text });
    expect(screen.getByText('3 lis – 15 lis 2026 · 13 dni')).toHaveStyle({ color: lightTheme.colors.hero.textSecondary });
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await render(<TripHero trip={trip} />);
    expect(screen.getByText('Nov 3 – Nov 15, 2026 · 13 days')).toBeTruthy();
  });
});

describe('TripHeroSkeleton', () => {
  it('is a static block of the hero height, hidden from screen readers', async () => {
    await render(<TripHeroSkeleton />);
    expect(screen.queryByTestId('trip-hero-skeleton')).toBeNull();
    const skeleton = screen.getByTestId('trip-hero-skeleton', { includeHiddenElements: true });
    expect(skeleton.props['aria-hidden']).toBe(true);
    expect(skeleton).toHaveStyle({ height: 406, backgroundColor: lightTheme.colors.surface.secondary });
  });
});
