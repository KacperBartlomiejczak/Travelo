import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ZodError } from 'zod';

import { buildTrip } from '@/data/trip-repository';
import {
  listItemFromRow,
  overviewFromRows,
  photoFromRow,
  toCreateTripArgs,
  toPhotoRow,
  type MemberRow,
  type PhotoRow,
  type SegmentRow,
  type TripRow,
} from '@/data/trip-rows';
import { COVER_PRESET_IDS, CoverSchema, CreateTripInputSchema, InterestTagSchema, TripOverviewSchema, TripPhotoSchema, type TripPhoto } from '@/schemas';
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
      cover_image_uri: 'preset:auckland',
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

  it('always sends the cover: the chosen preset, never null (the column is not null, trip-covers D1)', () => {
    const withCover = created((input) => {
      input.details.coverImageUri = 'preset:bali';
    });
    expect(toCreateTripArgs(withCover).trip).toEqual(expect.objectContaining({ cover_image_uri: 'preset:bali' }));
    expect(toCreateTripArgs(created()).trip).toEqual(expect.objectContaining({ cover_image_uri: 'preset:auckland' }));
  });

  it('sends the default cover for a gallery photo, which is uploaded after the trip exists (trip-covers Q1)', () => {
    const withPhoto = created((input) => {
      input.details.coverImageUri = 'file:///cache/cover.jpg';
    });
    expect(toCreateTripArgs(withPhoto).trip).toEqual(expect.objectContaining({ cover_image_uri: 'preset:auckland' }));
  });
});

describe('overviewFromRows', () => {
  it('gives back what was created (round trip), with the traveller count', () => {
    const trip = created((input) => {
      input.details.coverImageUri = 'preset:bali';
    });
    const { tripRow, members, segments } = storedRows(trip);
    const overview = overviewFromRows(tripRow, members, segments);
    expect(overview).toEqual({ trip: { ...trip.trip, travellerCount: 3 }, members: trip.members, segments: trip.segments });
    expect(TripOverviewSchema.safeParse(overview).success).toBe(true);
  });

  it('leaves null columns out instead of passing null to optional fields', () => {
    const { tripRow, members, segments } = storedRows(created());
    const overview = overviewFromRows(tripRow, members, segments);
    expect(overview.trip.coverImageUri).toBe('preset:auckland');
    expect(overview.trip).not.toHaveProperty('coverUrls');
    expect(overview.members[0]).not.toHaveProperty('budgetLevel');
    expect(overview.members[0]).not.toHaveProperty('pace');
    expect(overview.members[0]).not.toHaveProperty('dietaryNotes');
    expect(overview.segments[1]).not.toHaveProperty('flightNumber');
  });

  describe('cover (trip-covers)', () => {
    const photoCover = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
    const urls = { url: 'https://example.supabase.co/a.jpg?token=1', thumbnailUrl: 'https://example.supabase.co/a_thumb.jpg?token=2' };

    it('maps a gallery cover with its signed urls', () => {
      const { tripRow, members, segments } = storedRows(created());
      const overview = overviewFromRows({ ...tripRow, cover_image_uri: photoCover }, members, segments, urls);
      expect(overview.trip).toEqual(expect.objectContaining({ coverImageUri: photoCover, coverUrls: urls }));
    });

    it.each([
      ['a null cover', { cover_image_uri: null }],
      ['a device URI from before covers', { cover_image_uri: 'file:///cache/cover.jpg' }],
      ['an unknown preset', { cover_image_uri: 'preset:paris' }],
      ['an uppercase gallery id', { cover_image_uri: 'photo:5B1F0F6A-2C7D-4A8E-9B3C-1D2E3F4A5B6C' }],
    ])('rejects a trip row with %s', (_, patch) => {
      const { tripRow, members, segments } = storedRows(created());
      expect(() => overviewFromRows({ ...tripRow, ...patch } as TripRow, members, segments)).toThrow();
    });

    it('rejects signed urls for a preset or urls that are not http(s)', () => {
      const { tripRow, members, segments } = storedRows(created());
      expect(() => overviewFromRows(tripRow, members, segments, urls)).toThrow();
      expect(() =>
        overviewFromRows({ ...tripRow, cover_image_uri: photoCover }, members, segments, { ...urls, url: 'javascript:alert(1)' }),
      ).toThrow();
    });
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

describe('listItemFromRow (trips-drawer D4)', () => {
  const row = {
    id: '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01',
    name: 'Warsaw → Bangkok',
    cover_image_uri: 'preset:bali',
    destination: 'BKK',
    start_date: '2026-11-03',
    end_date: '2026-11-15',
    flight_segments: [
      { from_iata: 'WAW', to_iata: 'DOH' },
      { from_iata: 'DOH', to_iata: 'BKK' },
      { from_iata: 'BKK', to_iata: 'WAW' },
    ],
  };
  const photoCover = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
  const urls = { url: 'https://example.supabase.co/a.jpg?token=1', thumbnailUrl: 'https://example.supabase.co/a_thumb.jpg?token=2' };

  it('turns the selected columns into a side panel item', () => {
    expect(listItemFromRow(row)).toEqual({
      id: row.id,
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
    });
  });

  it('maps the nested segments to routes; a trip without segments has no flights (profile-screen D11)', () => {
    expect(listItemFromRow({ ...row, flight_segments: [{ from_iata: 'WAW', to_iata: 'BCN' }] }).flights).toEqual([{ fromIata: 'WAW', toIata: 'BCN' }]);
    expect(listItemFromRow({ ...row, flight_segments: [] }).flights).toEqual([]);
  });

  it.each([
    ['a destination that is no IATA code', { destination: 'bangkok' }],
    ['a segment with a bad airport code', { flight_segments: [{ from_iata: 'wa', to_iata: 'DOH' }] }],
  ])('rejects a row with %s', (_, patch) => {
    expect(() => listItemFromRow({ ...row, ...patch })).toThrow();
  });

  it('adds the signed urls of a gallery cover', () => {
    expect(listItemFromRow({ ...row, cover_image_uri: photoCover }, urls)).toEqual(
      expect.objectContaining({ coverImageUri: photoCover, coverUrls: urls }),
    );
  });

  it.each([
    ['a null cover', { cover_image_uri: null }],
    ['a device URI from before covers', { cover_image_uri: 'file:///cache/cover.jpg' }],
    ['an unknown preset', { cover_image_uri: 'preset:paris' }],
  ])('rejects a row with %s', (_, patch) => {
    expect(() => listItemFromRow({ ...row, ...patch } as never)).toThrow();
  });

  it('rejects signed urls for a preset', () => {
    expect(() => listItemFromRow(row, urls)).toThrow();
  });

  it.each([
    ['an empty name', { name: '' }],
    ['an end date before the start date', { end_date: '2026-11-01' }],
    ['an id that is not a UUID', { id: 'trip-1' }],
  ])('rejects a row with %s', (_, patch) => {
    expect(() => listItemFromRow({ ...row, ...patch })).toThrow();
  });
});

describe('photoFromRow / toPhotoRow (trip-photos step 4)', () => {
  const photo: TripPhoto = {
    id: '5b1d0f3e-7a64-4c2f-9d18-3e4a5b6c7d01',
    tripId: '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01',
    takenAt: '2026-10-14T18:03',
    createdAt: '2026-10-15T09:00:00.000Z',
  };
  const undated: TripPhoto = { id: photo.id, tripId: photo.tripId, createdAt: photo.createdAt };
  const row: PhotoRow = {
    id: photo.id,
    trip_id: photo.tripId,
    taken_at: '2026-10-14T18:03:00',
    created_at: '2026-10-15T09:00:00+00:00',
  };

  describe('toPhotoRow', () => {
    it('sends all four columns, with the camera clock as is', () => {
      expect(toPhotoRow(photo)).toEqual({
        id: photo.id,
        trip_id: photo.tripId,
        taken_at: '2026-10-14T18:03',
        created_at: '2026-10-15T09:00:00.000Z',
      });
    });

    it('sends a missing date taken as null', () => {
      expect(toPhotoRow(undated)).toEqual(expect.objectContaining({ taken_at: null }));
    });
  });

  describe('photoFromRow', () => {
    it('turns a row into a photo that passes TripPhotoSchema', () => {
      const parsed = photoFromRow(row);
      expect(parsed).toEqual({ ...photo, createdAt: '2026-10-15T09:00:00+00:00' });
      expect(TripPhotoSchema.safeParse(parsed).success).toBe(true);
    });

    it('gives back what was sent (round trip), with and without a date taken', () => {
      // toPhotoRow always sets all four columns, so what it sends is what the server stores (a Row).
      expect(photoFromRow(toPhotoRow(photo) as PhotoRow)).toEqual(photo);
      expect(photoFromRow(toPhotoRow(undated) as PhotoRow)).toEqual(undated);
    });

    it('leaves a null taken_at out instead of passing null to an optional field', () => {
      expect(photoFromRow({ ...row, taken_at: null })).not.toHaveProperty('takenAt');
    });

    it('drops the seconds PostgREST adds to a timestamp without time zone (T18:03:00 → T18:03)', () => {
      expect(photoFromRow({ ...row, taken_at: '2026-10-14T18:03:00' }).takenAt).toBe('2026-10-14T18:03');
    });

    it('accepts created_at the way Postgres returns it (UTC with +00:00, with or without fractions)', () => {
      expect(photoFromRow({ ...row, created_at: '2026-10-15T09:00:00+00:00' }).createdAt).toBe('2026-10-15T09:00:00+00:00');
      expect(photoFromRow({ ...row, created_at: '2026-10-15T09:00:01.123+00:00' }).createdAt).toBe('2026-10-15T09:00:01.123+00:00');
    });

    it.each([
      ['an id that is not a UUID', { id: 'photo-1' }],
      ['a trip id that is not a UUID', { trip_id: 'trip-1' }],
      ['a garbage date taken', { taken_at: 'yesterday evening' }],
      ['an impossible date taken', { taken_at: '2026-02-30T18:03:00' }],
      ['a timestamp added without an offset', { created_at: '2026-10-15T09:00:00' }],
    ])('rejects a row with %s', (_, patch) => {
      expect(() => photoFromRow({ ...row, ...patch })).toThrow(ZodError);
    });
  });
});

describe('Zod ↔ database parity', () => {
  const migrations = readdirSync(join(__dirname, '../../../supabase/migrations'))
    .map((file) => readFileSync(join(__dirname, '../../../supabase/migrations', file), 'utf8'))
    .join('\n');

  const cover = migrations.match(/cover_image_uri ~ '([^']+)'/)?.[1] ?? '';
  // Postgres and JavaScript read this pattern the same way (anchors, groups, alternation, character classes).
  const coverCheck = new RegExp(cover);

  it('the database accepts exactly the presets of CoverPresetIdSchema', () => {
    const list = cover.match(/preset:\(([a-z|]+)\)/)?.[1] ?? '';
    expect(list.split('|').sort()).toEqual([...COVER_PRESET_IDS].sort());
  });

  it('the cover check of the database and CoverSchema agree on valid and invalid values', () => {
    expect(cover).not.toBe('');
    const photo = 'photo:5b1f0f6a-2c7d-4a8e-9b3c-1d2e3f4a5b6c';
    const values = [
      ...COVER_PRESET_IDS.map((id) => `preset:${id}`),
      photo,
      '',
      'preset:',
      'preset:paris',
      'preset:Bali',
      'preset:bali\n',
      'preset:bali preset:bali',
      photo.toUpperCase(),
      'photo:5b1f0f6a',
      `${photo}\n`,
      `x${photo}`,
      'file:///cache/cover.jpg',
      'https://example.com/a.jpg',
    ];
    for (const value of values) {
      expect([value, coverCheck.test(value)]).toEqual([value, CoverSchema.safeParse(value).success]);
    }
  });

  it('the database accepts exactly the interest tags of InterestTagSchema', () => {
    const list = migrations.match(/interests <@ array\[([^\]]+)\]/)?.[1] ?? '';
    const tags = [...list.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(tags.sort()).toEqual([...InterestTagSchema.options].sort());
  });
});
