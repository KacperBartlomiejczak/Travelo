import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { fetchAppPlaceDetails, fetchAppTripPlan, generateAppTripPlan } from '@/data/app-trip-plan';
import { useGenerateTripPlan } from '@/hooks/useGenerateTripPlan';
import { usePlaceDetails } from '@/hooks/usePlaceDetails';
import { useTripPlan } from '@/hooks/useTripPlan';
import type { GenerateTripPlanRequest, GenerateTripPlanResponse } from '@/schemas';

jest.mock('@/data/app-trip-plan', () => ({ generateAppTripPlan: jest.fn(), fetchAppTripPlan: jest.fn(), fetchAppPlaceDetails: jest.fn() }));

const TRIP_ID = '00000000-0000-4000-8000-0000000000a1';
const plan = {
  tripId: TRIP_ID,
  model: 'm',
  createdAt: '2026-11-14T10:00:00+00:00',
  days: [{ date: '2026-12-01', cityIata: 'LIS', items: [{ placeId: 'p1', slot: 'morning' as const, reason: 'r', forPeople: ['owner'] }] }],
};
const place = { placeId: 'p1', name: 'Alfama', address: null, googleMapsUri: 'https://maps.google.com/?cid=1' };
const response: GenerateTripPlanResponse = { plan, places: [place], remainingToday: 2 };
const request: GenerateTripPlanRequest = { tripId: TRIP_ID, scope: { kind: 'city_only' }, extraCities: [], preferences: [], locale: 'pl' };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return wrapper;
}

beforeEach(() => {
  jest.mocked(fetchAppTripPlan).mockReset();
  jest.mocked(fetchAppPlaceDetails).mockReset();
  jest.mocked(generateAppTripPlan).mockReset();
});

describe('trip plan hooks', () => {
  it('useTripPlan returns the saved plan, or null', async () => {
    jest.mocked(fetchAppTripPlan).mockResolvedValue(null);
    const { result } = await renderHook(() => useTripPlan(TRIP_ID), { wrapper: setup() });
    await waitFor(() => expect(result.current.data).toBeNull());
    expect(fetchAppTripPlan).toHaveBeenCalledWith(TRIP_ID);
  });

  it('usePlaceDetails does not fetch for empty ids', async () => {
    const { result } = await renderHook(() => usePlaceDetails([], 'pl'), { wrapper: setup() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchAppPlaceDetails).not.toHaveBeenCalled();
  });

  it('a successful generation fills the plan cache and the details cache (no second call)', async () => {
    jest.mocked(generateAppTripPlan).mockResolvedValue(response);
    jest.mocked(fetchAppTripPlan).mockResolvedValue(null);
    const { result } = await renderHook(
      () => ({ gen: useGenerateTripPlan(TRIP_ID), plan: useTripPlan(TRIP_ID), details: usePlaceDetails(['p1'], 'pl') }),
      { wrapper: setup() },
    );
    await waitFor(() => expect(result.current.plan.data).toBeNull());
    jest.mocked(fetchAppPlaceDetails).mockClear();
    await act(async () => void (await result.current.gen.mutateAsync(request)));
    await waitFor(() => expect(result.current.plan.data).toEqual(plan));
    await waitFor(() => expect(result.current.details.data).toEqual({ p1: place }));
    expect(fetchAppPlaceDetails).not.toHaveBeenCalled();
  });

  it('a plan read that started before the generation cannot overwrite the generated plan', async () => {
    let resolveRead: (v: null) => void = () => {};
    jest.mocked(fetchAppTripPlan).mockReturnValue(new Promise((r) => (resolveRead = r)));
    jest.mocked(generateAppTripPlan).mockResolvedValue(response);
    const { result } = await renderHook(() => ({ gen: useGenerateTripPlan(TRIP_ID), plan: useTripPlan(TRIP_ID) }), { wrapper: setup() });
    await act(async () => void (await result.current.gen.mutateAsync(request)));
    await act(async () => resolveRead(null));
    // Observers are notified on a macrotask; let it flush before asserting the plan was not replaced.
    await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
    expect(result.current.plan.data).toEqual(plan);
  });
});
