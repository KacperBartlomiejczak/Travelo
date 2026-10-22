import { render, screen } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';

import { TripHero } from '@/components/TripHero';
import i18n from '@/i18n';
import type { TripSummary } from '@/schemas';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

// The hero follows the phone's theme (theme-split D1, D6); tests switch the scheme.
let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

let mockWindow = { width: 375, height: 812 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ ...mockWindow, scale: 2, fontScale: 1 }),
}));

const { tripOverview } = tokens.screenMetrics;

// Jest turns every image into the number 1, so the Bali files are stood in by distinct objects.
jest.mock('../../../assets/covers/bali.jpg', () => ({ uri: 'bundled/bali.jpg' }));
jest.mock('../../../assets/covers/bali_thumb.jpg', () => ({ uri: 'bundled/bali_thumb.jpg' }));

const trip: TripSummary = {
  id: '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01',
  ownerId: 'local-user',
  name: 'Warsaw → Bangkok',
  coverImageUri: 'preset:auckland',
  destination: 'BKK',
  startDate: '2026-11-03',
  endDate: '2026-11-15',
  baseCurrency: 'THB',
  budgetPerPerson: { amountMinor: 3000000, currency: 'THB' },
  createdAt: '2026-10-04T12:00:00.000Z',
  budgetUpdatedAt: '2026-10-04T12:00:00.000Z',
  travellerCount: 3,
};

type JsonNode = { type: string; props: Record<string, unknown>; children: (JsonNode | string)[] | null };

function findNode(node: JsonNode | string | null, type: string): JsonNode | null {
  if (!node || typeof node === 'string') return null;
  if (node.type === type) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, type);
    if (found) return found;
  }
  return null;
}

// The SVG stops have no testID; the native LinearGradient carries them as one array.
function gradientStops(): number[] {
  const gradient = findNode(screen.toJSON() as JsonNode | null, 'RNSVGLinearGradient');
  return (gradient?.props.gradient as number[] | undefined) ?? [];
}

beforeEach(async () => {
  mockScheme = 'light';
  mockWindow = { width: 375, height: 812 };
  await i18n.changeLanguage('pl');
});

// Sunline Editorial §9.1 Hero, with the trip view following the phone theme (sunline-redesign D2, D6).
describe('TripHero (D4, §9.1)', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('is 52% of the screen height on the %s theme canvas', async (scheme, theme) => {
    mockScheme = scheme;
    await render(<TripHero trip={trip} />);
    expect(tripOverview.heroHeightRatio).toBe(0.52);
    expect(screen.getByTestId('trip-hero')).toHaveStyle({ height: 422, backgroundColor: theme.background.canvas });
  });

  it('never gets shorter than the minimum hero height on a short screen', async () => {
    mockWindow = { width: 375, height: 600 };
    await render(<TripHero trip={trip} />);
    expect(tripOverview.heroMinHeight).toBe(360);
    expect(screen.getByTestId('trip-hero')).toHaveStyle({ height: 360 });
  });

  it('shows the cover photo, hidden from screen readers, fading into the theme canvas', async () => {
    await render(<TripHero trip={{ ...trip, coverImageUri: 'preset:bali' }} />);
    const hidden = { includeHiddenElements: true };
    expect(screen.queryByTestId('trip-hero-photo')).toBeNull(); // not reachable for screen readers
    expect(screen.getByTestId('trip-hero-photo', hidden).props['aria-hidden']).toBe(true);
    expect(screen.getByTestId('trip-hero-image', hidden).props.source).toEqual([{ uri: 'bundled/bali.jpg' }]); // expo-image normalises to a list
    expect(screen.getByTestId('trip-hero-gradient', hidden)).toBeTruthy();
    // The fade starts at the screen-metrics token (0.35). The native gradient prop is [offset, colour, offset, colour, …].
    const offsets = gradientStops().filter((_, i) => i % 2 === 0);
    expect(offsets).toEqual([tripOverview.heroFadeStart, 1]);
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('fades the photo into the %s theme background.canvas (theme-split D1, D6)', async (scheme, theme) => {
    mockScheme = scheme;
    await render(<TripHero trip={{ ...trip, coverImageUri: 'preset:bali' }} />);
    // Both stops carry the canvas colour (the first fully transparent): compare the colour channels, not the alpha.
    const rgb = (value: unknown) => Number(value) & 0xffffff;
    const colours = gradientStops().filter((_, i) => i % 2 === 1);
    expect(colours).toHaveLength(2);
    expect(colours.map(rgb)).toEqual([rgb(processColor(theme.background.canvas)), rgb(processColor(theme.background.canvas))]);
  });

  it('shows a preset cover from its bundled full-size file, on the canvas colour while it loads (trip-covers C3, theme-split D1)', async () => {
    await render(<TripHero trip={{ ...trip, coverImageUri: 'preset:bali' }} />);
    const image = screen.getByTestId('trip-hero-image', { includeHiddenElements: true });
    expect(image.props.source).toEqual([{ uri: 'bundled/bali.jpg' }]);
    expect(image).toHaveStyle({ backgroundColor: lightTheme.background.canvas });
  });

  it('shows the placeholder on the dark canvas in dark mode', async () => {
    mockScheme = 'dark';
    await render(<TripHero trip={{ ...trip, coverImageUri: 'preset:bali' }} />);
    expect(screen.getByTestId('trip-hero-image', { includeHiddenElements: true })).toHaveStyle({ backgroundColor: darkTheme.background.canvas });
  });

  it("shows a gallery cover from its signed full-size URL, cached under the cover's own id (trip-covers C3)", async () => {
    const photoId = '5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
    const coverUrls = { url: 'https://example.com/signed/cover.jpg?token=a', thumbnailUrl: 'https://example.com/signed/cover_thumb.jpg?token=a' };
    await render(<TripHero trip={{ ...trip, coverImageUri: `photo:${photoId}`, coverUrls }} />);
    const image = screen.getByTestId('trip-hero-image', { includeHiddenElements: true });
    expect(image.props.source).toEqual([{ uri: coverUrls.url, cacheKey: `cover:${photoId}:full` }]);
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('names the trip in Fraunces Display LG below the photo in the %s text colours, with dates and days in Body MD', async (scheme, theme) => {
    mockScheme = scheme;
    await render(<TripHero trip={trip} />);
    const name = screen.getByRole('header', { name: 'Warsaw → Bangkok' });
    expect(tokens.typography.styles.displayLG.fontFamily).toBe('Fraunces_600SemiBold');
    expect(name).toHaveStyle({ ...tokens.typography.styles.displayLG, color: theme.text.primary });
    expect(screen.getByText('3 lis – 15 lis 2026 · 13 dni')).toHaveStyle({ ...tokens.typography.styles.bodyMD, color: theme.text.secondary });
  });

  it('puts the text on the canvas, not over the photo: no hero text colour or scrim', async () => {
    await render(<TripHero trip={trip} />);
    const name = StyleSheet.flatten(screen.getByRole('header', { name: 'Warsaw → Bangkok' }).props.style);
    expect(name.color).not.toBe(lightTheme.hero.text);
    expect(JSON.stringify(screen.toJSON())).not.toContain(lightTheme.hero.scrim);
  });

  it.each([
    [375, tokens.layout.screenGutterCompact],
    [430, tokens.layout.screenGutter],
  ])('insets the text by the screen gutter: at %i dp wide it is %i dp (§4.2)', async (width, gutter) => {
    mockWindow = { width, height: 812 };
    await render(<TripHero trip={trip} />);
    const block = screen.getByRole('header', { name: 'Warsaw → Bangkok' }).parent;
    expect(block).toHaveStyle({ paddingHorizontal: gutter, paddingBottom: tokens.spacing[6] });
  });

  it('reads in English', async () => {
    await i18n.changeLanguage('en');
    await render(<TripHero trip={trip} />);
    expect(screen.getByText('Nov 3 – Nov 15, 2026 · 13 days')).toBeTruthy();
  });
});
