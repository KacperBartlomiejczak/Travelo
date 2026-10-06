import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert, Pressable, Text } from 'react-native';

import RootLayout from '@/app/_layout';
import TripsScreen from '@/app/index';
import NewTripLayout from '@/app/trips/new/_layout';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import { useGoToNextStep, WizardScreen } from '@/features/trip-create/WizardScreen';
import i18n from '@/i18n';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mocked(useFonts).mockReturnValue([true, null]);

// Stand-in for step 1: the shell's routing is tested here; the real flights form (which validates
// before moving on) is tested in flights.test.tsx.
function ShellFlights() {
  const goNext = useGoToNextStep('flights');
  return <WizardScreen step="flights" action={{ label: 'Dalej', onPress: goNext }} />;
}

// Stand-in for step 2 (the real friends form validates first; see friends.test.tsx).
function ShellFriends() {
  const goNext = useGoToNextStep('friends');
  return <WizardScreen step="friends" action={{ label: 'Dalej', onPress: goNext }} />;
}

// Stand-in for step 3 (the real budget form validates first; see budget.test.tsx).
function ShellBudget() {
  const goNext = useGoToNextStep('budget');
  return <WizardScreen step="budget" action={{ label: 'Dalej', onPress: goNext }} />;
}

// Stand-in for step 4 (the real summary needs a complete draft; see summary.test.tsx).
function ShellSummary() {
  return <WizardScreen step="summary" />;
}

// Same, plus a control that changes the draft.
function FlightsWithTestControls() {
  const { setCompanionCount } = useTripDraft();
  return (
    <>
      <Pressable onPress={() => setCompanionCount(2)}>
        <Text>test: two friends</Text>
      </Pressable>
      <ShellFlights />
    </>
  );
}

function renderWizard(flights: () => React.JSX.Element = ShellFlights) {
  return renderRouter(
    {
      _layout: RootLayout,
      index: TripsScreen,
      'trips/new/_layout': NewTripLayout,
      'trips/new/index': flights,
      'trips/new/friends': ShellFriends,
      'trips/new/budget': ShellBudget,
      'trips/new/summary': ShellSummary,
    },
    { initialUrl: '/' },
  );
}

async function openWizard(flights: () => React.JSX.Element = ShellFlights) {
  // renderRouter attaches getPathname to the returned promise, not to the awaited result.
  const rendered = renderWizard(flights);
  const { container } = await rendered;
  await fireEvent.press(screen.getByText('Utwórz podróż'));
  return { container, getPathname: () => rendered.getPathname() };
}

// Pressing native header items (headerLeft) does not reach router.back() in Jest, so leaving is driven
// with router.back(); the button's label is still asserted below.
// Native Stack headers are not <Text> in Jest; titles are read from their config.
function headerConfigs(container: Awaited<ReturnType<typeof openWizard>>['container']) {
  return container.queryAll((node) => node.type === 'RNSScreenStackHeaderConfig');
}

function headerTitles(container: Awaited<ReturnType<typeof openWizard>>['container']) {
  return headerConfigs(container)
    .map((node) => node.props.title)
    .filter(Boolean);
}

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Create trip wizard', () => {
  it('opens on step 1 titled "Nowa podróż"', async () => {
    const app = await openWizard();
    const { container } = app;
    expect(app.getPathname()).toBe('/trips/new');
    expect(screen.getByRole('progressbar', { name: 'Krok 1 z 3' })).toBeTruthy();
    expect(headerTitles(container)).toContain('Nowa podróż');
  });

  it('shows the English title', async () => {
    await i18n.changeLanguage('en');
    const renderedApp = renderWizard();
    const { container } = await renderedApp;
    await fireEvent.press(screen.getByText('Create trip'));
    expect(headerTitles(container)).toContain('New trip');
  });

  it('labels the step-1 back button with the trips list title, not the route name (trips-empty-state D7)', async () => {
    await openWizard();
    expect(screen.getByRole('button', { name: 'Twoje podróże' })).toBeTruthy();
  });

  it('labels the in-wizard back button "Wstecz" on later steps', async () => {
    const app = await openWizard();
    await fireEvent.press(screen.getByText('Dalej'));
    // Visible wizard headers in stack order: [flights, budget]; the root stack's own headers are hidden.
    const wizardHeaders = headerConfigs(app.container).filter((node) => !node.props.hidden);
    expect(wizardHeaders).toHaveLength(2);
    expect(wizardHeaders[1].props.backTitle).toBe('Wstecz');
  });

  it('skips friends when travelling alone: flights → budget → summary (3 steps)', async () => {
    const app = await openWizard();
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/budget');
    expect(screen.getByRole('progressbar', { name: 'Krok 2 z 3' })).toBeTruthy();
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/summary');
    expect(screen.getByRole('progressbar', { name: 'Krok 3 z 3' })).toBeTruthy();
  });

  it('includes friends when friends fly along (4 steps)', async () => {
    const app = await openWizard(FlightsWithTestControls);
    await fireEvent.press(screen.getByText('test: two friends'));
    expect(screen.getByRole('progressbar', { name: 'Krok 1 z 4' })).toBeTruthy();
    await fireEvent.press(screen.getByText('Dalej'));
    expect(app.getPathname()).toBe('/trips/new/friends');
    expect(screen.getByRole('progressbar', { name: 'Krok 2 z 4' })).toBeTruthy();
    await fireEvent.press(screen.getByText('Dalej'));
    expect(screen.getByRole('progressbar', { name: 'Krok 3 z 4' })).toBeTruthy();
  });

  it('keeps the draft when going back a step', async () => {
    const app = await openWizard(FlightsWithTestControls);
    await fireEvent.press(screen.getByText('test: two friends'));
    await fireEvent.press(screen.getByText('Dalej'));
    await act(() => router.back()); // system back
    expect(app.getPathname()).toBe('/trips/new');
    expect(screen.getByRole('progressbar', { name: 'Krok 1 z 4' })).toBeTruthy();
  });

  it('leaves step 1 back to the trips list without asking when nothing was entered', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const app = await openWizard();
    await act(() => router.back()); // header back on step 1 / system back
    expect(app.getPathname()).toBe('/');
    expect(alert).not.toHaveBeenCalled();
  });

  it('asks before discarding entered data, and stays on "Zostań" (D19)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await openWizard(FlightsWithTestControls);
    await fireEvent.press(screen.getByText('test: two friends'));
    await act(() => router.back()); // header back on step 1 / system back
    expect(alert).toHaveBeenCalledWith('Odrzucić wpisane dane?', expect.any(String), expect.any(Array));
    expect(app.getPathname()).toBe('/trips/new');
  });

  it('leaves and drops the draft on "Odrzuć"', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await openWizard(FlightsWithTestControls);
    await fireEvent.press(screen.getByText('test: two friends'));
    await act(() => router.back()); // header back on step 1 / system back
    const discard = alert.mock.calls[0][2]?.find((button) => button.style === 'destructive');
    await act(async () => discard?.onPress?.());
    expect(await screen.findByText('Twoje podróże')).toBeTruthy();
    expect(app.getPathname()).toBe('/');

    // A new wizard starts empty again.
    await fireEvent.press(screen.getByText('Utwórz podróż'));
    expect(screen.getByRole('progressbar', { name: 'Krok 1 z 3' })).toBeTruthy();
  });
});
