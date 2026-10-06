import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildTrip } from '@/data/trip-repository';
import { overviewFromRows, toCreateTripArgs, type MemberRow, type SegmentRow, type TripRow } from '@/data/trip-rows';
import { CreateTripInputSchema, InterestTagSchema, TripOverviewSchema } from '@/schemas';
import { createTripInputFixture } from '@/test/fixtures';

const NOW = new Date('2026-10-04T12:00:00Z');
const OWNER_ID = '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d';

function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

function created(patch: (input: ReturnType<typeof createTripInputFixture>) => void = () => {}) {
  const input = createTripInputFixture();
  patch(input);
  return buildTrip(CreateTripInputSchema.parse(input), { now: NOW, newId: sequentialIds(), ownerId: OWNER_ID });
}

/** What Supabase stores for a create_trip call: the payload, owned by the caller. */
function storedRows(trip: ReturnType<typeof created>) {
  const args = toCreateTripArgs(trip);
  const tripRow: TripRow = { ...(args.trip as Omit<TripRow, 'owner_id'>), owner_id: OWNER_ID };
  return { tripRow, members: args.members as MemberRow[], segments: args.segments as SegmentRow[] };
}

describe('toCreateTripArgs', () => {
  it('sends the trip as a row, with the budget in minor units and its currency as the base currency', () => {
    const { trip } = toCreateTripArgs(created());
    expect(trip).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Warsaw → Bangkok',
      cover_image_uri: null,
      destination: 'BKK',
      start_date: '2026-11-03',
      end_date: '2026-11-15',
      base_currency: 'THB',
      budget_per_person_minor: 3000000,
      budget_updated_at: '2026-10-04T12:00:00.000Z',
      created_at: '2026-10-04T12:00:00.000Z',
    });
  });

  it('sends friends with their interests and no account', () => {
    const { members } = toCreateTripArgs(created());
    expect(members).toEqual([
      expect.objectContaining({ trip_id: '00000000-0000-4000-8000-000000000001', user_id: null, display_name: 'Kasia', role: 'viewer', interests: ['beaches', 'nightlife'] }),
      expect.objectContaining({ display_name: 'Ola', interests: [] }),
    ]);
  });

  it('sends segments with their order as position and a missing flight number as null', () => {
    const { segments } = toCreateTripArgs(created());
    expect((segments as SegmentRow[]).map((s) => [s.direction, s.position, s.from_iata, s.to_iata, s.flight_number])).toEqual([
      ['outbound', 0, 'WAW', 'DXB', 'EK180'],
      ['outbound', 1, 'DXB', 'BKK', null],
      ['return', 0, 'BKK', 'WAW', null],
    ]);
    expect((segments as SegmentRow[])[0]).toEqual(
      expect.objectContaining({ depart_at: '2026-11-02T10:00:00+01:00', depart_tz: 'Europe/Warsaw', arrive_tz: 'Asia/Dubai' }),
    );
  });

  it('sends the cover photo URI when there is one', () => {
    const withCover = created((input) => {
      input.details.coverImageUri = 'file:///cache/cover.jpg';
    });
    expect(toCreateTripArgs(withCover).trip).toEqual(expect.objectContaining({ cover_image_uri: 'file:///cache/cover.jpg' }));
  });
});

describe('overviewFromRows', () => {
  it('gives back what was created (round trip), with the traveller count', () => {
    const trip = created((input) => {
      input.details.coverImageUri = 'file:///cache/cover.jpg';
    });
    const { tripRow, members, segments } = storedRows(trip);
    const overview = overviewFromRows(tripRow, members, segments);
    expect(overview).toEqual({ trip: { ...trip.trip, travellerCount: 3 }, members: trip.members, segments: trip.segments });
    expect(TripOverviewSchema.safeParse(overview).success).toBe(true);
  });

  it('leaves null columns out instead of passing null to optional fields', () => {
    const { tripRow, members, segments } = storedRows(created());
    const overview = overviewFromRows(tripRow, members, segments);
    expect(overview.trip).not.toHaveProperty('coverImageUri');
    expect(overview.members[0]).not.toHaveProperty('budgetLevel');
    expect(overview.members[0]).not.toHaveProperty('pace');
    expect(overview.members[0]).not.toHaveProperty('dietaryNotes');
    expect(overview.segments[1]).not.toHaveProperty('flightNumber');
  });

  it('keeps member details the server has', () => {
    const { tripRow, members, segments } = storedRows(created());
    const detailed = [{ ...members[0], budget_level: 'mid', pace: 'relaxed', dietary_notes: 'vegetarian' }, members[1]];
    expect(overviewFromRows(tripRow, detailed, segments).members[0]).toEqual(
      expect.objectContaining({ budgetLevel: 'mid', pace: 'relaxed', dietaryNotes: 'vegetarian' }),
    );
  });

  it('accepts timestamps the way Postgres returns them (UTC with +00:00)', () => {
    const { tripRow, members, segments } = storedRows(created());
    const fromServer = { ...tripRow, created_at: '2026-10-04T12:00:00+00:00', budget_updated_at: '2026-10-06T09:30:00.123+00:00' };
    expect(overviewFromRows(fromServer, members, segments).trip.budgetUpdatedAt).toBe('2026-10-06T09:30:00.123+00:00');
  });

  it('orders segments outbound first, then return, each by position, whatever order the server sends', () => {
    const { tripRow, members, segments } = storedRows(created());
    const shuffled = [segments[2], segments[1], segments[0]];
    expect(overviewFromRows(tripRow, members, shuffled).segments.map((s) => [s.direction, s.order])).toEqual([
      ['outbound', 0],
      ['outbound', 1],
      ['return', 0],
    ]);
  });

  it('orders members by name, whatever order the server sends', () => {
    const { tripRow, members, segments } = storedRows(created());
    expect(overviewFromRows(tripRow, [members[1], members[0]], segments).members.map((m) => m.displayName)).toEqual(['Kasia', 'Ola']);
  });

  it.each([
    ['a budget with a fraction', { budget_per_person_minor: 1.5 }],
    ['a lowercase currency', { base_currency: 'thb' }],
    ['a timestamp without an offset', { created_at: '2026-10-04T12:00:00' }],
  ])('rejects a trip row with %s', (_, patch) => {
    const { tripRow, members, segments } = storedRows(created());
    expect(() => overviewFromRows({ ...tripRow, ...patch } as TripRow, members, segments)).toThrow();
  });

  it('rejects an unknown interest or a segment of another direction', () => {
    const { tripRow, members, segments } = storedRows(created());
    expect(() => overviewFromRows(tripRow, [{ ...members[0], interests: ['golf'] }], segments)).toThrow();
    expect(() => overviewFromRows(tripRow, members, [{ ...segments[0], direction: 'sideways' }])).toThrow();
  });
});

describe('Zod ↔ database parity', () => {
  const migrations = readdirSync(join(__dirname, '../../../supabase/migrations'))
    .map((file) => readFileSync(join(__dirname, '../../../supabase/migrations', file), 'utf8'))
    .join('\n');

  it('the database accepts exactly the interest tags of InterestTagSchema', () => {
    const list = migrations.match(/interests <@ array\[([^\]]+)\]/)?.[1] ?? '';
    const tags = [...list.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(tags.sort()).toEqual([...InterestTagSchema.options].sort());
  });
});
