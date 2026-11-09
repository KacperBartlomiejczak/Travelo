import { fetchPlaceRecommendations, PlacesError } from '@/data/places';
import type { RecommendPlacesRequest } from '@/schemas';
import { fakeSupabase } from '@/test/fake-supabase';

const { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } = jest.requireActual('@supabase/supabase-js');

const REQUEST: RecommendPlacesRequest = { city: 'Lisbon', latitude: 38.72, longitude: -9.14, interests: ['museums', 'beaches'], locale: 'en' };
const PLACE = {
  placeId: 'ChIJ1',
  name: 'Museu',
  types: ['museum'],
  location: { latitude: 38.7, longitude: -9.1 },
  googleMapsUri: 'https://maps.google.com/?cid=1',
  reason: 'Great art',
};

function setup() {
  const supabase = fakeSupabase();
  return { supabase, fetch: (request: RecommendPlacesRequest = REQUEST) => fetchPlaceRecommendations(request, { supabase: supabase.client }) };
}

const kindOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (failure: unknown) => failure,
  );
  expect(error).toBeInstanceOf(PlacesError);
  return (error as PlacesError).kind;
};

describe('fetchPlaceRecommendations (places step C4)', () => {
  it('invokes recommend-places with the validated request and returns the validated response', async () => {
    const { supabase, fetch } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: { places: [PLACE], remainingToday: 4 }, error: null });
    await expect(fetch()).resolves.toEqual({ places: [PLACE], remainingToday: 4 });
    expect(supabase.invoke.mock.calls).toEqual([['recommend-places', { body: REQUEST }]]);
  });

  it('an invalid request fails before any call', async () => {
    const { supabase, fetch } = setup();
    expect(await kindOf(fetch({ ...REQUEST, interests: [] }))).toBe('failed');
    expect(supabase.invoke).not.toHaveBeenCalled();
  });

  it('a response of the wrong shape is "failed", never returned', async () => {
    const { supabase, fetch } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: { places: [{ placeId: 'x' }], remainingToday: 4 }, error: null });
    expect(await kindOf(fetch())).toBe('failed');
  });

  it('429 limit_reached', async () => {
    const { supabase, fetch } = setup();
    const context = { status: 429, json: async () => ({ error: 'limit_reached' }) };
    supabase.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(context) });
    expect(await kindOf(fetch())).toBe('limit_reached');
  });

  it('401 unauthorized', async () => {
    const { supabase, fetch } = setup();
    const context = { status: 401, json: async () => ({ error: 'unauthorized' }) };
    supabase.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(context) });
    expect(await kindOf(fetch())).toBe('unauthorized');
  });

  it('no answer at all is "offline"', async () => {
    const { supabase, fetch } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new Error('Network request failed')) });
    expect(await kindOf(fetch())).toBe('offline');
  });

  it.each([
    ['500 upstream_failed', new FunctionsHttpError({ status: 500, json: async () => ({ error: 'upstream_failed' }) })],
    ['an unreadable error body', new FunctionsHttpError({ status: 429, json: async () => Promise.reject(new Error('not json')) })],
    ['a relay error', new FunctionsRelayError({ status: 502 })],
  ])('%s is "failed"', async (_name, error) => {
    const { supabase, fetch } = setup();
    supabase.invoke.mockResolvedValueOnce({ data: null, error });
    expect(await kindOf(fetch())).toBe('failed');
  });
});
