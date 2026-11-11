import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { radii } from '@/theme/tokens';

import { ProBadge } from '../ProBadge';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

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

// The native gradient prop is [offset, colour, offset, colour].
function gradientColours(): number[] {
  const gradient = findNode(screen.toJSON() as JsonNode | null, 'RNSVGLinearGradient');
  return ((gradient?.props.gradient as number[] | undefined) ?? []).filter((_, i) => i % 2 === 1);
}

const channel = (hex: string, start: number) => {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

beforeEach(async () => {
  mockScheme = 'light';
  await i18n.changeLanguage('pl');
});

describe('ProBadge (profile-upgrade D4, D7, D14)', () => {
  it('shows PRO with the accessible label', async () => {
    await render(<ProBadge />);
    expect(screen.getByText('PRO')).toBeTruthy();
    expect(screen.getByLabelText('Konto PRO')).toBeTruthy();
  });

  it('uses the English label', async () => {
    await i18n.changeLanguage('en');
    await render(<ProBadge />);
    expect(screen.getByLabelText('PRO account')).toBeTruthy();
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('draws a brand.primary to accent.sun gradient with brand.onBrand text and a pill radius, %s', async (scheme, theme) => {
    mockScheme = scheme;
    await render(<ProBadge />);
    const rgb = (value: unknown) => Number(value) & 0xffffff;
    expect(gradientColours().map(rgb)).toEqual([rgb(processColor(theme.brand.primary)), rgb(processColor(theme.accent.sun))]);
    expect(screen.getByText('PRO')).toHaveStyle({ color: theme.brand.onBrand });
    expect(screen.getByTestId('pro-badge')).toHaveStyle({ borderRadius: radii.pill });
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('keeps text contrast >= 4.5 on both gradient ends, %s', (_scheme, theme) => {
    expect(contrast(theme.brand.onBrand, theme.brand.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.brand.onBrand, theme.accent.sun)).toBeGreaterThanOrEqual(4.5);
  });

  it('renders nothing when the account is not PRO', async () => {
    await render(<ProBadge pro={false} />);
    expect(screen.queryByTestId('pro-badge')).toBeNull();
    expect(screen.queryByText('PRO')).toBeNull();
  });
});
