import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createInMemoryTripRepository, type TripRepository } from '@/data/trip-repository';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import type { TripSummary } from '@/schemas';
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
  budgetPerPerson: { amountMinor: 300000, currency: 'THB' },
  createdAt: '2026-10-04T12:00:00.000Z',
  budgetUpdatedAt: '2026-10-04T12:00:00.000Z',
  travellerCount: 3,
};

type SetBudget = jest.Mock<Promise<void>, Parameters<TripRepository['setBudget']>>;

// A mock `setBudget` that answers with `impl`.
const budget = (impl: () => Promise<void> = async () => {}): SetBudget => jest.fn((_trip, _amountMinor) => impl());

async function setup(setBudget: SetBudget = budget()) {
  const onClose = jest.fn();
  const repository: TripRepository = { ...createInMemoryTripRepository(), setBudget };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppProviders tripRepository={repository}>
        <BudgetSheet trip={trip} onClose={onClose} />
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
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '2500');
    await fireEvent.press(save());
    expect(setBudget).toHaveBeenCalledWith(expect.objectContaining({ id: TRIP_ID, baseCurrency: 'THB' }), 250000);
    await act(async () => {});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the sheet open when saving fails, with the error as a CircleAlert and text, announced, never colour alone (D28)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { onClose } = await setup(budget(() => Promise.reject(new Error('disk full'))));
    await fireEvent.changeText(screen.getByLabelText('Kwota na osobę'), '2500');
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
});
