import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Keyboard,
  ScrollView,
  TextInput,
  type EmitterSubscription,
  type HostInstance,
  type KeyboardEvent,
  type MeasureInWindowOnSuccessCallback,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import i18n from '@/i18n';
import { formatMoney } from '@/lib/money';
import { AppProviders } from '@/providers/AppProviders';
import type { TripMember, TripSummary } from '@/schemas';
import { drawsCircleAlert } from '@/test/alert-icon';
import { lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';

import { BudgetSheet } from '../BudgetSheet';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const ERROR = 'Nie udało się zapisać. Spróbuj ponownie.';

const trip: TripSummary = {
  id: TRIP_ID,
  ownerId: 'local-user',
  name: 'Warsaw → Bangkok',
  coverImageUri: 'preset:auckland',
  destination: 'BKK',
  startDate: '2026-11-03',
  endDate: '2026-11-15',
  baseCurrency: 'THB',
  dailyBudget: { amountMinor: 300000, currency: 'THB' },
  createdAt: '2026-10-04T12:00:00.000Z',
  budgetUpdatedAt: '2026-10-04T12:00:00.000Z',
  travellerCount: 3,
};

const KASIA = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a02';
const OLA = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a03';
const member = (id: string, displayName: string, dailyBudgetMinor: number): TripMember => ({ id, tripId: TRIP_ID, userId: null, displayName, role: 'viewer', interests: [], dailyBudgetMinor });
const equalMembers = [member(KASIA, 'Kasia', 300000), member(OLA, 'Ola', 300000)];
const unequalMembers = [member(KASIA, 'Kasia', 300000), member(OLA, 'Ola', 150000)];

type SetBudget = jest.Mock<Promise<void>, Parameters<TripRepository['setBudget']>>;

// A mock `setBudget` that answers with `impl`.
const budget = (impl: () => Promise<void> = async () => {}): SetBudget => jest.fn((_trip, _amountMinor) => impl());

async function setup(setBudget: SetBudget = budget(), members: TripMember[] = equalMembers, tripOverride: TripSummary = trip) {
  const onClose = jest.fn();
  const repository: TripRepository = { ...createInMemoryTripRepository(), setBudget };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppProviders tripRepository={repository}>
        <BudgetSheet trip={tripOverride} members={members} onClose={onClose} />
      </AppProviders>
    </SafeAreaProvider>,
  );
  return { onClose, setBudget };
}

const save = () => screen.getByRole('button', { name: 'Zapisz' });

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BudgetSheet (trips-supabase D5, sunline-redesign D28)', () => {
  it('saves the new amount in minor units, then closes', async () => {
    const { onClose, setBudget } = await setup();
    await fireEvent.changeText(screen.getByLabelText('Kwota dziennie na osobę'), '2500');
    await fireEvent.press(save());
    expect(setBudget).toHaveBeenCalledWith(expect.objectContaining({ id: TRIP_ID, baseCurrency: 'THB' }), {
      organizerDailyMinor: 250000,
      members: [
        { memberId: KASIA, dailyMinor: 250000 },
        { memberId: OLA, dailyMinor: 250000 },
      ],
    });
    await act(async () => {});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the sheet open when saving fails, with the error as a CircleAlert and text, announced, never colour alone (D28)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { onClose } = await setup(budget(() => Promise.reject(new Error('disk full'))));
    await fireEvent.changeText(screen.getByLabelText('Kwota dziennie na osobę'), '2500');
    await fireEvent.press(save());

    const message = await screen.findByText(ERROR);
    expect(message).toHaveStyle({ ...tokens.typography.styles.bodySM, color: lightTheme.semantic.error.foreground });
    expect(message.props.accessibilityLiveRegion).toBe('polite');
    const icon = screen.getByTestId('budget-error-icon', { includeHiddenElements: true });
    expect(icon.props).toMatchObject({ width: tokens.iconography.size.xs, stroke: lightTheme.semantic.error.foreground, strokeWidth: tokens.iconography.strokeWidth });
    expect(drawsCircleAlert(icon)).toBe(true);
    expect(screen.queryByTestId('budget-error-icon')).toBeNull(); // hidden from the accessibility tree
    expect(announce).toHaveBeenCalledWith(ERROR);
    expect(onClose).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();
  });

  it('shows no error before anything failed', async () => {
    await setup();
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(screen.queryByTestId('budget-error-icon', { includeHiddenElements: true })).toBeNull();
  });

  it('opens in Razem when everyone has the same amount, with one field', async () => {
    await setup();
    expect(screen.getByRole('radio', { name: 'Razem' })).toBeChecked();
    expect(screen.queryByLabelText('Kasia')).toBeNull();
    expect(screen.getByLabelText('Kwota dziennie na osobę').props.value).toBe('3000');
  });

  it('opens in Osobno when amounts differ, one field per person', async () => {
    await setup(budget(), unequalMembers);
    expect(screen.getByRole('radio', { name: 'Osobno' })).toBeChecked();
    expect(screen.getByLabelText('Ty').props.value).toBe('3000');
    expect(screen.getByLabelText('Kasia').props.value).toBe('3000');
    expect(screen.getByLabelText('Ola').props.value).toBe('1500');
  });

  it('has no Razem / Osobno switch on a solo trip', async () => {
    await setup(budget(), [], { ...trip, travellerCount: 1 });
    expect(screen.queryByRole('radio', { name: 'Osobno' })).toBeNull();
    expect(screen.getByLabelText('Kwota dziennie')).toBeTruthy();
  });

  it('prefills everyone with the shared amount when switching to Osobno, and uses the organizer amount going back', async () => {
    await setup();
    await fireEvent.changeText(screen.getByLabelText('Kwota dziennie na osobę'), '1000');
    await fireEvent.press(screen.getByRole('radio', { name: 'Osobno' }));
    expect(screen.getByLabelText('Kasia').props.value).toBe('1000');
    await fireEvent.changeText(screen.getByLabelText('Ola'), '400');
    await fireEvent.changeText(screen.getByLabelText('Ty'), '900');
    await fireEvent.press(screen.getByRole('radio', { name: 'Razem' }));
    expect(screen.getByLabelText('Kwota dziennie na osobę').props.value).toBe('900');
  });

  it('saves every amount of the full list in Osobno', async () => {
    const { setBudget } = await setup(budget(), unequalMembers);
    await fireEvent.changeText(screen.getByLabelText('Ola'), '2000');
    await fireEvent.press(save());
    expect(setBudget).toHaveBeenCalledWith(expect.anything(), {
      organizerDailyMinor: 300000,
      members: [
        { memberId: KASIA, dailyMinor: 300000 },
        { memberId: OLA, dailyMinor: 200000 },
      ],
    });
  });

  it('does not save when a person has no amount in Osobno, and flags the field', async () => {
    const { setBudget } = await setup(budget(), unequalMembers);
    await fireEvent.changeText(screen.getByLabelText('Ola'), '');
    await fireEvent.press(save());
    expect(setBudget).not.toHaveBeenCalled();
    expect(screen.getByText('Wpisz kwotę')).toBeTruthy();
  });

  it('shows the group total and each person total for the trip (13 days)', async () => {
    await setup(budget(), unequalMembers);
    expect(screen.getByText(`Razem dla 3 osób: ${formatMoney({ amountMinor: 9750000, currency: 'THB' }, 'pl')}`)).toBeTruthy();
    expect(screen.getByText(`Ola: ${formatMoney({ amountMinor: 1950000, currency: 'THB' }, 'pl')} na podróż`)).toBeTruthy();
  });

  it('scrolls the fields when many people are listed, with Save outside the scroll area', async () => {
    const many = Array.from({ length: 9 }, (_, i) => member(`0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1b${String(i).padStart(2, '0')}`, `Friend ${i}`, 100000 + i));
    await setup(budget(), many);
    expect(screen.getByTestId('budget-scroll').type).toBe('RCTScrollView');
    const scroll = within(screen.getByTestId('budget-scroll'));
    expect(scroll.getByLabelText('Friend 8')).toBeTruthy();
    expect(scroll.getByLabelText('Ty')).toBeTruthy();
    expect(scroll.queryByRole('button', { name: 'Zapisz' })).toBeNull();
    expect(save()).toBeTruthy();
  });

  it('keeps distinct amounts when the already active Osobno is tapped again', async () => {
    await setup(budget(), unequalMembers);
    await fireEvent.press(screen.getByRole('radio', { name: 'Osobno' }));
    expect(screen.getByLabelText('Ty').props.value).toBe('3000');
    expect(screen.getByLabelText('Ola').props.value).toBe('1500');
  });

  it('shows no "greater than zero" error while typing 0, only after Zapisz', async () => {
    await setup();
    await fireEvent.changeText(screen.getByLabelText('Kwota dziennie na osobę'), '0');
    expect(screen.queryByText('Kwota musi być większa od zera')).toBeNull();
    await fireEvent.press(save());
    expect(screen.getByText('Kwota musi być większa od zera')).toBeTruthy();
  });

  // iOS: the keyboard covers the lower fields, so the focused one is scrolled up (same hook as the wizard).
  it('scrolls the focused field above the keyboard once it is shown (iOS)', async () => {
    const listeners: Record<string, ((event: KeyboardEvent) => void)[]> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
      (listeners[name] ??= []).push(listener as (event: KeyboardEvent) => void);
      return { remove: () => {} } as EmitterSubscription;
    });
    const inWindow = (top: number, height: number) =>
      ({ measureInWindow: (cb: MeasureInWindowOnSuccessCallback) => cb(0, top, 390, height) }) as unknown as HostInstance;
    jest.mocked(ScrollView.prototype.getNativeScrollRef).mockReturnValue(inWindow(100, 500));
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(inWindow(650, 48));
    const scrollTo = jest.mocked(ScrollView.prototype.scrollTo);
    scrollTo.mockClear();
    await setup();
    for (const listener of listeners.keyboardDidShow ?? []) listener({} as KeyboardEvent);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 650 + 48 + tokens.spacing[4] - 600, animated: true });
  });
});
