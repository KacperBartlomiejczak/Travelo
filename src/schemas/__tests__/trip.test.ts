import { SelectedTripSchema, TripListItemSchema, TripListSchema } from '@/schemas';

const item = {
  id: '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01',
  name: 'Warsaw → Bangkok',
  coverImageUri: 'file:///cache/cover.jpg',
  startDate: '2026-11-03',
  endDate: '2026-11-15',
};

describe('TripListItem (trips-drawer D4)', () => {
  it('accepts a trip with or without a cover photo, including a one-day trip', () => {
    expect(TripListItemSchema.parse(item)).toEqual(item);
    const { coverImageUri: _omit, ...withoutCover } = item;
    expect(TripListItemSchema.parse(withoutCover)).not.toHaveProperty('coverImageUri');
    expect(TripListItemSchema.safeParse({ ...item, endDate: item.startDate }).success).toBe(true);
  });

  it('keeps only what the side panel needs', () => {
    const parsed = TripListItemSchema.parse({ ...item, destination: 'BKK', travellerCount: 3 });
    expect(Object.keys(parsed).sort()).toEqual(['coverImageUri', 'endDate', 'id', 'name', 'startDate']);
  });

  it.each([
    ['an end date before the start date', { endDate: '2026-11-02' }],
    ['an empty name', { name: '' }],
    ['a 61-character name', { name: 'a'.repeat(61) }],
    ['an id that is not a UUID', { id: 'trip-1' }],
    ['an impossible date', { startDate: '2026-02-30' }],
    ['an empty cover URI', { coverImageUri: '' }],
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
