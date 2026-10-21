import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { TripHero } from '@/components/TripHero';
import { TripHeroSkeleton } from '@/components/TripHeroSkeleton';
import i18n from '@/i18n';
import type { TripSummary } from '@/schemas';
import { darkTheme, lightTheme } from '@/theme/legacy/theme';

// The hero follows the phone's theme (theme-split D1, D6); tests switch the scheme.
let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
}));

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
  await i18n.changeLanguage('pl');
});

describe('TripHero (D4)', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('takes half of the screen height on the %s theme background', async (scheme, theme) => {
    mockScheme = scheme;
    await render(<TripHero trip={trip} />);
    expect(screen.getByTestId('trip-hero')).toHaveStyle({ height: 406, backgroundColor: theme.colors.background });
  });

  it('shows the cover photo, hidden from screen readers, fading into the theme background', async () => {
    await render(<TripHero trip={{ ...trip, coverImageUri: 'preset:bali' }} />);
    const hidden = { includeHiddenElements: true };
    expect(screen.queryByTestId('trip-hero-photo')).toBeNull(); // not reachable for screen readers
    expect(screen.getByTestId('trip-hero-photo', hidden).props['aria-hidden']).toBe(true);
    expect(screen.getByTestId('trip-hero-image', hidden).props.source).toEqual([{ uri: 'bundled/bali.jpg' }]); // expo-image normalises to a list
    expect(screen.getByTestId('trip-hero-gradient', hidden)).toBeTruthy();
    // The fade follows the theme's gradient token (§20 rule 20). The native gradient prop is
    // [offset, colour, offset, colour, …].
    const offsets = gradientStops().filter((_, i) => i % 2 === 0);
    expect(offsets).toEqual([lightTheme.gradient.heroFade.start, 1]);
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('fades the photo into the %s theme background (theme-split D1, D6)', async (scheme, theme) => {
    mockScheme = scheme;
    await render(<TripHero trip={{ ...trip, coverImageUri: 'preset:bali' }} />);
    // Both stops carry the background's colour (the first fully transparent): compare the colour channels, not the alpha.
    const rgb = (value: unknown) => Number(value) & 0xffffff;
    const colours = gradientStops().filter((_, i) => i % 2 === 1);
    expect(colours).toHaveLength(2);
    expect(colours.map(rgb)).toEqual([rgb(processColor(theme.colors.background)), rgb(processColor(theme.colors.background))]);
  });

  it('shows a preset cover from its bundled full-size file, on the background colour while it loads (trip-covers C3, theme-split D1)', async () => {
    await render(<TripHero trip={{ ...trip, coverImageUri: 'preset:bali' }} />);
    const image = screen.getByTestId('trip-hero-image', { includeHiddenElements: true });
    expect(image.props.source).toEqual([{ uri: 'bundled/bali.jpg' }]);
    expect(image).toHaveStyle({ backgroundColor: lightTheme.colors.background });
  });

  it('shows the placeholder on the dark background in dark mode', async () => {
    mockScheme = 'dark';
    await render(<TripHero trip={{ ...trip, coverImageUri: 'preset:bali' }} />);
    expect(screen.getByTestId('trip-hero-image', { includeHiddenElements: true })).toHaveStyle({ backgroundColor: darkTheme.colors.background });
  });

  it('shows a gallery cover from its signed full-size URL, cached under the cover\'s own id (trip-covers C3)', async () => {
    const photoId = '5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
    const coverUrls = { url: 'https://example.com/signed/cover.jpg?token=a', thumbnailUrl: 'https://example.com/signed/cover_thumb.jpg?token=a' };
    await render(<TripHero trip={{ ...trip, coverImageUri: `photo:${photoId}`, coverUrls }} />);
    const image = screen.getByTestId('trip-hero-image', { includeHiddenElements: true });
    expect(image.props.source).toEqual([{ uri: coverUrls.url, cacheKey: `cover:${photoId}:full` }]);
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('names the trip in Display XL (§4.2 "Trip hero") in the %s theme text colours, with dates and days below', async (scheme, theme) => {
    mockScheme = scheme;
    await render(<TripHero trip={trip} />);
    const name = screen.getByRole('header', { name: 'Warsaw → Bangkok' });
    expect(name).toHaveStyle({ ...theme.typography.displayXL, color: theme.colors.text.primary });
    expect(screen.getByText('3 lis – 15 lis 2026 · 13 dni')).toHaveStyle({ color: theme.colors.text.secondary });
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
    // Same geometry as the full-bleed hero (§10.18, §5.4 radius.none).
    expect(skeleton).toHaveStyle({ height: 406, borderRadius: lightTheme.radius.none, backgroundColor: lightTheme.colors.surface.secondary });
  });
});
