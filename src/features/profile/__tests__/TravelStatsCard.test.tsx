import { isHiddenFromAccessibility, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import i18n from '@/i18n';
import type { TravelStats } from '@/lib/travel-stats';
import { darkTheme, lightTheme } from '@/theme/theme';

import { TravelStatsCard } from '../TravelStatsCard';

let mockScheme: 'light' | 'dark' = 'light';
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 812, scale: 2, fontScale: mockFontScale }),
}));

const STATS: TravelStats = { trips: 3, countries: 2, days: 10, flights: 5, km: 19500 };
const KEYS = ['trips', 'countries', 'days', 'flights', 'km'] as const;
const style = (element: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(element.props.style);

beforeEach(async () => {
  mockScheme = 'light';
  mockFontScale = 1;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await i18n.changeLanguage('pl');
});

describe('TravelStatsCard — numbers (profile-screen A6)', () => {
  it('has the card title as a header and a value with a label for each of the five stats', async () => {
    await render(<TravelStatsCard stats={STATS} loading={false} />);
    expect(screen.getByRole('header', { name: 'Twoje podróże' })).toBeTruthy();
    const expected = { trips: ['3', 'Podróże'], countries: ['2', 'Kraje'], days: ['10', 'Dni w podróży'], flights: ['5', 'Loty'] };
    for (const key of ['trips', 'countries', 'days', 'flights'] as const) {
      const stat = screen.getByTestId(`stat-${key}`);
      expect(within(stat).getByText(expected[key][0])).toBeTruthy();
      expect(within(stat).getByText(expected[key][1])).toBeTruthy();
    }
    expect(within(screen.getByTestId('stat-km')).getByText('Przelecone km')).toBeTruthy();
  });

  it('formats numbers for the app language: a space for thousands in Polish', async () => {
    await render(<TravelStatsCard stats={STATS} loading={false} />);
    const polish = new Intl.NumberFormat('pl').format(19500);
    expect(polish).toMatch(/^19\s500$/);
    expect(within(screen.getByTestId('stat-km')).getByText(polish)).toBeTruthy();
  });

  it('formats numbers for the app language: a comma for thousands in English', async () => {
    await i18n.changeLanguage('en');
    await render(<TravelStatsCard stats={STATS} loading={false} />);
    expect(within(screen.getByTestId('stat-km')).getByText('19,500')).toBeTruthy();
  });

  it('reads each stat as one element, "<value> <label>"', async () => {
    await render(<TravelStatsCard stats={STATS} loading={false} />);
    const km = new Intl.NumberFormat('pl').format(STATS.km);
    const labels = ['3 Podróże', '2 Kraje', '10 Dni w podróży', '5 Loty', `${km} Przelecone km`];
    KEYS.forEach((key, index) => {
      const stat = screen.getByTestId(`stat-${key}`);
      expect(stat.props.accessible).toBe(true);
      expect(stat.props.accessibilityLabel).toBe(labels[index]);
      expect(screen.getByLabelText(labels[index])).toBe(stat);
    });
  });

  it('reads English labels in English', async () => {
    await i18n.changeLanguage('en');
    await render(<TravelStatsCard stats={STATS} loading={false} />);
    ['3 Trips', '2 Countries', '10 Days travelled', '5 Flights', '19,500 Km flown'].forEach((label) =>
      expect(screen.getByLabelText(label)).toBeTruthy(),
    );
    expect(screen.getByRole('header', { name: 'Your travels' })).toBeTruthy();
  });

  it('shows 0 for every stat when there is nothing yet', async () => {
    await render(<TravelStatsCard stats={{ trips: 0, countries: 0, days: 0, flights: 0, km: 0 }} loading={false} />);
    KEYS.forEach((key) => expect(within(screen.getByTestId(`stat-${key}`)).getByText('0')).toBeTruthy());
  });

  it('shows a dash for every stat when the numbers are not available, read as "no data"', async () => {
    await render(<TravelStatsCard loading={false} />);
    KEYS.forEach((key) => expect(within(screen.getByTestId(`stat-${key}`)).getByText('–')).toBeTruthy());
    expect(screen.getByLabelText('brak danych Podróże')).toBeTruthy();
    expect(screen.queryAllByTestId('stat-skeleton', { includeHiddenElements: true })).toHaveLength(0);
  });

  it('uses typography.numericL for the values and the secondary text colour for the labels', async () => {
    await render(<TravelStatsCard stats={STATS} loading={false} />);
    const value = within(screen.getByTestId('stat-trips')).getByText('3');
    expect(style(value)).toMatchObject({ fontSize: lightTheme.typography.numericL.fontSize, color: lightTheme.colors.text.primary });
    const label = within(screen.getByTestId('stat-trips')).getByText('Podróże');
    expect(style(label)).toMatchObject({ color: lightTheme.colors.text.secondary });
    expect(label.props.numberOfLines).toBeUndefined();
  });

  it('dark mode uses the dark text colours', async () => {
    mockScheme = 'dark';
    await render(<TravelStatsCard stats={STATS} loading={false} />);
    expect(style(within(screen.getByTestId('stat-trips')).getByText('3')).color).toBe(darkTheme.colors.text.primary);
    expect(style(within(screen.getByTestId('stat-trips')).getByText('Podróże')).color).toBe(darkTheme.colors.text.secondary);
  });
});

describe('TravelStatsCard — layout (A6)', () => {
  it('standard text size: two columns, Przelecone km alone on the last row', async () => {
    await render(<TravelStatsCard stats={STATS} loading={false} />);
    const rows = screen.getAllByTestId('stats-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByTestId('stat-trips')).toBeTruthy();
    expect(within(rows[0]).getByTestId('stat-countries')).toBeTruthy();
    expect(within(rows[1]).getByTestId('stat-days')).toBeTruthy();
    expect(within(rows[1]).getByTestId('stat-flights')).toBeTruthy();
    expect(within(rows[2]).getByTestId('stat-km')).toBeTruthy();
    expect(within(rows[2]).queryByTestId('stat-flights')).toBeNull();
  });

  it('large Dynamic Type: one column, nothing truncated', async () => {
    mockFontScale = 2;
    await render(<TravelStatsCard stats={STATS} loading={false} />);
    const rows = screen.getAllByTestId('stats-row');
    expect(rows).toHaveLength(5);
    rows.forEach((row, index) => expect(within(row).getByTestId(`stat-${KEYS[index]}`)).toBeTruthy());
    KEYS.forEach((key) => {
      within(screen.getByTestId(`stat-${key}`))
        .getAllByText(/./)
        .forEach((text) => expect(text.props.numberOfLines).toBeUndefined());
    });
  });
});

describe('TravelStatsCard — loading (D9)', () => {
  it('shows five skeleton blocks in place of the values, hidden from screen readers', async () => {
    await render(<TravelStatsCard loading />);
    const blocks = screen.getAllByTestId('stat-skeleton', { includeHiddenElements: true });
    expect(blocks).toHaveLength(5);
    blocks.forEach((block) => expect(isHiddenFromAccessibility(block)).toBe(true));
    expect(screen.queryByText('–')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('skeletons have the geometry of a value: one numericL line', async () => {
    await render(<TravelStatsCard loading />);
    expect(style(screen.getAllByTestId('stat-skeleton', { includeHiddenElements: true })[0]).height).toBe(
      lightTheme.typography.numericL.lineHeight,
    );
  });

  it('skeleton height follows the font scale', async () => {
    mockFontScale = 2;
    await render(<TravelStatsCard loading />);
    expect(style(screen.getAllByTestId('stat-skeleton', { includeHiddenElements: true })[0]).height).toBe(
      lightTheme.typography.numericL.lineHeight * 2,
    );
  });

  it('exposes one busy "loading" element for the whole grid, and no separate stats', async () => {
    await render(<TravelStatsCard loading />);
    const loading = screen.getByLabelText('Wczytywanie statystyk');
    expect(loading.props.accessible).toBe(true);
    expect(loading).toBeBusy();
    expect(screen.getByTestId('stat-trips').props.accessible).not.toBe(true);
  });

  it('says the same in English', async () => {
    await i18n.changeLanguage('en');
    await render(<TravelStatsCard loading />);
    expect(screen.getByLabelText('Loading stats')).toBeBusy();
  });

  it('keeps the labels and the title while the values load', async () => {
    await render(<TravelStatsCard loading />);
    expect(screen.getByRole('header', { name: 'Twoje podróże' })).toBeTruthy();
    expect(screen.getByText('Przelecone km')).toBeTruthy();
  });
});
