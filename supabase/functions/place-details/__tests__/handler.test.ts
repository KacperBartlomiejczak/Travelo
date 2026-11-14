import { handlePlaceDetails, type PlaceDetailsPorts } from '../handler';

const ids = ['a', 'b', 'c'];
const BODY = { placeIds: ids, locale: 'pl' };
const detail = (placeId: string) => ({
  placeId,
  name: `Name ${placeId}`,
  address: null,
  googleMapsUri: `https://maps.google.com/?cid=${placeId}`,
});

function makePorts(overrides: Partial<PlaceDetailsPorts> = {}) {
  const calls: string[] = [];
  const ports: PlaceDetailsPorts = {
    authenticate: async () => {
      calls.push('authenticate');
      return { kind: 'user', id: 'u1' };
    },
    placeDetails: async (placeId) => detail(placeId),
    ...overrides,
  };
  return { ports, calls };
}

const req = (over: Partial<Parameters<typeof handlePlaceDetails>[0]> = {}) => ({
  method: 'POST',
  authorization: 'Bearer jwt',
  body: BODY as unknown,
  ...over,
});

describe('handlePlaceDetails', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects non-POST with 405', async () => {
    const { ports, calls } = makePorts();
    expect(await handlePlaceDetails(req({ method: 'GET' }), ports)).toEqual({
      status: 405,
      body: { error: 'invalid_input' },
    });
    expect(calls).toEqual([]);
  });

  it.each([null, '', 'Basic x', 'Bearer'])('401 for authorization %p', async (authorization) => {
    const { ports } = makePorts();
    expect(await handlePlaceDetails(req({ authorization }), ports)).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
  });

  it('401 for an invalid jwt', async () => {
    const { ports } = makePorts({ authenticate: async () => ({ kind: 'invalid' }) });
    expect((await handlePlaceDetails(req(), ports)).status).toBe(401);
  });

  it('500 upstream_failed when authenticate throws', async () => {
    const { ports } = makePorts({
      authenticate: async () => {
        throw new Error('down');
      },
    });
    expect(await handlePlaceDetails(req(), ports)).toEqual({ status: 500, body: { error: 'upstream_failed' } });
  });

  it.each([
    ['41 ids', { placeIds: Array.from({ length: 41 }, (_, i) => `p${i}`), locale: 'pl' }],
    ['duplicate ids', { placeIds: ['a', 'a'], locale: 'pl' }],
    ['missing locale', { placeIds: ['a'] }],
  ])('400 for %s', async (_name, body) => {
    const { ports } = makePorts();
    expect(await handlePlaceDetails(req({ body }), ports)).toEqual({ status: 400, body: { error: 'invalid_input' } });
  });

  it('returns places in input order', async () => {
    const { ports } = makePorts({
      placeDetails: async (id) => {
        await new Promise((r) => setTimeout(r, id === 'a' ? 10 : 0));
        return detail(id);
      },
    });
    expect(await handlePlaceDetails(req(), ports)).toEqual({ status: 200, body: { places: ids.map(detail) } });
  });

  it('passes the locale to the port', async () => {
    const seen: string[] = [];
    const { ports } = makePorts({
      placeDetails: async (id, locale) => {
        seen.push(locale);
        return detail(id);
      },
    });
    await handlePlaceDetails(req({ body: { placeIds: ['a'], locale: 'en' } }), ports);
    expect(seen).toEqual(['en']);
  });

  it('drops a failed lookup and warns once without ids', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ports } = makePorts({
      placeDetails: async (id) => {
        if (id === 'b') throw new Error('404');
        return detail(id);
      },
    });
    expect(await handlePlaceDetails(req(), ports)).toEqual({
      status: 200,
      body: { places: [detail('a'), detail('c')] },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('details_failed', { count: 1 });
  });

  it('drops a malformed port result', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ports } = makePorts({
      placeDetails: async (id) => (id === 'a' ? ({ placeId: 'a', name: '' } as never) : detail(id)),
    });
    expect(await handlePlaceDetails(req(), ports)).toEqual({
      status: 200,
      body: { places: [detail('b'), detail('c')] },
    });
  });

  it('502 upstream_failed when every lookup failed', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ports } = makePorts({
      placeDetails: async () => {
        throw new Error('x');
      },
    });
    expect(await handlePlaceDetails(req(), ports)).toEqual({ status: 502, body: { error: 'upstream_failed' } });
  });
});
