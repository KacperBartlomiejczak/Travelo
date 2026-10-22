import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import TabsLayout from '@/app/(drawer)/(tabs)/_layout';
import HomeScreen from '@/app/(drawer)/(tabs)/index';
import DrawerLayout from '@/app/(drawer)/_layout';
import RootLayout from '@/app/_layout';
import BudgetStep from '@/app/trips/new/budget';
import FlightsStep from '@/app/trips/new/index';
import FriendsStep from '@/app/trips/new/friends';
import NewTripLayout from '@/app/trips/new/_layout';
import SummaryStep from '@/app/trips/new/summary';
import { createInMemoryProfileRepository } from '@/data/profile-repository';
import { emptyFriend, emptySegment, withCompanionCount } from '@/features/trip-create/draft';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import i18n from '@/i18n';
import { formatMoney } from '@/lib/money';
import { repositoryWithProfile, setAppProfileRepository } from '@/test/fake-profile-repository';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 2, fontScale: 1 }),
}));

const { styles } = tokens.typography;

// The new look of the wizard (sunline-redesign step 9): canvas, gutters, headings, cards, header. Behavior is in the other tests.
type Step = 'friends' | 'budget' | 'summary';

// Stand-in for step 1: a complete flights draft with two friends and 3000 per person, then a jump to `step`.
function Seed() {
  const { setDraft } = useTripDraft();
  const router = useRouter();
  function go(step: Step) {
    setDraft((draft) => {
      const withFriends = withCompanionCount(draft, 2);
      return {
        ...withFriends,
        outbound: [{ ...emptySegment(), fromIata: 'WAW', departTz: 'Europe/Warsaw', toIata: 'BKK', arriveTz: 'Asia/Bangkok', departAt: '2026-11-02T22:00', arriveAt: '2026-11-03T14:00' }],
        return: [{ ...emptySegment(), fromIata: 'BKK', departTz: 'Asia/Bangkok', toIata: 'WAW', arriveTz: 'Europe/Warsaw', departAt: '2026-11-15T09:00', arriveAt: '2026-11-15T17:00' }],
        friends: [{ ...emptyFriend(), displayName: 'Kasia', interests: ['beaches'] }, { ...emptyFriend(), displayName: 'Ola' }],
        budget: { amountText: '3000', currency: '' },
      };
    });
    router.push(`/trips/new/${step}`);
  }
  return (
    <>
      {(['friends', 'budget', 'summary'] as const).map((step) => (
        <Pressable key={step} onPress={() => go(step)}>
          <Text>{`test: go to ${step}`}</Text>
        </Pressable>
      ))}
    </>
  );
}

async function open(step: 'flights' | Step) {
  const rendered = renderRouter(
    {
      _layout: RootLayout,
      '(drawer)/_layout': DrawerLayout,
      '(drawer)/(tabs)/_layout': TabsLayout,
      '(drawer)/(tabs)/index': HomeScreen,
      'trips/new/_layout': NewTripLayout,
      'trips/new/index': FlightsStep,
      'trips/new/seed': Seed,
      'trips/new/friends': FriendsStep,
      'trips/new/budget': BudgetStep,
      'trips/new/summary': SummaryStep,
    },
    { initialUrl: step === 'flights' ? '/trips/new' : '/trips/new/seed' },
  );
  const { container } = await rendered;
  if (step !== 'flights') await fireEvent.press(await screen.findByText(`test: go to ${step}`));
  await screen.findByTestId('wizard-screen');
  return { container };
}

const flat = (element: { props: { style?: unknown } }): ViewStyle => StyleSheet.flatten(element.props.style as ViewStyle);

beforeEach(async () => {
  mockScheme = 'light';
  mockWidth = 390;
  await i18n.changeLanguage('pl');
});

describe('Wizard frame', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('is the canvas colour in %s mode, with a 720 dp column, 16 dp above the content and 24 dp between blocks', async (scheme, theme) => {
    mockScheme = scheme;
    await open('flights');
    expect(screen.getByTestId('wizard-screen')).toHaveStyle({ flex: 1, backgroundColor: theme.background.canvas });
    expect(flat({ props: { style: screen.getByTestId('wizard-scroll').props.contentContainerStyle } })).toMatchObject({
      maxWidth: tokens.layout.maxContentWidth,
      paddingTop: tokens.spacing[4],
      gap: tokens.spacing[6],
    });
  });

  it.each([
    [389, tokens.layout.screenGutterCompact],
    [390, tokens.layout.screenGutter],
  ])('uses the %i dp wide screen\'s gutter of %i dp for the content and the action (§4.2)', async (width, gutter) => {
    mockWidth = width;
    await open('flights');
    const content = flat({ props: { style: screen.getByTestId('wizard-scroll').props.contentContainerStyle } });
    expect(content.paddingHorizontal).toBe(gutter);
    expect(screen.getByTestId('wizard-action')).toHaveStyle({ paddingHorizontal: gutter, maxWidth: tokens.layout.maxContentWidth });
  });

  it('pins the action 12 dp below the content and 16 dp above the bottom edge', async () => {
    await open('flights');
    expect(screen.getByTestId('wizard-action')).toHaveStyle({ paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[4] });
  });
});

describe('Wizard header', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('is the canvas colour with a text.primary tint, a headingSM title and no shadow line in %s mode', async (scheme, theme) => {
    mockScheme = scheme;
    const { container } = await open('flights');
    const header = container.queryAll((node) => node.type === 'RNSScreenStackHeaderConfig' && !node.props.hidden && node.props.title === 'Nowa podróż');
    expect(header.length).toBeGreaterThan(0);
    expect(header[0].props).toMatchObject({
      backgroundColor: theme.background.canvas,
      color: theme.text.primary,
      hideShadow: true,
      titleFontFamily: styles.headingSM.fontFamily,
      titleFontSize: styles.headingSM.fontSize,
    });
  });
});

describe('Flights step look', () => {
  it('has a headingLG heading and headingSM direction title, and segment cards on the card spec', async () => {
    await open('flights');
    expect(screen.getByRole('header', { name: 'Kiedy i dokąd lecisz?' })).toHaveStyle({ ...styles.headingLG, color: lightTheme.text.primary });
    expect(screen.getByRole('header', { name: 'Lot tam' })).toHaveStyle({ ...styles.headingSM, color: lightTheme.text.primary });

    const card = screen.getByTestId('Lot tam-Odcinek 1');
    expect(card).toHaveStyle({
      backgroundColor: lightTheme.surface.primary,
      borderRadius: tokens.components.card.radius,
      borderWidth: tokens.components.card.borderWidth,
      borderColor: lightTheme.border.subtle,
    });
    expect(within(card).getByText('Odcinek 1')).toHaveStyle({ ...styles.labelLG, color: lightTheme.text.primary });
  });

  it('draws the heading and cards in the dark theme', async () => {
    mockScheme = 'dark';
    await open('flights');
    expect(screen.getByRole('header', { name: 'Kiedy i dokąd lecisz?' })).toHaveStyle({ color: darkTheme.text.primary });
    expect(screen.getByTestId('Lot tam-Odcinek 1')).toHaveStyle({ backgroundColor: darkTheme.surface.primary });
  });

  it('keeps the card title row 44 dp tall', async () => {
    await open('flights');
    expect(within(screen.getByTestId('Lot tam-Odcinek 1')).getByText('Odcinek 1').parent).toHaveStyle({ minHeight: tokens.layout.touchTarget });
  });
});

describe('Friends step look', () => {
  it('has a headingLG heading, a bodyMD secondary hint, and cards with labelLG title and labelMD group label', async () => {
    await open('friends');
    expect(screen.getByRole('header', { name: 'Kto leci z Tobą?' })).toHaveStyle({ ...styles.headingLG, color: lightTheme.text.primary });
    expect(screen.getByText('Zaznacz, co lubią — plan dnia to uwzględni.')).toHaveStyle({ ...styles.bodyMD, color: lightTheme.text.secondary });

    const card = screen.getByTestId('friend-1');
    expect(card).toHaveStyle({
      backgroundColor: lightTheme.surface.primary,
      borderRadius: tokens.components.card.radius,
      borderColor: lightTheme.border.subtle,
    });
    expect(within(card).getByText('Znajomy 1')).toHaveStyle({ ...styles.labelLG, color: lightTheme.text.primary });
    expect(within(card).getByText('Co lubi?')).toHaveStyle({ ...styles.labelMD, color: lightTheme.text.primary });
  });

  it('draws the hint in text.secondary and the card in the dark theme', async () => {
    mockScheme = 'dark';
    await open('friends');
    expect(screen.getByText('Zaznacz, co lubią — plan dnia to uwzględni.')).toHaveStyle({ color: darkTheme.text.secondary });
    expect(screen.getByTestId('friend-1')).toHaveStyle({ backgroundColor: darkTheme.surface.primary });
  });

  it('shows the code check as a bodySM text.secondary line while the code is being checked', async () => {
    const base = await repositoryWithProfile(createInMemoryProfileRepository({}));
    setAppProfileRepository({ ...base, findByFriendCode: () => new Promise(() => {}) });
    await open('friends');
    await fireEvent.changeText(within(screen.getByTestId('friend-1')).getByLabelText(/Kod znajomego/), '5ZMRX8');
    const row = await within(screen.getByTestId('friend-1')).findByTestId('friend-code-checking');
    expect(within(row).getByText('Sprawdzam kod…', { includeHiddenElements: true })).toHaveStyle({ ...styles.bodySM, color: lightTheme.text.secondary });
  });
});

describe('Budget step look', () => {
  it('has a headingLG heading, a bodyMD secondary hint, a labelMD currency label and bodyMD totals', async () => {
    await open('budget');
    expect(screen.getByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toHaveStyle({ ...styles.headingLG, color: lightTheme.text.primary });
    expect(screen.getByText(/^Na cały wyjazd/)).toHaveStyle({ ...styles.bodyMD, color: lightTheme.text.secondary });
    // The label above the segmented control (the control itself is a radiogroup with the same name).
    expect(screen.getByText('Waluta')).toHaveStyle({ ...styles.labelMD, color: lightTheme.text.primary });
    expect(screen.getByText(/^Razem dla 3 osób/)).toHaveStyle({ ...styles.bodyMD, color: lightTheme.text.primary });
    expect(screen.getByText(/dziennie na osobę$/)).toHaveStyle({ ...styles.bodyMD, color: lightTheme.text.secondary });
  });

  it('draws the texts in the dark theme', async () => {
    mockScheme = 'dark';
    await open('budget');
    expect(screen.getByRole('header', { name: 'Ile chcecie wydać na osobę?' })).toHaveStyle({ color: darkTheme.text.primary });
    expect(screen.getByText(/dziennie na osobę$/)).toHaveStyle({ color: darkTheme.text.secondary });
  });
});

describe('Summary step look', () => {
  const section = (name: string) => within(screen.getByTestId(`summary-${name}`));

  it('has a headingLG heading and cards with a headingSM destination, labelLG titles, labelMD groups and bodyMD lines', async () => {
    await open('summary');
    expect(screen.getByRole('header', { name: 'Sprawdź podróż' })).toHaveStyle({ ...styles.headingLG, color: lightTheme.text.primary });

    for (const id of ['summary-details', 'summary-trip', 'summary-travellers', 'summary-budget']) {
      expect(screen.getByTestId(id)).toHaveStyle({
        backgroundColor: lightTheme.surface.primary,
        borderRadius: tokens.components.card.radius,
        borderColor: lightTheme.border.subtle,
      });
    }
    expect(within(screen.getByTestId('summary-details')).getByRole('header', { name: 'Nazwa i zdjęcie' })).toHaveStyle({ ...styles.labelLG, color: lightTheme.text.primary });
    expect(section('trip').getAllByRole('header')[0]).toHaveStyle({ ...styles.headingSM, color: lightTheme.text.primary });
    expect(section('travellers').getByRole('header', { name: 'Podróżni · 3 osoby' })).toHaveStyle({ ...styles.labelLG, color: lightTheme.text.primary });
    expect(section('budget').getByRole('header', { name: 'Budżet' })).toHaveStyle({ ...styles.labelLG, color: lightTheme.text.primary });

    expect(section('trip').getByText('Lot tam')).toHaveStyle({ ...styles.labelMD, color: lightTheme.text.primary, marginTop: tokens.spacing[2] });
    expect(section('trip').getByText('Powrót')).toHaveStyle({ ...styles.labelMD, color: lightTheme.text.primary });
    expect(section('trip').getByText(/dni$|dzień$|dnia$/)).toHaveStyle({ ...styles.bodyMD, color: lightTheme.text.secondary });
    expect(section('trip').getByText(/^WAW /)).toHaveStyle({ ...styles.bodyMD, color: lightTheme.text.primary });
    expect(section('travellers').getByText('Ty')).toHaveStyle({ ...styles.bodyMD, color: lightTheme.text.primary });
    expect(section('budget').getByText('na osobę')).toHaveStyle({ ...styles.bodyMD, color: lightTheme.text.secondary });
  });

  it('shows the budget amount in moneyLG', async () => {
    await open('summary');
    const amount = formatMoney({ amountMinor: 300000, currency: 'THB' }, 'pl');
    expect(section('budget').getByText(amount)).toHaveStyle({ ...styles.moneyLG, color: lightTheme.text.primary });
  });

  it('draws the cards and texts in the dark theme', async () => {
    mockScheme = 'dark';
    await open('summary');
    expect(screen.getByTestId('summary-budget')).toHaveStyle({ backgroundColor: darkTheme.surface.primary });
    expect(section('travellers').getByText('Ty')).toHaveStyle({ color: darkTheme.text.primary });
    expect(section('budget').getByText('na osobę')).toHaveStyle({ color: darkTheme.text.secondary });
  });
});
