import { SelectedTripSchema, TripListItemSchema, TripListSchema } from '@/schemas';

const photoCover = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
const coverUrls = { url: 'https://example.supabase.co/a.jpg?token=1', thumbnailUrl: 'https://example.supabase.co/a_thumb.jpg?token=2' };

const item = {
  id: '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01',
  name: 'Warsaw → Bangkok',
  coverImageUri: 'preset:bali',
  destination: 'BKK',
  flights: [
    { fromIata: 'WAW', toIata: 'DOH' },
    { fromIata: 'DOH', toIata: 'BKK' },
    { fromIata: 'BKK', toIata: 'WAW' },
  ],
  startDate: '2026-11-03',
  endDate: '2026-11-15',
};

describe('TripListItem (trips-drawer D4)', () => {
  it('accepts a trip with a preset or a gallery cover, including a one-day trip', () => {
    expect(TripListItemSchema.parse(item)).toEqual(item);
    expect(TripListItemSchema.parse({ ...item, coverImageUri: photoCover, coverUrls })).toEqual({ ...item, coverImageUri: photoCover, coverUrls });
    expect(TripListItemSchema.safeParse({ ...item, endDate: item.startDate }).success).toBe(true);
  });

  it('requires a cover (trip-covers D1)', () => {
    const { coverImageUri: _omit, ...withoutCover } = item;
    expect(TripListItemSchema.safeParse(withoutCover).success).toBe(false);
  });

  it('accepts a gallery cover without signed URLs (an offline copy), but refuses URLs on a preset', () => {
    expect(TripListItemSchema.parse({ ...item, coverImageUri: photoCover })).not.toHaveProperty('coverUrls');
    expect(TripListItemSchema.safeParse({ ...item, coverUrls }).success).toBe(false);
  });

  it('keeps only what the side panel needs', () => {
    const parsed = TripListItemSchema.parse({ ...item, travellerCount: 3, baseCurrency: 'THB' });
    expect(Object.keys(parsed).sort()).toEqual(['coverImageUri', 'destination', 'endDate', 'flights', 'id', 'name', 'startDate']);
  });

  it('carries the destination and the route of every flight segment (profile-screen D11)', () => {
    expect(TripListItemSchema.parse(item)).toEqual(item);
    expect(TripListItemSchema.parse({ ...item, flights: [] }).flights).toEqual([]);
  });

  it('keeps only the route of a flight segment', () => {
    const parsed = TripListItemSchema.parse({ ...item, flights: [{ fromIata: 'WAW', toIata: 'DOH', flightNumber: 'QR 8', direction: 'outbound' }] });
    expect(parsed.flights).toEqual([{ fromIata: 'WAW', toIata: 'DOH' }]);
  });

  it('requires the destination and the flights (an old offline copy has neither, R1)', () => {
    const { destination: _destination, ...withoutDestination } = item;
    const { flights: _flights, ...withoutFlights } = item;
    expect(TripListItemSchema.safeParse(withoutDestination).success).toBe(false);
    expect(TripListItemSchema.safeParse(withoutFlights).success).toBe(false);
  });

  it.each([
    ['an end date before the start date', { endDate: '2026-11-02' }],
    ['an empty name', { name: '' }],
    ['a 61-character name', { name: 'a'.repeat(61) }],
    ['an id that is not a UUID', { id: 'trip-1' }],
    ['an impossible date', { startDate: '2026-02-30' }],
    ['a destination that is no IATA code', { destination: 'bkk' }],
    ['a route starting at a bad IATA code', { flights: [{ fromIata: 'wa', toIata: 'DOH' }] }],
    ['a route ending at a bad IATA code', { flights: [{ fromIata: 'WAW', toIata: 'WAWX' }] }],
    ['a route without a landing airport', { flights: [{ fromIata: 'WAW' }] }],
    ['flights that are no list', { flights: { fromIata: 'WAW', toIata: 'DOH' } }],
    ['an empty cover URI', { coverImageUri: '' }],
    ['a device URI as the cover', { coverImageUri: 'file:///cache/cover.jpg' }],
    ['signed URLs that are not http(s)', { coverImageUri: photoCover, coverUrls: { url: 'file:///a.jpg', thumbnailUrl: coverUrls.thumbnailUrl } }],
  ])('rejects %s', (_, patch) => {
    expect(TripListItemSchema.safeParse({ ...item, ...patch }).success).toBe(false);
  });
});

describe('TripList', () => {
  it('accepts no trips and several trips', () => {
    expect(TripListSchema.parse([])).toEqual([]);
    expect(TripListSchema.safeParse([item, { ...item, id: '1c0f8d5f-7b54-4d5c-8b66-3a7f1f8f2b02' }]).success).toBe(true);
  });

  it('rejects a list with one bad trip', () => {
    expect(TripListSchema.safeParse([item, { ...item, name: '' }]).success).toBe(false);
  });
});

describe('SelectedTrip (trips-drawer D2)', () => {
  it('accepts a trip id', () => {
    expect(SelectedTripSchema.parse({ tripId: item.id })).toEqual({ tripId: item.id });
  });

  it.each([
    ['an id that is not a UUID', { tripId: 'trip-1' }],
    ['no id', {}],
  ])('rejects %s', (_, value) => {
    expect(SelectedTripSchema.safeParse(value).success).toBe(false);
  });
});
