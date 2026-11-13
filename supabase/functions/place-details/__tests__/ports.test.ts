import type { SupabaseClient } from '@supabase/supabase-js';
import { createPorts } from '../ports';

const env = { placesApiKey: 'places-key' };
const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json }) as Response;
const bad = (status: number) => ({ ok: false, status, json: async () => ({}) }) as Response;
const google = {
  id: 'ChIJ1',
  displayName: { text: 'Castle' },
  formattedAddress: 'Rua 1',
  googleMapsUri: 'https://maps.google.com/?cid=1',
};

function setup(response: Response) {
  const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => response);
  const ports = createPorts({ admin: {} as SupabaseClient, fetch: fetchMock as unknown as typeof fetch, env });
  return { ports, fetchMock };
}

const authWith = (getUser: unknown) =>
  createPorts({ admin: { auth: { getUser } } as unknown as SupabaseClient, fetch, env });

describe('place-details ports', () => {
  it('authenticates via the admin client', async () => {
    const ports = authWith(async () => ({ data: { user: { id: 'u' } }, error: null }));
    expect(await ports.authenticate('t')).toEqual({ kind: 'user', id: 'u' });
  });

  it.each([401, 403])('maps %i to invalid', async (status) => {
    const ports = authWith(async () => ({ data: { user: null }, error: { status } }));
    expect(await ports.authenticate('t')).toEqual({ kind: 'invalid' });
  });

  it('throws on other auth failures', async () => {
    const ports = authWith(async () => ({ data: { user: null }, error: { status: 500 } }));
    await expect(ports.authenticate('t')).rejects.toBeDefined();
  });

  it('calls Place Details with key, field mask and languageCode', async () => {
    const { ports, fetchMock } = setup(ok(google));
    expect(await ports.placeDetails('ChIJ1', 'pl')).toEqual({
      placeId: 'ChIJ1',
      name: 'Castle',
      address: 'Rua 1',
      googleMapsUri: 'https://maps.google.com/?cid=1',
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://places.googleapis.com/v1/places/ChIJ1?languageCode=pl');
    expect(init?.headers).toEqual({
      'X-Goog-Api-Key': 'places-key',
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,googleMapsUri',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps a missing address to null', async () => {
    const { formattedAddress: _a, ...noAddress } = google;
    expect((await setup(ok(noAddress)).ports.placeDetails('ChIJ1', 'en')).address).toBeNull();
  });

  it('throws on a non-OK response', async () => {
    await expect(setup(bad(404)).ports.placeDetails('x', 'pl')).rejects.toBeDefined();
  });

  it('throws on a malformed payload', async () => {
    await expect(setup(ok({ id: 'x' })).ports.placeDetails('x', 'pl')).rejects.toBeDefined();
  });
});
