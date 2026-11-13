import { fetchPlaceDetails, fetchTripPlan, generateTripPlan, TripPlanCallError } from '@/data/trip-plan';
import type { GenerateTripPlanRequest } from '@/schemas';
import { fakeSupabase, NETWORK_FAILURE } from '@/test/fake-supabase';

const { FunctionsFetchError, FunctionsHttpError } = jest.requireActual('@supabase/supabase-js');

const TRIP_ID = '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d';
const REQUEST: GenerateTripPlanRequest = { tripId: TRIP_ID, scope: { kind: 'city_only' }, extraCities: [], preferences: [], locale: 'en' };
const PLAN = {
  tripId: TRIP_ID,
  days: [{ date: '2026-12-01', cityIata: 'LIS', items: [{ placeId: 'p1', slot: 'morning', reason: 'Nice', forPeople: ['owner'] }] }],
  model: 'gemini-x',
  createdAt: '2026-11-01T10:00:00+00:00',
};
const place = (id: string) => ({ placeId: id, name: `Name ${id}`, address: null, googleMapsUri: `https://maps.google.com/?cid=${id}` });

const kindOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (failure: unknown) => failure,
  );
  expect(error).toBeInstanceOf(TripPlanCallError);
  return (error as TripPlanCallError).kind;
};
const httpError = (status: number, error: string) => new FunctionsHttpError({ status, json: async () => ({ error }) });

describe('generateTripPlan', () => {
  it('invokes generate-trip-plan with the validated request and returns the validated response', async () => {
    const s = fakeSupabase();
    const response = { plan: PLAN, places: [place('p1')], remainingToday: 2 };
    s.invoke.mockResolvedValueOnce({ data: response, error: null });
    await expect(generateTripPlan(s.client, REQUEST)).resolves.toEqual(response);
    expect(s.invoke.mock.calls).toEqual([['generate-trip-plan', { body: REQUEST }]]);
  });

  it('an invalid request fails before any call', async () => {
    const s = fakeSupabase();
    expect(await kindOf(generateTripPlan(s.client, { ...REQUEST, tripId: 'nope' }))).toBe('failed');
    expect(s.invoke).not.toHaveBeenCalled();
  });

  it('a response of the wrong shape is "failed"', async () => {
    const s = fakeSupabase();
    s.invoke.mockResolvedValueOnce({ data: { plan: {}, places: [] }, error: null });
    expect(await kindOf(generateTripPlan(s.client, REQUEST))).toBe('failed');
  });

  it.each([
    [429, 'limit_reached', 'limit_reached'],
    [422, 'no_places', 'no_places'],
    [403, 'forbidden', 'forbidden'],
    [401, 'unauthorized', 'unauthorized'],
    [502, 'upstream_failed', 'failed'],
    [500, 'upstream_failed', 'failed'],
    [400, 'invalid_input', 'failed'],
  ])('HTTP %i %s becomes "%s"', async (status, code, kind) => {
    const s = fakeSupabase();
    s.invoke.mockResolvedValueOnce({ data: null, error: httpError(status, code) });
    expect(await kindOf(generateTripPlan(s.client, REQUEST))).toBe(kind);
  });

  it('a 401 with an unreadable body is still unauthorized', async () => {
    const s = fakeSupabase();
    s.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError({ status: 401, json: async () => Promise.reject(new Error('x')) }) });
    expect(await kindOf(generateTripPlan(s.client, REQUEST))).toBe('unauthorized');
  });

  it('a fetch error (no connection or abort) is "offline"', async () => {
    const s = fakeSupabase();
    s.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new Error('Network request failed')) });
    expect(await kindOf(generateTripPlan(s.client, REQUEST))).toBe('offline');
  });
});

describe('fetchTripPlan', () => {
  it('reads trip_plans by trip_id and maps the row', async () => {
    const s = fakeSupabase();
    s.respond('trip_plans', { data: { trip_id: TRIP_ID, days: PLAN.days, model: PLAN.model, created_at: PLAN.createdAt } });
    await expect(fetchTripPlan(s.client, TRIP_ID)).resolves.toEqual(PLAN);
    expect(s.queries[0]?.table).toBe('trip_plans');
    expect(s.queries[0]?.ops).toContainEqual(['eq', ['trip_id', TRIP_ID]]);
  });

  it('no row is null', async () => {
    const s = fakeSupabase();
    s.respond('trip_plans', { data: null });
    await expect(fetchTripPlan(s.client, TRIP_ID)).resolves.toBeNull();
  });

  it('bad jsonb is "failed"', async () => {
    const s = fakeSupabase();
    s.respond('trip_plans', { data: { trip_id: TRIP_ID, days: [{ nope: 1 }], model: 'm', created_at: PLAN.createdAt } });
    expect(await kindOf(fetchTripPlan(s.client, TRIP_ID))).toBe('failed');
  });

  it('no connection is "offline"; another error is "failed"', async () => {
    const s = fakeSupabase();
    s.respond('trip_plans', NETWORK_FAILURE, { error: { message: 'boom', code: '500' }, status: 500 });
    expect(await kindOf(fetchTripPlan(s.client, TRIP_ID))).toBe('offline');
    expect(await kindOf(fetchTripPlan(s.client, TRIP_ID))).toBe('failed');
  });
});

describe('fetchPlaceDetails', () => {
  it('invokes place-details and returns places by id', async () => {
    const s = fakeSupabase();
    s.invoke.mockResolvedValueOnce({ data: { places: [place('a'), place('b')] }, error: null });
    await expect(fetchPlaceDetails(s.client, ['a', 'b'], 'pl')).resolves.toEqual({ a: place('a'), b: place('b') });
    expect(s.invoke.mock.calls).toEqual([['place-details', { body: { placeIds: ['a', 'b'], locale: 'pl' } }]]);
  });

  it('chunks 41 ids into 2 calls (40 + 1) and merges', async () => {
    const s = fakeSupabase();
    const ids = Array.from({ length: 41 }, (_, i) => `id${i}`);
    s.invoke.mockImplementation(async (_name, options) => ({
      data: { places: (options as { body: { placeIds: string[] } }).body.placeIds.map(place) },
      error: null,
    }));
    const result = await fetchPlaceDetails(s.client, ids, 'en');
    expect(s.invoke).toHaveBeenCalledTimes(2);
    expect(Object.keys(result)).toHaveLength(41);
  });

  it('no ids makes no call; duplicates are sent once', async () => {
    const s = fakeSupabase();
    await expect(fetchPlaceDetails(s.client, [], 'en')).resolves.toEqual({});
    expect(s.invoke).not.toHaveBeenCalled();
    s.invoke.mockResolvedValueOnce({ data: { places: [place('a')] }, error: null });
    await fetchPlaceDetails(s.client, ['a', 'a'], 'en');
    expect(s.invoke.mock.calls).toEqual([['place-details', { body: { placeIds: ['a'], locale: 'en' } }]]);
  });

  it('wrong response shape is "failed"; errors map to kinds', async () => {
    const s = fakeSupabase();
    s.invoke.mockResolvedValueOnce({ data: { places: [{ placeId: 'a' }] }, error: null });
    expect(await kindOf(fetchPlaceDetails(s.client, ['a'], 'en'))).toBe('failed');
    s.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new Error('x')) });
    expect(await kindOf(fetchPlaceDetails(s.client, ['a'], 'en'))).toBe('offline');
    s.invoke.mockResolvedValueOnce({ data: null, error: httpError(401, 'unauthorized') });
    expect(await kindOf(fetchPlaceDetails(s.client, ['a'], 'en'))).toBe('unauthorized');
    s.invoke.mockResolvedValueOnce({ data: null, error: httpError(403, 'forbidden') });
    expect(await kindOf(fetchPlaceDetails(s.client, ['a'], 'en'))).toBe('forbidden');
    s.invoke.mockResolvedValueOnce({ data: null, error: httpError(502, 'upstream_failed') });
    expect(await kindOf(fetchPlaceDetails(s.client, ['a'], 'en'))).toBe('failed');
  });
});
